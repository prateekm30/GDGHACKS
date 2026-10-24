#!/usr/bin/env python3
"""Build public/data/buildings.json and src/data/limits.2026.json from official HUD sources.

No scraping: every source is a public query API or a published file.
Standard library only, so it runs anywhere with Python 3.10+.

    python3 data/build.py --inspect      # print the fields each source returns, then stop
    python3 data/build.py                # write buildings.json (and limits, if HUD_USER_TOKEN is set)

Field names and code values marked VERIFY come from the HUD data dictionaries but have not been
checked against a live response yet. Run --inspect first and fix the mapping if a field is missing.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_BUILDINGS = ROOT / "public" / "data" / "buildings.json"
OUT_LIMITS = ROOT / "src" / "data" / "limits.2026.json"
STATIONS = ROOT / "data" / "metro_stations.geojson"  # WMATA stations, see data/README.md

LIHTC_URL = "https://services1.arcgis.com/9lDFdeC4JIBgML6L/ArcGIS/rest/services/LIHTC/FeatureServer/0"
MULTIFAMILY_URL = "https://egis.hud.gov/arcgis/rest/services/gotit/MultifamilyProperties/MapServer/0"
HUD_USER_API = "https://www.huduser.gov/hudapi/public"
DC_METRO_ENTITY = "METRO47900M47900"  # Washington-Arlington-Alexandria HUD Metro FMR Area. VERIFY

LIHTC_FIELDS = ["HUD_ID", "PROJECT", "PROJ_ADD", "PROJ_CTY", "PROJ_ST", "PROJ_ZIP", "N_UNITS", "LI_UNITS",
                "INC_CEIL", "YR_PIS", "TRGT_ELD", "TRGT_DIS", "CONTACT", "COMPANY", "CO_TEL"]
MF_FIELDS = ["PROPERTY_ID", "PROPERTY_NAME_TEXT", "ADDRESS_LINE1_TEXT", "STD_CITY", "STD_ST", "STD_ZIP5",
             "TOTAL_UNIT_COUNT", "TOTAL_ASSISTED_UNIT_COUNT", "CLIENT_GROUP_TYPE"]

# Rough box around Arlington County, used together with the city name.
ARLINGTON_BOX = (-77.173, 38.827, -77.032, 38.935)  # min lon, min lat, max lon, max lat


def get_json(url: str, params: dict | None = None, headers: dict | None = None) -> dict:
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "HomePickDMV/0.1", **(headers or {})})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def query_layer(base: str, where: str) -> list[dict]:
    """Page through an ArcGIS layer. Returns attributes with lat/lon added."""
    rows, offset = [], 0
    while True:
        data = get_json(base + "/query", {
            "where": where, "outFields": "*", "outSR": 4326, "f": "json",
            "resultOffset": offset, "resultRecordCount": 1000,
        })
        if "error" in data:
            sys.exit(f"ArcGIS error from {base}: {data['error']}")
        feats = data.get("features", [])
        for f in feats:
            a = dict(f["attributes"])
            g = f.get("geometry") or {}
            a["_lon"], a["_lat"] = g.get("x"), g.get("y")
            rows.append(a)
        if not data.get("exceededTransferLimit") or not feats:
            return rows
        offset += len(feats)


def check_fields(name: str, rows: list[dict], expected: list[str]) -> None:
    if not rows:
        sys.exit(f"{name}: no rows returned. Check the where clause.")
    missing = [f for f in expected if f not in rows[0]]
    if missing:
        print(f"{name}: fields not found {missing}. Available: {sorted(rows[0])}", file=sys.stderr)
        sys.exit("Fix the field mapping in data/build.py (run --inspect).")


def num(v) -> int | None:
    try:
        n = int(float(v))
    except (TypeError, ValueError):
        return None
    return None if n < 0 or n in (8888, 9999) else n  # HUD uses 8888/9999 for missing


def clean(v) -> str | None:
    s = str(v).strip() if v is not None else ""
    return s or None


def in_arlington(row: dict, city_field: str) -> bool:
    city = (row.get(city_field) or "").upper()
    lon, lat = row.get("_lon"), row.get("_lat")
    in_box = lon is not None and ARLINGTON_BOX[0] <= lon <= ARLINGTON_BOX[2] and ARLINGTON_BOX[1] <= lat <= ARLINGTON_BOX[3]
    return "ARLINGTON" in city and in_box


def area_of(state: str, row: dict, city_field: str) -> str | None:
    if state == "DC":
        return "DC"
    if state == "VA" and in_arlington(row, city_field):
        return "ARLINGTON"
    return None


def miles(lat1, lon1, lat2, lon2) -> float:
    r = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def load_stations() -> list[tuple[float, float]]:
    if not STATIONS.exists():
        print(f"No {STATIONS.name}; metroMiles will be null. See data/README.md.", file=sys.stderr)
        return []
    gj = json.loads(STATIONS.read_text())
    return [(f["geometry"]["coordinates"][1], f["geometry"]["coordinates"][0]) for f in gj["features"]]


def nearest_metro(lat, lon, stations) -> float | None:
    if lat is None or not stations:
        return None
    return round(min(miles(lat, lon, s[0], s[1]) for s in stations), 1)


def lihtc_building(a: dict, today: str) -> dict | None:
    state = (a.get("PROJ_ST") or "").upper()
    area = area_of(state, a, "PROJ_CTY")
    if not area:
        return None
    # INC_CEIL codes: 1 = 50% AMGI, 2 = 60% AMGI, 3 = income averaging. VERIFY against the data dictionary.
    ceiling = {1: 50, 2: 60, 3: "avg"}.get(num(a.get("INC_CEIL")))
    bedrooms = [n for n in range(5) if (num(a.get(f"N_{n}BR")) or 0) > 0]
    return {
        "id": f"lihtc-{a['HUD_ID']}",
        "name": clean(a.get("PROJECT")) or "Unnamed property",
        "address": clean(a.get("PROJ_ADD")) or "",
        "city": (clean(a.get("PROJ_CTY")) or "").title(),
        "state": state,
        "zip": str(a.get("PROJ_ZIP") or "")[:5],
        "area": area,
        "lat": a["_lat"], "lon": a["_lon"],
        "program": "LIHTC",
        "totalUnits": num(a.get("N_UNITS")),
        "affordableUnits": num(a.get("LI_UNITS")),
        "incomeCeiling": ceiling,
        "bedrooms": bedrooms,
        "yearPlacedInService": num(a.get("YR_PIS")),
        "seniorOnly": num(a.get("TRGT_ELD")) == 1,  # VERIFY: 1 = yes
        "disabilityOnly": num(a.get("TRGT_DIS")) == 1,
        "metroMiles": None,
        "contact": {"name": clean(a.get("CONTACT")), "org": clean(a.get("COMPANY")),
                    "phone": clean(a.get("CO_TEL")), "email": None},
        "source": {"dataset": "HUD LIHTC Database", "url": LIHTC_URL, "retrieved": today},
    }


def mf_building(a: dict, today: str) -> dict | None:
    state = (a.get("STD_ST") or "").upper()
    area = area_of(state, a, "STD_CITY")
    if not area:
        return None
    group = (a.get("CLIENT_GROUP_TYPE") or "").lower()
    return {
        "id": f"hud-{a['PROPERTY_ID']}",
        "name": clean(a.get("PROPERTY_NAME_TEXT")) or "Unnamed property",
        "address": clean(a.get("ADDRESS_LINE1_TEXT")) or "",
        "city": (clean(a.get("STD_CITY")) or "").title(),
        "state": state,
        "zip": str(a.get("STD_ZIP5") or "")[:5],
        "area": area,
        "lat": a["_lat"], "lon": a["_lon"],
        "program": "HUD",
        "totalUnits": num(a.get("TOTAL_UNIT_COUNT")),
        "affordableUnits": num(a.get("TOTAL_ASSISTED_UNIT_COUNT")),
        "incomeCeiling": None,
        "bedrooms": [],
        "yearPlacedInService": None,
        "seniorOnly": "elderly" in group,
        "disabilityOnly": "disabled" in group and "elderly" not in group,
        "metroMiles": None,
        "contact": {
            "name": clean(a.get("MGMT_CONTACT_FULL_NAME")),
            "org": clean(a.get("MGMT_AGENT_ORG_NAME")),
            "phone": clean(a.get("PROPERTY_ON_SITE_PHONE_NUMBER")) or clean(a.get("MGMT_CONTACT_MAIN_PHN_NBR")),
            "email": clean(a.get("MGMT_CONTACT_EMAIL_TEXT")),
        },
        "source": {"dataset": "HUD Multifamily Assisted Properties", "url": MULTIFAMILY_URL, "retrieved": today},
    }


def addr_key(b: dict) -> str:
    s = re.sub(r"[^a-z0-9 ]", "", b["address"].lower())
    s = re.sub(r"\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|place|pl)\b", "", s)
    return re.sub(r"\s+", " ", s).strip() + "|" + b["zip"]


def dedupe(buildings: list[dict]) -> list[dict]:
    """Many buildings are in both datasets. Keep the HUD row (income-based rent), fill gaps from LIHTC."""
    by_key: dict[str, dict] = {}
    for b in sorted(buildings, key=lambda b: b["program"] != "HUD"):
        k = addr_key(b)
        if k not in by_key:
            by_key[k] = b
            continue
        kept = by_key[k]
        for f in ("bedrooms", "yearPlacedInService", "totalUnits"):
            if not kept[f] and b[f]:
                kept[f] = b[f]
        kept["seniorOnly"] = kept["seniorOnly"] or b["seniorOnly"]
        kept["disabilityOnly"] = kept["disabilityOnly"] or b["disabilityOnly"]
    return list(by_key.values())


def build_buildings(inspect: bool) -> None:
    today = date.today().isoformat()
    lihtc = query_layer(LIHTC_URL, "PROJ_ST IN ('DC','VA')")
    mf = query_layer(MULTIFAMILY_URL, "STD_ST IN ('DC','VA')")
    if inspect:
        for name, rows in (("LIHTC", lihtc), ("Multifamily", mf)):
            print(f"\n{name}: {len(rows)} rows\nfields: {sorted(rows[0]) if rows else []}")
            print(json.dumps(rows[0] if rows else {}, indent=2, default=str)[:3000])
        return
    check_fields("LIHTC", lihtc, LIHTC_FIELDS)
    check_fields("Multifamily", mf, MF_FIELDS)

    rows = [b for a in lihtc if (b := lihtc_building(a, today))]
    rows += [b for a in mf if (b := mf_building(a, today))]
    rows = [b for b in dedupe(rows) if b["lat"] is not None]
    stations = load_stations()
    for b in rows:
        b["metroMiles"] = nearest_metro(b["lat"], b["lon"], stations)
    rows.sort(key=lambda b: (b["area"], b["name"]))

    OUT_BUILDINGS.write_text(json.dumps(rows, indent=1))
    by_area = {a: sum(1 for b in rows if b["area"] == a) for a in ("DC", "ARLINGTON")}
    print(f"Wrote {len(rows)} buildings to {OUT_BUILDINGS.relative_to(ROOT)}: {by_area}")


def build_limits() -> None:
    token = os.environ.get("HUD_USER_TOKEN")
    if not token:
        print("HUD_USER_TOKEN not set; leaving limits.2026.json as is.", file=sys.stderr)
        return
    auth = {"Authorization": f"Bearer {token}"}
    limits = json.loads(OUT_LIMITS.read_text())

    # Section 8 income limits. Response keys VERIFY: data.extremely_low.il30_p1 ... data.low.il80_p8
    il = get_json(f"{HUD_USER_API}/il/data/{DC_METRO_ENTITY}", headers=auth)["data"]
    limits["section8"] = {
        "30": [il["extremely_low"][f"il30_p{n}"] for n in range(1, 9)],
        "50": [il["very_low"][f"il50_p{n}"] for n in range(1, 9)],
        "80": [il["low"][f"il80_p{n}"] for n in range(1, 9)],
    }
    limits["effective"] = str(il.get("year", limits["effective"]))
    limits["sources"] = [s for s in limits["sources"] if "huduser" not in s] + [
        f"Section 8 income limits: HUD USER API il/data/{DC_METRO_ENTITY}"]
    limits["notes"] = [n for n in limits["notes"] if not n.startswith("Section 8")]

    # MTSP limits are not in the HUD USER API. Update limits.mtsp by hand from the FY2026 MTSP table
    # (https://www.huduser.gov/portal/datasets/mtsp.html) and remove the PLACEHOLDER note.
    OUT_LIMITS.write_text(json.dumps(limits, indent=2) + "\n")
    print(f"Wrote Section 8 limits to {OUT_LIMITS.relative_to(ROOT)}. MTSP still needs a manual check.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--inspect", action="store_true", help="print source fields and one row, then stop")
    args = ap.parse_args()
    build_buildings(args.inspect)
    if not args.inspect:
        build_limits()
