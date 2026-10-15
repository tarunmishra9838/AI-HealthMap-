
import json
from pathlib import Path
from collections import defaultdict

DATA = Path(__file__).parent / "data"


def load(filename):
    with open(DATA / filename, encoding="utf-8") as f:
        return json.load(f)


def field(row, *names):
    for name in names:
        value = row.get(name)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def location_key(row):
    state = field(row, "state_code", "State Code")
    district = field(row, "district_code", "District Code")
    subdistrict = field(
        row, "sub_district_code", "subdistrict_code",
        "Sub-District Code", "Sub District Code"
    )
    if not state or not district or not subdistrict:
        return None
    return state, district, subdistrict


def main():
    subdistricts = load("india-subdistricts.json")
    towns = load("india-towns.json")
    villages = load("india-villages.json")

    hierarchy = {}

    for item in subdistricts:
        key = location_key(item)
        if not key:
            continue

        hierarchy[key] = {
            "state_code": key[0],
            "district_code": key[1],
            "sub_district_code": key[2],
            "sub_district_name": field(
                item, "sub_district_name", "subdistrict_name",
                "name", "Sub-District Name", "Sub District Name"
            ),
            "town_ids": [],
            "village_ids": []
        }

    unmatched_towns = 0
    unmatched_villages = 0

    for item in towns:
        key = location_key(item)
        if key in hierarchy:
            hierarchy[key]["town_ids"].append(
                field(item, "id", "town_code", "Town-Village Code")
            )
        else:
            unmatched_towns += 1

    for item in villages:
        key = location_key(item)
        if key in hierarchy:
            hierarchy[key]["village_ids"].append(
                field(item, "id", "village_code", "Town-Village Code")
            )
        else:
            unmatched_villages += 1

    output = {
        "source": "Census 2011 Location Code Directory",
        "data_status": "HISTORICAL_REFERENCE",
        "mapping_method": "State + District + Sub-District codes",
        "subdistricts": list(hierarchy.values()),
        "summary": {
            "subdistrict_records": len(subdistricts),
            "mapped_subdistricts": len(hierarchy),
            "town_records": len(towns),
            "villages_records": len(villages),
            "mapped_towns": len(towns) - unmatched_towns,
            "unmatched_towns": unmatched_towns,
            "mapped_villages": len(villages) - unmatched_villages,
            "unmatched_villages": unmatched_villages
        }
    }

    output_file = DATA / "india-location-mapping.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False)

    print(json.dumps(output["summary"], indent=2))
    print(f"\nMapping saved: {output_file}")


if __name__ == "__main__":
    main()
