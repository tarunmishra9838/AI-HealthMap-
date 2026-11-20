from weather_service import get_weather, get_city_list, resolve_city_coordinates
from ai_engine import (
    get_analytics_summary,
    get_alerts_list,
    update_alert_lifecycle,
    get_risk_zones as get_ai_risk_zones,
    get_disease_trends_series,
    get_ai_outbreak_predictions,
)
from auth import router as auth_router
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
import json
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from geo_data import (
    get_all_regions, get_region_by_id, get_districts_by_state,
    get_district_by_id, get_subdistricts_by_state,
    get_subdistricts_by_district, get_towns_by_district,
    get_villages, get_location_statistics,
)

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"

app = FastAPI(
    title="AI HealthMap API",
    description="Disease and Outbreak Intelligence Backend. Census 2011 geography is historical reference data.",
    version="1.4.0",
)

app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- DATA HELPERS --------------------

def _load_json(filename: str):
    path = DATA_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=503, detail=f"Missing data file: {filename}")
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=500, detail=f"Could not read {filename}: {exc}") from exc


@lru_cache(maxsize=1)
def mapping_data():
    return _load_json("india-location-mapping.json")


@lru_cache(maxsize=1)
def town_data():
    return _load_json("india-towns.json")


@lru_cache(maxsize=1)
def village_data():
    return _load_json("india-villages.json")


def _field(row: dict, *names: str) -> str:
    for name in names:
        value = row.get(name)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def _census_key(row: dict) -> tuple[str, str, str]:
    return (
        _field(row, "state_code", "State Code"),
        _field(row, "district_code", "District Code"),
        _field(row, "sub_district_code", "subdistrict_code", "Sub-District Code", "Sub District Code"),
    )


def _now():
    return datetime.now(timezone.utc).isoformat()


class AlertStatusUpdate(BaseModel):
    status: str


# -------------------- BASIC --------------------
@app.get("/")
def root():
    return {"message": "AI HealthMap API is running", "status": "operational", "version": "1.4.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "AI HealthMap Backend", "timestamp": _now()}


# Static paths must be registered before /{state_id}.
@app.get("/api/locations/statistics")
def location_statistics():
    return {"country": "India", "data": get_location_statistics()}


@app.get("/api/locations")
def get_locations():
    regions = get_all_regions()
    states = [x for x in regions if x["type"] == "state"]
    uts = [x for x in regions if x["type"] == "union_territory"]
    return {
        "country": "India", "total_regions": len(regions),
        "states": len(states), "union_territories": len(uts),
        "level": "state_union_territory", "data_status": "MASTER_GEOGRAPHIC_DATA",
        "regions": regions,
    }


@app.get("/api/locations/{state_id}/districts")
def get_state_districts(state_id: str):
    state_id = state_id.upper()
    region = get_region_by_id(state_id)
    if region is None:
        raise HTTPException(status_code=404, detail="State or Union Territory not found")
    rows = get_districts_by_state(state_id)
    return {"country": "India", "state_id": state_id, "state_name": region["name"],
            "count": len(rows), "data_status": "MASTER_GEOGRAPHIC_DATA" if rows else "DATA_NOT_IMPORTED_YET",
            "districts": rows}


@app.get("/api/locations/{state_id}/subdistricts")
def get_state_subdistricts(state_id: str):
    state_id = state_id.upper()
    region = get_region_by_id(state_id)
    if region is None:
        raise HTTPException(status_code=404, detail="State or Union Territory not found")
    rows = get_subdistricts_by_state(state_id)
    return {"country": "India", "state_id": state_id, "state_name": region["name"],
            "count": len(rows), "level": "subdistrict",
            "data_status": "HISTORICAL_REFERENCE" if rows else "DATA_NOT_IMPORTED_YET",
            "source": "Census 2011 A-1",
            "message": "Historical/reference geography; current LGD crosswalk is not yet applied.",
            "subdistricts": rows}


@app.get("/api/locations/{state_id}/districts/{district_id}/subdistricts")
def get_district_subdistricts(state_id: str, district_id: str):
    state_id = state_id.upper()
    region = get_region_by_id(state_id)
    if region is None:
        raise HTTPException(status_code=404, detail="State or Union Territory not found")
    district = get_district_by_id(state_id, district_id)
    if district is None:
        raise HTTPException(status_code=404, detail="District not found or district data not imported")
    rows = get_subdistricts_by_district(state_id, district_id)
    if rows is None:
        raise HTTPException(status_code=404, detail="District not found")
    return {"country": "India", "state_id": state_id, "state_name": region["name"],
            "district_id": district_id, "district_name": district["district_name"],
            "count": len(rows), "level": "subdistrict",
            "data_status": "HISTORICAL_REFERENCE" if rows else "CROSSWALK_REQUIRED",
            "source": "Census 2011 A-1",
            "message": "Current district-to-subdistrict matching requires an authoritative crosswalk.",
            "subdistricts": rows}


@app.get("/api/locations/{state_id}/districts/{district_id}/towns")
def get_district_towns(state_id: str, district_id: str):
    state_id = state_id.upper()
    region = get_region_by_id(state_id)
    if region is None:
        raise HTTPException(status_code=404, detail="State or Union Territory not found")
    district = get_district_by_id(state_id, district_id)
    if district is None:
        raise HTTPException(status_code=404, detail="District not found or district data not imported")
    rows = get_towns_by_district(state_id, district_id)
    if rows is None:
        raise HTTPException(status_code=404, detail="District not found")
    return {"country": "India", "state": region["name"], "district": district["district_name"],
            "count": len(rows), "data_status": "HISTORICAL_REFERENCE" if rows else "CROSSWALK_REQUIRED",
            "source": "Census 2011 Location Directory", "towns": rows}


@app.get("/api/locations/{state_id}/districts/{district_id}/villages")
def get_district_villages(state_id: str, district_id: str):
    state_id = state_id.upper()
    region = get_region_by_id(state_id)
    if region is None:
        raise HTTPException(status_code=404, detail="State or Union Territory not found")
    district = get_district_by_id(state_id, district_id)
    if district is None:
        raise HTTPException(status_code=404, detail="District not found or district data not imported")
    rows = get_villages(state_id, district_id)
    if rows is None:
        raise HTTPException(status_code=404, detail="District not found")
    return {"country": "India", "state": region["name"], "district": district["district_name"],
            "count": len(rows), "data_status": "HISTORICAL_REFERENCE" if rows else "CROSSWALK_REQUIRED",
            "source": "Census 2011 Location Directory", "villages": rows}


@app.get("/api/locations/{state_id}/districts/{district_id}")
def get_single_district(state_id: str, district_id: str):
    state_id = state_id.upper()
    region = get_region_by_id(state_id)
    if region is None:
        raise HTTPException(status_code=404, detail="State or Union Territory not found")
    district = get_district_by_id(state_id, district_id)
    if district is None:
        raise HTTPException(status_code=404, detail="District not found or district data not imported")
    return {"country": "India", "state": region["name"], "district": district}


@app.get("/api/locations/{state_id}")
def get_location(state_id: str):
    region = get_region_by_id(state_id.upper())
    if region is None:
        raise HTTPException(status_code=404, detail="State or Union Territory not found")
    return {"country": "India", "region": region}


# -------------------- CENSUS-CODE MAPPING APIs --------------------
@app.get("/api/geography/mapping/summary")
def geography_mapping_summary():
    data = mapping_data()
    return {"status": "success",
            "data_status": data.get("data_status", "HISTORICAL_REFERENCE"),
            "source": data.get("source", "Census 2011 Location Code Directory"),
            "summary": data.get("summary", {})}


@app.get("/api/geography/subdistricts")
def list_census_subdistricts(
    state_code: Optional[str] = Query(default=None),
    district_code: Optional[str] = Query(default=None),
):
    rows = mapping_data().get("subdistricts", [])
    if state_code:
        rows = [x for x in rows if x.get("state_code") == state_code]
    if district_code:
        rows = [x for x in rows if x.get("district_code") == district_code]
    return {"status": "success", "data_status": "HISTORICAL_REFERENCE",
            "count": len(rows), "data": rows}


@app.get("/api/geography/states/{state_code}/districts/{district_code}/subdistricts")
def census_subdistricts_for_district(state_code: str, district_code: str):
    rows = [x for x in mapping_data().get("subdistricts", [])
            if x.get("state_code") == state_code and x.get("district_code") == district_code]
    return {"status": "success", "data_status": "HISTORICAL_REFERENCE",
            "source": "Census 2011 Location Code Directory", "count": len(rows), "data": rows}


@app.get("/api/geography/states/{state_code}/districts/{district_code}/subdistricts/{subdistrict_code}/towns")
def census_towns(state_code: str, district_code: str, subdistrict_code: str):
    key = (state_code, district_code, subdistrict_code)
    rows = [x for x in town_data() if _census_key(x) == key]
    return {"status": "success", "data_status": "HISTORICAL_REFERENCE",
            "source": "Census 2011 Location Code Directory", "state_code": state_code,
            "district_code": district_code, "sub_district_code": subdistrict_code,
            "count": len(rows), "data": rows}


@app.get("/api/geography/states/{state_code}/districts/{district_code}/subdistricts/{subdistrict_code}/villages")
def census_villages(state_code: str, district_code: str, subdistrict_code: str):
    key = (state_code, district_code, subdistrict_code)
    rows = [x for x in village_data() if _census_key(x) == key]
    return {"status": "success", "data_status": "HISTORICAL_REFERENCE",
            "source": "Census 2011 Location Code Directory", "state_code": state_code,
            "district_code": district_code, "sub_district_code": subdistrict_code,
            "count": len(rows), "data": rows}


# -------------------- ANALYTICS & AI OUTBREAK INTELLIGENCE --------------------
@app.get("/api/analytics/summary", tags=["Analytics"])
def analytics_summary():
    """Live overall analytics summary derived from real epidemiological surveillance data."""
    return get_analytics_summary()


@app.get("/api/analytics/trends", tags=["Analytics"])
def disease_trends():
    """Aggregated 12-week verified case trend series."""
    return get_disease_trends_series()


@app.get("/api/analytics/anomalies", tags=["Analytics"])
def analytics_anomalies():
    """Statistical Z-Score anomalies detected across regional surveillance centers."""
    predictions = get_ai_outbreak_predictions()
    anomalies = [
        {
            "id": item["numeric_id"],
            "location": item["city"],
            "disease": item["disease"],
            "risk_score": item["risk_score"],
            "outbreak_risk": f"{item['risk_score']}%",
            "outbreak_probability": f"{item['outbreak_probability_pct']}%",
            "caseload_share": f"{item['caseload_share_pct']}%",
            "severity": item["risk_level"],
            "z_score": item["z_score"],
            "growth_rate": f"+{item['growth_rate_pct']}%",
            "finding": f"Significant statistical surge (+{item['growth_rate_pct']}%, +{item['z_score']}σ deviation). District accounts for {item['caseload_share_pct']}% regional burden.",
            "explanation": item["ai_explanation"],
        }
        for item in predictions if item["z_score"] >= 1.5 or item["risk_score"] >= 60
    ]
    return {"data_status": "LIVE_SURVEILLANCE_AI", "count": len(anomalies), "signals": anomalies}


@app.get("/api/map/risk-zones", tags=["Map"])
def get_risk_zones():
    """Geographical risk markers computed from verified surveillance and climate indices."""
    zones = get_ai_risk_zones()
    return {"count": len(zones), "data_status": "LIVE_SURVEILLANCE_AI", "zones": zones}


# -------------------- AI OUTBREAK PREDICTION ENGINE --------------------
@app.get("/api/predictions/outbreaks", tags=["AI Engine"])
def predict_outbreaks():
    """
    AI/ML Outbreak Prediction Endpoint.
    Analyzes multi-week epidemiological surveillance data, calculates Z-Scores,
    growth velocities, and baseline deviations to forecast outbreak hotspots and projected cases.
    """
    predictions = get_ai_outbreak_predictions()
    return {
        "data_status": "LIVE_SURVEILLANCE_AI",
        "model": "AI-HealthMap-ZScore-Anomaly-v2.1",
        "evaluated_locations": len(predictions),
        "high_probability_outbreaks": sum(1 for p in predictions if p["outbreak_probability_pct"] >= 60),
        "predictions": predictions,
    }


# -------------------- ALERTS (AI SURVEILLANCE GENERATED) --------------------
@app.get("/api/alerts", tags=["Alerts"])
def get_alerts():
    """Live public-health alerts generated dynamically by the AI outbreak detection engine."""
    alerts = get_alerts_list()
    return {"count": len(alerts), "data_status": "LIVE_SURVEILLANCE_AI", "alerts": alerts}


@app.get("/api/alerts/{alert_id}", tags=["Alerts"])
def get_alert(alert_id: int):
    for alert in get_alerts_list():
        if alert["id"] == alert_id:
            return alert
    raise HTTPException(status_code=404, detail="Alert not found")


@app.patch("/api/alerts/{alert_id}/acknowledge", tags=["Alerts"])
def acknowledge_alert(alert_id: int):
    updated = update_alert_lifecycle(alert_id, "acknowledge")
    if updated is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"message": "Alert acknowledged successfully", "alert": updated}


@app.patch("/api/alerts/{alert_id}/resolve", tags=["Alerts"])
def resolve_alert(alert_id: int):
    updated = update_alert_lifecycle(alert_id, "resolve")
    if updated is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"message": "Alert resolved successfully", "alert": updated}


# -------------------- DATA SOURCES / SYSTEM STATUS --------------------
@app.get("/api/data-sources")
def data_sources():
    return {"active": 4, "data_status": "CONFIGURATION_DEMO", "sources": [
        {"id": 1, "name": "Government Health Reports", "status": "Demo configuration"},
        {"id": 2, "name": "Hospital Reports", "status": "Demo configuration"},
        {"id": 3, "name": "Laboratory Reports", "status": "Demo configuration"},
        {"id": 4, "name": "Public Health Surveillance", "status": "Demo configuration"},
    ]}


@app.get("/api/system/status")
def system_status():
    stats = get_location_statistics()
    return {"status": "Operational", "api": "Online", "database": "Demo Mode",
            "ai_engine": "Demo Mode",
            "geographic_data": {
                "states": stats["states"], "union_territories": stats["union_territories"],
                "regions": stats["total_regions"], "districts": stats["districts"],
                "subdistricts": stats["subdistricts"], "towns": stats["towns"],
                "villages": stats["villages"],
            },
            "data_status": {"districts": "MASTER_GEOGRAPHIC_DATA",
                            "subdistricts": "HISTORICAL_REFERENCE",
                            "towns": "HISTORICAL_REFERENCE",
                            "villages": "HISTORICAL_REFERENCE",
                            "disease_risk": "DEMO"},
            "last_updated": _now()}


# -------------------- WEATHER & OUTBREAK RISK APIs --------------------
@app.get("/api/weather/cities", tags=["Weather"])
def weather_cities():
    """Return list of predefined Indian surveillance cities for weather selection."""
    cities = get_city_list()
    return {"count": len(cities), "cities": cities}


@app.get("/api/weather", tags=["Weather"])
def weather_api(
    city: Optional[str] = Query(default=None, description="City name (e.g. Lucknow, Kanpur, Varanasi)"),
    latitude: Optional[float] = Query(default=None, description="Latitude coordinate"),
    longitude: Optional[float] = Query(default=None, description="Longitude coordinate"),
):
    """
    Fetch real-time weather, 7-day forecast, and environmental outbreak risk analysis.
    Supports querying by city name or direct latitude/longitude.
    """
    city_name = None
    if city:
        resolved = resolve_city_coordinates(city)
        if resolved:
            latitude = resolved["latitude"]
            longitude = resolved["longitude"]
            city_name = resolved["city"]
        else:
            city_name = city.strip().title()

    if latitude is None or longitude is None:
        # Default capital reference (Lucknow, UP)
        latitude = 26.8467
        longitude = 80.9462
        if not city_name:
            city_name = "Lucknow"

    try:
        return get_weather(latitude, longitude, city_name=city_name)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

