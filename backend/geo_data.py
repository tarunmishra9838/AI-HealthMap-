import json
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"


# ============================================================
# INDIA - 28 STATES + 8 UNION TERRITORIES
# ============================================================

INDIA_REGIONS = [
    {"id": "AP", "name": "Andhra Pradesh", "type": "state"},
    {"id": "AR", "name": "Arunachal Pradesh", "type": "state"},
    {"id": "AS", "name": "Assam", "type": "state"},
    {"id": "BR", "name": "Bihar", "type": "state"},
    {"id": "CG", "name": "Chhattisgarh", "type": "state"},
    {"id": "GA", "name": "Goa", "type": "state"},
    {"id": "GJ", "name": "Gujarat", "type": "state"},
    {"id": "HR", "name": "Haryana", "type": "state"},
    {"id": "HP", "name": "Himachal Pradesh", "type": "state"},
    {"id": "JH", "name": "Jharkhand", "type": "state"},
    {"id": "KA", "name": "Karnataka", "type": "state"},
    {"id": "KL", "name": "Kerala", "type": "state"},
    {"id": "MP", "name": "Madhya Pradesh", "type": "state"},
    {"id": "MH", "name": "Maharashtra", "type": "state"},
    {"id": "MN", "name": "Manipur", "type": "state"},
    {"id": "ML", "name": "Meghalaya", "type": "state"},
    {"id": "MZ", "name": "Mizoram", "type": "state"},
    {"id": "NL", "name": "Nagaland", "type": "state"},
    {"id": "OD", "name": "Odisha", "type": "state"},
    {"id": "PB", "name": "Punjab", "type": "state"},
    {"id": "RJ", "name": "Rajasthan", "type": "state"},
    {"id": "SK", "name": "Sikkim", "type": "state"},
    {"id": "TN", "name": "Tamil Nadu", "type": "state"},
    {"id": "TS", "name": "Telangana", "type": "state"},
    {"id": "TR", "name": "Tripura", "type": "state"},
    {"id": "UP", "name": "Uttar Pradesh", "type": "state"},
    {"id": "UK", "name": "Uttarakhand", "type": "state"},
    {"id": "WB", "name": "West Bengal", "type": "state"},

    {"id": "AN", "name": "Andaman and Nicobar Islands", "type": "union_territory"},
    {"id": "CH", "name": "Chandigarh", "type": "union_territory"},
    {"id": "DN", "name": "Dadra and Nagar Haveli and Daman and Diu", "type": "union_territory"},
    {"id": "DL", "name": "Delhi", "type": "union_territory"},
    {"id": "JK", "name": "Jammu and Kashmir", "type": "union_territory"},
    {"id": "LA", "name": "Ladakh", "type": "union_territory"},
    {"id": "LD", "name": "Lakshadweep", "type": "union_territory"},
    {"id": "PY", "name": "Puducherry", "type": "union_territory"},
]


# Census 2011 state codes
CENSUS_STATE_CODES = {
    "01": "JK",
    "02": "HP",
    "03": "PB",
    "04": "CH",
    "05": "UK",
    "06": "HR",
    "07": "DL",
    "08": "RJ",
    "09": "UP",
    "10": "BR",
    "11": "SK",
    "12": "AR",
    "13": "NL",
    "14": "MN",
    "15": "MZ",
    "16": "TR",
    "17": "ML",
    "18": "AS",
    "19": "WB",
    "20": "JH",
    "21": "OD",
    "22": "CG",
    "23": "MP",
    "24": "GJ",
    "26": "DN",
    "27": "MH",
    "28": "AP",
    "29": "KA",
    "30": "GA",
    "31": "LD",
    "32": "KL",
    "33": "TN",
    "34": "PY",
    "35": "AN",
    "36": "TS",
    "37": "LA",
}


def _load_json(filename, default):
    path = DATA_DIR / filename

    if not path.exists():
        return default

    try:
        with path.open("r", encoding="utf-8") as file:
            return json.load(file)
    except Exception:
        return default


# ============================================================
# REGION FUNCTIONS
# ============================================================

def get_all_regions():
    return INDIA_REGIONS


def get_region_by_id(region_id):
    for region in INDIA_REGIONS:
        if region["id"] == region_id:
            return region
    return None


# ============================================================
# DISTRICTS
# ============================================================

def load_district_source():
    data = _load_json("india-states-districts-latest.json", [])

    if isinstance(data, list):
        return data

    return []


def load_districts():
    source = load_district_source()
    districts = []

    for state_item in source:
        state_name = state_item.get("state")
        district_names = state_item.get("districts", [])

        if not state_name:
            continue

        state_id = None

        for region in INDIA_REGIONS:
            if region["name"].strip().lower() == state_name.strip().lower():
                state_id = region["id"]
                break

        if not state_id:
            continue

        for index, district_name in enumerate(district_names, start=1):
            districts.append({
                "id": f"{state_id}-D{index:03d}",
                "state_id": state_id,
                "state_name": state_name,
                "district_name": district_name,
                "data_status": "VERIFIED_DATA_AVAILABLE",
                "source": "State-District reference dataset"
            })

    return districts


def get_districts_by_state(state_id):
    return [
        district
        for district in load_districts()
        if district["state_id"] == state_id
    ]


def get_district_by_id(state_id, district_id):
    districts = get_districts_by_state(state_id)

    for district in districts:
        if district["id"] == district_id:
            return district

    return None


# ============================================================
# SUB-DISTRICTS
# ============================================================

def load_subdistricts():
    data = _load_json("india-subdistricts.json", [])

    if not isinstance(data, list):
        return []

    result = []

    for item in data:
        state_code = str(item.get("state_code", "")).strip().zfill(2)
        district_code = str(item.get("district_code", "")).strip().zfill(3)
        subdistrict_code = str(
            item.get("subdistrict_code", "")
        ).strip().zfill(5)

        state_id = CENSUS_STATE_CODES.get(state_code)

        if not state_id:
            continue

        result.append({
            "id": f"CENSUS-SD-{state_code}-{district_code}-{subdistrict_code}",
            "state_id": state_id,
            "state_code": state_code,
            "district_code": district_code,
            "subdistrict_code": subdistrict_code,
            "subdistrict_name": item.get("subdistrict_name"),
            "source": item.get(
                "source",
                "Census 2011"
            ),
            "data_status": item.get(
                "data_status",
                "HISTORICAL_REFERENCE"
            )
        })

    return result


def get_subdistricts_by_state(state_id):
    return [
        item
        for item in load_subdistricts()
        if item["state_id"] == state_id
    ]


def get_subdistricts_by_district(
    state_id,
    district_id
):
    """
    Current district IDs are based on the current district
    reference dataset.

    Census 2011 district codes cannot safely be mapped to
    current district IDs without an authoritative crosswalk.

    Therefore this function currently returns an empty list
    rather than creating a potentially incorrect mapping.
    """

    district = get_district_by_id(
        state_id,
        district_id
    )

    if district is None:
        return None

    return []


# ============================================================
# TOWNS
# ============================================================

def load_towns():
    data = _load_json("india-towns.json", [])

    if not isinstance(data, list):
        return []

    towns = []

    for item in data:
        state_code = str(
            item.get("state_code", "")
        ).strip().zfill(2)

        state_id = CENSUS_STATE_CODES.get(state_code)

        if not state_id:
            continue

        towns.append({
            **item,
            "state_id": state_id,
            "data_status": "HISTORICAL_REFERENCE"
        })

    return towns


def get_towns_by_district(
    state_id,
    district_id
):
    district = get_district_by_id(
        state_id,
        district_id
    )

    if district is None:
        return None

    return []


# ============================================================
# VILLAGES
# ============================================================

def load_villages():
    data = _load_json("india-villages.json", [])

    if not isinstance(data, list):
        return []

    villages = []

    for item in data:
        state_code = str(
            item.get("state_code", "")
        ).strip().zfill(2)

        state_id = CENSUS_STATE_CODES.get(state_code)

        if not state_id:
            continue

        villages.append({
            **item,
            "state_id": state_id,
            "data_status": "HISTORICAL_REFERENCE"
        })

    return villages


def get_villages(
    state_id,
    district_id
):
    district = get_district_by_id(
        state_id,
        district_id
    )

    if district is None:
        return None

    return []


# ============================================================
# LOCATION STATISTICS
# ============================================================

def get_location_statistics():
    states = [
        region
        for region in INDIA_REGIONS
        if region["type"] == "state"
    ]

    union_territories = [
        region
        for region in INDIA_REGIONS
        if region["type"] == "union_territory"
    ]

    districts = load_districts()
    subdistricts = load_subdistricts()
    towns = load_towns()
    villages = load_villages()

    return {
        "country": "India",
        "states": len(states),
        "union_territories": len(union_territories),
        "total_regions": len(INDIA_REGIONS),
        "districts": len(districts),
        "subdistricts": len(subdistricts),
        "towns": len(towns),
        "villages": len(villages),
        "subdistrict_data_status": "HISTORICAL_REFERENCE",
        "town_data_status": "HISTORICAL_REFERENCE",
        "village_data_status": "HISTORICAL_REFERENCE"
    }