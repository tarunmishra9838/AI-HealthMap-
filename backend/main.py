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


# -------------------- DEMO DATA --------------------
alerts = [
    {"id": 1, "disease": "Dengue", "location": "Lucknow", "score": 86, "level": "Critical", "reason": "Cases significantly above historical baseline", "status": "New", "created_at": "2026-10-07T09:00:00", "data_status": "DEMO"},
    {"id": 2, "disease": "Influenza", "location": "Kanpur", "score": 72, "level": "High", "reason": "Rapid increase detected in recent reports", "status": "Investigating", "created_at": "2026-10-07T08:30:00", "data_status": "DEMO"},
    {"id": 3, "disease": "Malaria", "location": "Varanasi", "score": 61, "level": "High", "reason": "Unusual activity across nearby locations", "status": "Acknowledged", "created_at": "2026-10-07T08:00:00", "data_status": "DEMO"},
    {"id": 4, "disease": "Dengue", "location": "Prayagraj", "score": 58, "level": "Medium", "reason": "Recent activity is above expected weekly range", "status": "New", "created_at": "2026-10-07T07:30:00", "data_status": "DEMO"},
]
risk_zones = [
    {"id": 1, "location": "Lucknow", "latitude": 26.8467, "longitude": 80.9462, "risk_score": 86, "risk_level": "Critical", "disease": "Dengue", "data_status": "DEMO"},
    {"id": 2, "location": "Kanpur", "latitude": 26.4499, "longitude": 80.3319, "risk_score": 72, "risk_level": "High", "disease": "Influenza", "data_status": "DEMO"},
    {"id": 3, "location": "Varanasi", "latitude": 25.3176, "longitude": 82.9739, "risk_score": 61, "risk_level": "High", "disease": "Malaria", "data_status": "DEMO"},
    {"id": 4, "location": "Prayagraj", "latitude": 25.4358, "longitude": 81.8463, "risk_score": 58, "risk_level": "Medium", "disease": "Dengue", "data_status": "DEMO"},
]
trend_data = [
    {"week": "W1", "cases": 42}, {"week": "W2", "cases": 48},
    {"week": "W3", "cases": 45}, {"week": "W4", "cases": 58},
    {"week": "W5", "cases": 55}, {"week": "W6", "cases": 67},
    {"week": "W7", "cases": 64}, {"week": "W8", "cases": 74},
    {"week": "W9", "cases": 69}, {"week": "W10", "cases": 82},
    {"week": "W11", "cases": 78}, {"week": "W12", "cases": 88},
]


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


# -------------------- ANALYTICS / MAP (DEMO DATA) --------------------
@app.get("/api/analytics/summary")
def analytics_summary():
    return {"data_status": "DEMO", "total_cases": 12846,
            "active_alerts": sum(1 for x in alerts if x["status"] != "Resolved"),
            "high_risk_areas": sum(1 for x in risk_zones if x["risk_score"] >= 60),
            "risk_score": 64, "case_change": "+8.4%", "alert_change": "+3",
            "risk_area_change": "+2", "risk_level": "Medium"}


@app.get("/api/analytics/trends")
def disease_trends():
    return {"data_status": "DEMO", "period": "12 weeks", "change": "+14.8%",
            "status": "Elevated activity", "data": trend_data}


@app.get("/api/analytics/anomalies")
def analytics_anomalies():
    return {"data_status": "DEMO", "signals": [
        {"id": 1, "location": "Lucknow", "disease": "Dengue", "risk_score": 86,
         "severity": "Critical", "finding": "Activity is significantly above the historical baseline.",
         "explanation": "Prototype signal only; requires validated surveillance data."},
        {"id": 2, "location": "Kanpur", "disease": "Influenza", "risk_score": 72,
         "severity": "High", "finding": "Rapid increase detected in recent reports.",
         "explanation": "Prototype signal only; requires validated surveillance data."},
    ]}


@app.get("/api/map/risk-zones")
def get_risk_zones():
    return {"count": len(risk_zones), "data_status": "DEMO",
            "message": "Risk values are prototype/demo values, not real disease surveillance data.",
            "zones": risk_zones}


# -------------------- ALERTS (IN-MEMORY DEMO) --------------------
@app.get("/api/alerts")
def get_alerts():
    return {"count": len(alerts), "data_status": "DEMO", "alerts": alerts}


@app.get("/api/alerts/{alert_id}")
def get_alert(alert_id: int):
    for alert in alerts:
        if alert["id"] == alert_id:
            return alert
    raise HTTPException(status_code=404, detail="Alert not found")


@app.patch("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int):
    for alert in alerts:
        if alert["id"] == alert_id:
            alert["status"] = "Acknowledged"
            return {"message": "Alert acknowledged successfully", "alert": alert}
    raise HTTPException(status_code=404, detail="Alert not found")


@app.patch("/api/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int):
    for alert in alerts:
        if alert["id"] == alert_id:
            alert["status"] = "Resolved"
            return {"message": "Alert resolved successfully", "alert": alert}
    raise HTTPException(status_code=404, detail="Alert not found")


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


# Run in backend terminal: uvicorn main:app --reload