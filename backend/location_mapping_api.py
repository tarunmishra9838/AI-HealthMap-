import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/geography", tags=["Geography"])

DATA = Path(__file__).parent / "data"


def load_json(filename):
    path = DATA / filename
    if not path.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Data file not found: {filename}"
        )

    with open(path, encoding="utf-8") as file:
        return json.load(file)


def code(row, *keys):
    for key in keys:
        value = row.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def matches(row, state_code, district_code, subdistrict_code=None):
    if code(row, "state_code", "State Code") != state_code:
        return False

    if code(row, "district_code", "District Code") != district_code:
        return False

    if subdistrict_code is not None:
        actual = code(
            row,
            "sub_district_code",
            "subdistrict_code",
            "Sub-District Code",
            "Sub District Code"
        )
        return actual == subdistrict_code

    return True


@router.get("/mapping/summary")
def mapping_summary():
    mapping = load_json("india-location-mapping.json")
    return {
        "status": "success",
        "data_status": mapping.get(
            "data_status", "HISTORICAL_REFERENCE"
        ),
        "summary": mapping.get("summary", {})
    }


@router.get("/states/{state_code}/districts/{district_code}/subdistricts")
def get_mapped_subdistricts(state_code: str, district_code: str):
    mapping = load_json("india-location-mapping.json")

    results = [
        item for item in mapping.get("subdistricts", [])
        if item.get("state_code") == state_code
        and item.get("district_code") == district_code
    ]

    return {
        "status": "success",
        "data_status": "HISTORICAL_REFERENCE",
        "count": len(results),
        "data": results
    }


@router.get(
    "/states/{state_code}/districts/{district_code}"
    "/subdistricts/{subdistrict_code}/towns"
)
def get_mapped_towns(
    state_code: str,
    district_code: str,
    subdistrict_code: str
):
    towns = load_json("india-towns.json")
    results = [
        row for row in towns
        if matches(row, state_code, district_code, subdistrict_code)
    ]

    return {
        "status": "success",
        "data_status": "HISTORICAL_REFERENCE",
        "count": len(results),
        "data": results
    }


@router.get(
    "/states/{state_code}/districts/{district_code}"
    "/subdistricts/{subdistrict_code}/villages"
)
def get_mapped_villages(
    state_code: str,
    district_code: str,
    subdistrict_code: str
):
    villages = load_json("india-villages.json")
    results = [
        row for row in villages
        if matches(row, state_code, district_code, subdistrict_code)
    ]

    return {
        "status": "success",
        "data_status": "HISTORICAL_REFERENCE",
        "count": len(results),
        "data": results
    }