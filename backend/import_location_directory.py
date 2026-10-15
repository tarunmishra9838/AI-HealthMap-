from pathlib import Path
from openpyxl import load_workbook
import json


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

INPUT_FILE = DATA_DIR / "PC11_TV_DIR.xlsx"
TOWNS_FILE = DATA_DIR / "india-towns.json"
VILLAGES_FILE = DATA_DIR / "india-villages.json"
STATS_FILE = DATA_DIR / "location-import-stats.json"


def clean_code(value, length):
    if value is None:
        return ""

    text = str(value).strip()

    if text.endswith(".0"):
        text = text[:-2]

    return text.zfill(length)


def clean_name(value):
    if value is None:
        return ""

    return str(value).strip()


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as file:
        json.dump(
            data,
            file,
            ensure_ascii=False,
            indent=2
        )


def main():

    if not INPUT_FILE.exists():
        print("ERROR: Census Excel file not found:")
        print(INPUT_FILE)
        return

    print("Reading Census Location Code Directory...")
    print(f"Input: {INPUT_FILE}")

    workbook = load_workbook(
        INPUT_FILE,
        read_only=True,
        data_only=True
    )

    sheet = workbook.active

    rows = sheet.iter_rows(values_only=True)

    header = next(rows)

    print("\nColumns found:")
    for column in header:
        print("-", column)

    towns = []
    villages = []

    total_rows = 0
    skipped_rows = 0

    for row in rows:

        total_rows += 1

        if len(row) < 5:
            skipped_rows += 1
            continue

        state_code = clean_code(row[0], 2)
        district_code = clean_code(row[1], 3)
        sub_district_code = clean_code(row[2], 5)
        location_code = clean_code(row[3], 6)
        location_name = clean_name(row[4])

        if not state_code or not district_code:
            skipped_rows += 1
            continue

        if not location_code or not location_name:
            skipped_rows += 1
            continue

        numeric_code = int(location_code)

        # Census 2011:
        # 000001 - 799999 = Village
        # 800001 - 899999 = Town
        if 800001 <= numeric_code <= 899999:

            towns.append({
                "id": f"IN-TOWN-{location_code}",
                "state_code": state_code,
                "district_code": district_code,
                "sub_district_code": sub_district_code,
                "town_code": location_code,
                "town_name": location_name,
                "type": "town",
                "source": "Census 2011 Location Code Directory"
            })

        elif 1 <= numeric_code <= 799999:

            villages.append({
                "id": f"IN-VILLAGE-{location_code}",
                "state_code": state_code,
                "district_code": district_code,
                "sub_district_code": sub_district_code,
                "village_code": location_code,
                "village_name": location_name,
                "type": "village",
                "source": "Census 2011 Location Code Directory"
            })

        else:
            skipped_rows += 1

    workbook.close()

    print("\nSaving data...")

    save_json(TOWNS_FILE, towns)
    save_json(VILLAGES_FILE, villages)

    statistics = {
        "source": "Census 2011 Location Code Directory",
        "total_rows": total_rows,
        "towns": len(towns),
        "villages": len(villages),
        "skipped_rows": skipped_rows
    }

    save_json(STATS_FILE, statistics)

    print("\n================================")
    print("IMPORT COMPLETED")
    print("================================")

    print(f"Total rows:    {total_rows}")
    print(f"Towns:         {len(towns)}")
    print(f"Villages:      {len(villages)}")
    print(f"Skipped rows:  {skipped_rows}")

    print("\nGenerated files:")

    print(TOWNS_FILE)
    print(VILLAGES_FILE)
    print(STATS_FILE)


if __name__ == "__main__":
    main()