import json
import csv
from pathlib import Path


# =========================================================
# AI HealthMap
# District Data Preparation
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"

SOURCE_FILE = DATA_DIR / "lgd-districts.csv"

OUTPUT_FILE = DATA_DIR / "india-districts.json"


def clean_text(value):
    """Clean empty spaces and convert values to string."""
    if value is None:
        return ""

    return str(value).strip()


def prepare_district_data():

    if not SOURCE_FILE.exists():
        print()
        print("ERROR: LGD district source file not found.")
        print()
        print("Expected file:")
        print(SOURCE_FILE)
        print()
        print(
            "Download the official LGD District dataset "
            "from data.gov.in and save it as:"
        )
        print()
        print("backend/data/lgd-districts.csv")
        print()
        return

    districts = []

    with open(
        SOURCE_FILE,
        "r",
        encoding="utf-8-sig",
        newline=""
    ) as file:

        reader = csv.DictReader(file)

        print("Detected columns:")
        print(reader.fieldnames)
        print()

        for row in reader:

            # Try common LGD column names
            district_id = (
                row.get("district_code")
                or row.get("District Code")
                or row.get("District LGD Code")
                or row.get("district_lgd_code")
                or ""
            )

            district_name = (
                row.get("district_name")
                or row.get("District Name")
                or row.get("District")
                or ""
            )

            state_id = (
                row.get("state_code")
                or row.get("State Code")
                or row.get("State LGD Code")
                or row.get("state_lgd_code")
                or ""
            )

            state_name = (
                row.get("state_name")
                or row.get("State Name")
                or row.get("State")
                or ""
            )

            district_id = clean_text(district_id)
            district_name = clean_text(district_name)
            state_id = clean_text(state_id)
            state_name = clean_text(state_name)

            if not district_name:
                continue

            districts.append(
                {
                    "district_id": district_id,
                    "district_name": district_name,
                    "state_id": state_id,
                    "state_name": state_name,
                    "sub_districts": [],
                    "blocks": [],
                    "towns": [],
                    "villages": [],
                }
            )

    # Remove duplicate district records
    unique_districts = {}

    for district in districts:

        key = (
            district["state_id"],
            district["district_id"],
            district["district_name"].lower(),
        )

        unique_districts[key] = district

    districts = list(unique_districts.values())

    # Sort by state and district
    districts.sort(
        key=lambda item: (
            item["state_name"].lower(),
            item["district_name"].lower(),
        )
    )

    output = {
        "country": "India",
        "source": "Local Government Directory (LGD)",
        "source_organization": "Ministry of Panchayati Raj",
        "data_type": "district_master",
        "district_count": len(districts),
        "districts": districts,
    }

    with open(
        OUTPUT_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            output,
            file,
            ensure_ascii=False,
            indent=2
        )

    print()
    print("==========================================")
    print("District data preparation completed")
    print("==========================================")
    print()
    print(f"Total districts: {len(districts)}")
    print()
    print(f"Output file:")
    print(OUTPUT_FILE)
    print()


if __name__ == "__main__":
    prepare_district_data()