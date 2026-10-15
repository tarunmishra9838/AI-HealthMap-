import json
from pathlib import Path
import openpyxl

BASE_DIR = Path(__file__).resolve().parent
INPUT_FILE = BASE_DIR / "data" / "census-subdistricts.xlsx"
OUTPUT_FILE = BASE_DIR / "data" / "india-subdistricts.json"


def main():
    print("Reading Census Sub-District file...")

    wb = openpyxl.load_workbook(
        INPUT_FILE,
        read_only=True,
        data_only=True
    )

    ws = wb["Sheet1"]

    subdistricts = {}
    scanned_rows = 0

    for row in ws.iter_rows():
        scanned_rows += 1

        if len(row) < 5:
            continue

        state_code = row[0].value
        district_code = row[1].value
        subdistrict_code = row[2].value
        record_type = row[3].value
        subdistrict_name = row[4].value

        if not all([
            state_code,
            district_code,
            subdistrict_code,
            record_type,
            subdistrict_name
        ]):
            continue

        record_type = str(record_type).strip().upper()

        if record_type != "SUB-DISTRICT":
            continue

        state_code = str(state_code).strip().zfill(2)
        district_code = str(district_code).strip().zfill(3)
        subdistrict_code = str(subdistrict_code).strip().zfill(5)
        subdistrict_name = str(subdistrict_name).strip()

        key = (
            state_code,
            district_code,
            subdistrict_code
        )

        subdistricts[key] = {
            "state_code": state_code,
            "district_code": district_code,
            "subdistrict_code": subdistrict_code,
            "subdistrict_name": subdistrict_name,
            "source": "Census 2011 A-1",
            "data_status": "HISTORICAL_REFERENCE"
        }

    result = sorted(
        subdistricts.values(),
        key=lambda x: (
            x["state_code"],
            x["district_code"],
            x["subdistrict_code"]
        )
    )

    OUTPUT_FILE.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    print()
    print("Sub-District import completed.")
    print(f"Rows scanned: {scanned_rows}")
    print(f"Sub-Districts: {len(result)}")
    print(f"Output: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()