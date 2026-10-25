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
STATIONS = ROOT / "data" / "metro_stations.geojson"

LIHTC_URL = "https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/LIHTC/FeatureServer/0"
MULTIFAMILY_URL = "https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/MULTIFAMILY_PROPERTIES_ASSISTED/FeatureServer/0"
STATIONS_URL = "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Transportation_Rail_Bus_WebMercator/MapServer/51"
# Every county and city in HUD's Washington-Arlington-Alexandria, DC-VA-MD HUD Metro FMR Area, so one table of
# income limits applies to all of them. Grouped into the areas people pick from.
COUNTIES = {
    "11001": "DC",
    "24031": "MONTGOMERY", "24033": "PRINCE_GEORGES", "24021": "FREDERICK",
    "24017": "SOUTHERN_MD", "24009": "SOUTHERN_MD",
    "51013": "ARLINGTON", "51510": "ALEXANDRIA",
    "51059": "FAIRFAX", "51600": "FAIRFAX", "51610": "FAIRFAX",
    "51107": "LOUDOUN",
    "51153": "PRINCE_WILLIAM", "51683": "PRINCE_WILLIAM", "51685": "PRINCE_WILLIAM",
    "51179": "FREDERICKSBURG", "51177": "FREDERICKSBURG", "51630": "FREDERICKSBURG",
    "51061": "FAUQUIER_CLARKE", "51043": "FAUQUIER_CLARKE",
}
WHERE = "COUNTY_LEVEL IN (" + ",".join(f"'{c}'" for c in COUNTIES) + ")"
OUT_MAP = ROOT / "public" / "data" / "dmv-map.json"
TIGER_COUNTIES = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer"
HUD_USER_API = "https://www.huduser.gov/hudapi/public"
DC_METRO_ENTITY = "METRO47900M47900"  # Washington-Arlington-Alexandria HUD Metro FMR Area. VERIFY

# Only the fields we use. The HUD layers also carry tenant demographics; we never download them (fair housing).
LIHTC_FIELDS = ["HUD_ID", "PROJECT", "PROJ_ADD", "PROJ_CTY", "PROJ_ST", "PROJ_ZIP", "N_UNITS", "LI_UNITS",
                "N_0BR", "N_1BR", "N_2BR", "N_3BR", "N_4BR", "INC_CEIL", "YR_PIS", "TRGT_FAM", "TRGT_ELD", "TRGT_DIS",
                "CONTACT", "COMPANY", "CO_TEL", "COUNTY_LEVEL", "LAT", "LON"]
MF_FIELDS = ["PROPERTY_ID", "PROPERTY_NAME_TEXT", "ADDRESS_LINE1_TEXT", "STD_CITY", "STD_ST", "STD_ZIP5",
             "TOTAL_UNIT_COUNT", "TOTAL_ASSISTED_UNIT_COUNT", "CLIENT_GROUP_NAME", "CLIENT_GROUP_TYPE",
             "PROPERTY_ON_SITE_PHONE_NUMBER", "MGMT_AGENT_ORG_NAME", "MGMT_CONTACT_FULL_NAME",
             "MGMT_CONTACT_MAIN_PHN_NBR", "MGMT_CONTACT_EMAIL_TEXT", "COUNTY_LEVEL", "LAT", "LON"]
MF_FIELDS += [f"BD{n}_CNT{c}" for n in range(5) for c in (1, 2)]




def get_json(url: str, params: dict | None = None, headers: dict | None = None) -> dict:
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "HomePickDMV/0.1", **(headers or {})})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def query_layer(base: str, where: str, fields: list[str]) -> list[dict]:
    """Page through an ArcGIS layer. Returns attributes with lat/lon added."""
    rows, offset = [], 0
    while True:
        data = get_json(base + "/query", {
            "where": where, "outFields": ",".join(fields), "outSR": 4326, "f": "json",
            "resultOffset": offset, "resultRecordCount": 1000,
        })
        if "error" in data:
            sys.exit(f"ArcGIS error from {base}: {data['error']}")
        feats = data.get("features", [])
        for f in feats:
            a = dict(f["attributes"])
            g = f.get("geometry") or {}
            a["_lon"] = a.get("LON") if a.get("LON") is not None else g.get("x")
            a["_lat"] = a.get("LAT") if a.get("LAT") is not None else g.get("y")
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


def area_of(row: dict) -> str | None:
    return COUNTIES.get(str(row.get("COUNTY_LEVEL") or "").zfill(5))


def miles(lat1, lon1, lat2, lon2) -> float:
    r = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def load_stations() -> list[tuple[float, float, str]]:
    """WMATA stations (regional layer from Open Data DC). Cached in data/ after the first run."""
    if not STATIONS.exists():
        try:
            gj = get_json(STATIONS_URL + "/query", {"where": "1=1", "outFields": "NAME", "outSR": 4326, "f": "geojson"})
            STATIONS.write_text(json.dumps(gj))
        except Exception as e:  # noqa: BLE001
            print(f"Could not load Metro stations ({e}); metroMiles will be null.", file=sys.stderr)
            return []
    gj = json.loads(STATIONS.read_text())
    return [(f["geometry"]["coordinates"][1], f["geometry"]["coordinates"][0], title(f["properties"].get("NAME") or ""))
            for f in gj["features"]]


def nearest_metro(lat, lon, stations) -> tuple[float | None, str | None]:
    if lat is None or not stations:
        return None, None
    d, name = min((miles(lat, lon, s[0], s[1]), s[2]) for s in stations)
    return round(d, 1), name or None


def build_map() -> None:
    """County outlines for the location picker, from the Census TIGERweb service. Optional: the app works without it."""
    try:
        layers = get_json(TIGER_COUNTIES, {"f": "json"})["layers"]
        layer = next(l["id"] for l in layers if l["name"].lower() == "counties")
        data = get_json(f"{TIGER_COUNTIES}/{layer}/query", {
            "where": "GEOID IN (" + ",".join(f"'{c}'" for c in COUNTIES) + ")",
            "outFields": "GEOID,NAME", "outSR": 4326, "f": "json", "returnGeometry": "true",
            "maxAllowableOffset": 0.003, "geometryPrecision": 4,
        })
        shapes = [{"fips": f["attributes"]["GEOID"], "name": f["attributes"]["NAME"],
                   "area": COUNTIES[f["attributes"]["GEOID"]], "rings": f["geometry"]["rings"]}
                  for f in data["features"]]
        OUT_MAP.write_text(json.dumps(shapes, separators=(",", ":")))
        print(f"Wrote {len(shapes)} county outlines to {OUT_MAP.relative_to(ROOT)}")
    except Exception as e:  # noqa: BLE001
        print(f"Could not build the county map ({e}); the app falls back to a list.", file=sys.stderr)


def lihtc_building(a: dict, today: str) -> dict | None:
    state = (a.get("PROJ_ST") or "").upper()
    area = area_of(a)
    if not area:
        return None
    # INC_CEIL codes: 1 = 50% AMGI, 2 = 60% AMGI, 3 = income averaging. VERIFY against the data dictionary.
    ceiling = {1: 50, 2: 60, 3: "avg"}.get(num(a.get("INC_CEIL")))
    mix = {str(n): c for n in range(5) if (c := num(a.get(f"N_{n}BR")) or 0) > 0}
    bedrooms = [int(n) for n in mix]
    fam, eld, dis = (num(a.get(f)) == 1 for f in ("TRGT_FAM", "TRGT_ELD", "TRGT_DIS"))
    return {
        "id": f"lihtc-{a['HUD_ID']}",
        "name": title(clean(a.get("PROJECT"))) or "Unnamed property",
        "address": title(clean(a.get("PROJ_ADD"))),
        "city": title(clean(a.get("PROJ_CTY"))),
        "state": state,
        "zip": str(a.get("PROJ_ZIP") or "")[:5],
        "area": area,
        "lat": a["_lat"], "lon": a["_lon"],
        "program": "LIHTC",
        "totalUnits": num(a.get("N_UNITS")),
        "affordableUnits": num(a.get("LI_UNITS")),
        "incomeCeiling": ceiling,
        "bedrooms": bedrooms,
        "unitMix": mix,
        "yearPlacedInService": num(a.get("YR_PIS")),
        # TRGT_* = 1 means the property targets that group, not that it serves only them.
        # Treat it as senior/disability-only only when it does not also target families.
        "seniorOnly": eld and not fam,
        "disabilityOnly": dis and not fam and not eld,
        "metroMiles": None,
        "metroStation": None,
        "contact": {"name": clean(a.get("CONTACT")), "org": clean(a.get("COMPANY")),
                    "phone": clean(a.get("CO_TEL")), "email": None},
        "source": {"dataset": "HUD LIHTC Database", "url": LIHTC_URL, "retrieved": today},
    }


def mf_building(a: dict, today: str) -> dict | None:
    state = (a.get("STD_ST") or "").upper()
    area = area_of(a)
    if not area:
        return None
    group_type = (a.get("CLIENT_GROUP_TYPE") or "").lower()
    group_name = (a.get("CLIENT_GROUP_NAME") or "").lower()
    mix = {str(n): c for n in range(5) if (c := (num(a.get(f"BD{n}_CNT1")) or 0) + (num(a.get(f"BD{n}_CNT2")) or 0)) > 0}
    bedrooms = [int(n) for n in mix]
    return {
        "id": f"hud-{a['PROPERTY_ID']}",
        "name": title(clean(a.get("PROPERTY_NAME_TEXT"))) or "Unnamed property",
        "address": title(clean(a.get("ADDRESS_LINE1_TEXT"))),
        "city": title(clean(a.get("STD_CITY"))),
        "state": state,
        "zip": str(a.get("STD_ZIP5") or "")[:5],
        "area": area,
        "lat": a["_lat"], "lon": a["_lon"],
        "program": "HUD",
        "totalUnits": num(a.get("TOTAL_UNIT_COUNT")),
        "affordableUnits": num(a.get("TOTAL_ASSISTED_UNIT_COUNT")),
        "incomeCeiling": None,
        "bedrooms": bedrooms,
        "unitMix": mix,
        "yearPlacedInService": None,
        # "Family & Elderly" buildings are open to families, so only "Elderly" without "family" is senior-only.
        "seniorOnly": group_type == "elderly" and "family" not in group_name,
        "disabilityOnly": group_type == "disabled",
        "metroMiles": None,
        "metroStation": None,
        "contact": {
            "name": title(clean(a.get("MGMT_CONTACT_FULL_NAME"))) or None,
            "org": title(clean(a.get("MGMT_AGENT_ORG_NAME"))) or None,
            "phone": clean(a.get("PROPERTY_ON_SITE_PHONE_NUMBER")) or clean(a.get("MGMT_CONTACT_MAIN_PHN_NBR")),
            "email": clean(a.get("MGMT_CONTACT_EMAIL_TEXT")),
        },
        "source": {"dataset": "HUD Multifamily Assisted Properties", "url": MULTIFAMILY_URL, "retrieved": today},
    }


KEEP_UPPER = {"NW", "NE", "SW", "SE", "II", "III", "IV", "VI", "LP", "LLC", "DC", "VA", "MD", "US", "YMCA", "YWCA", "UDC", "GWU", "NIH"}


def title(s: str | None) -> str:
    """HUD data is ALL CAPS. Make it readable without breaking quadrants or street letters."""
    if not s:
        return ""
    out = []
    for w in re.split(r"(\s+|-|/)", s.strip()):
        core = w.strip(".,").upper()
        if core in KEEP_UPPER or (len(core) == 1 and core.isalpha()) or re.fullmatch(r"\d+[A-Z]?", core):
            out.append(w.upper())
        elif re.fullmatch(r"\d+(ST|ND|RD|TH)", core):
            out.append(w.lower())
        else:
            out.append(w[:1].upper() + w[1:].lower())
    return "".join(out)


def addr_key(b: dict) -> str:
    s = re.sub(r"[^a-z0-9 ]", "", b["address"].lower())
    s = re.sub(r"\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|place|pl)\b", "", s)
    return re.sub(r"\s+", " ", s).strip() + "|" + b["zip"]


def name_key(b: dict) -> str:
    s = re.sub(r"[^a-z0-9 ]", "", b["name"].lower())
    s = re.sub(r"\b(apts?|apartments?|the|llc|lp)\b", "", s)
    return re.sub(r"\s+", " ", s).strip() + "|" + b["area"]


def dedupe(buildings: list[dict]) -> list[dict]:
    """Many buildings are in both datasets. Keep the HUD row (income-based rent), fill gaps from LIHTC."""
    by_key: dict[str, dict] = {}
    by_name: dict[str, dict] = {}
    for b in sorted(buildings, key=lambda b: b["program"] != "HUD"):
        k, nk = addr_key(b), name_key(b)
        kept = by_key.get(k) or by_name.get(nk)
        if kept is None:
            by_key[k] = by_name[nk] = b
            continue
        for f in ("bedrooms", "yearPlacedInService", "totalUnits"):
            if not kept[f] and b[f]:
                kept[f] = b[f]
        # Keep HUD's senior/disability flags: they say who may live there, LIHTC's only who is targeted.
    return list({id(b): b for b in by_key.values()}.values())


def build_buildings(inspect: bool) -> None:
    today = date.today().isoformat()
    lihtc = query_layer(LIHTC_URL, WHERE, LIHTC_FIELDS)
    mf = query_layer(MULTIFAMILY_URL, WHERE, MF_FIELDS)
    if inspect:
        for name, rows in (("LIHTC", lihtc), ("Multifamily", mf)):
            print(f"\n{name}: {len(rows)} rows\nfields: {sorted(rows[0]) if rows else []}")
            print(json.dumps(rows[0] if rows else {}, indent=2, default=str)[:3000])
        return
    from collections import Counter
    for name, rows, field in (("LIHTC", lihtc, "INC_CEIL"), ("LIHTC", lihtc, "TRGT_ELD"),
                              ("Multifamily", mf, "CLIENT_GROUP_NAME"), ("Multifamily", mf, "CLIENT_GROUP_TYPE")):
        print(f"{name} {field} values: {dict(Counter(str(r.get(field)) for r in rows))}")
    check_fields("LIHTC", lihtc, LIHTC_FIELDS)
    check_fields("Multifamily", mf, MF_FIELDS)

    rows = [b for a in lihtc if (b := lihtc_building(a, today))]
    rows += [b for a in mf if (b := mf_building(a, today))]
    rows = [b for b in dedupe(rows) if b["lat"] is not None]
    stations = load_stations()
    print(f"Metro stations: {len(stations)}")
    for b in rows:
        b["metroMiles"], b["metroStation"] = nearest_metro(b["lat"], b["lon"], stations)
    rows.sort(key=lambda b: (b["area"], b["name"]))

    OUT_BUILDINGS.write_text(json.dumps(rows, indent=1))
    by_area = dict(Counter(b["area"] for b in rows))
    print(f"Wrote {len(rows)} buildings to {OUT_BUILDINGS.relative_to(ROOT)}: {by_area}")


def build_limits() -> None:
    token = os.environ.get("HUD_USER_TOKEN")
    if not token:
        print("HUD_USER_TOKEN not set; leaving limits.2026.json as is.", file=sys.stderr)
        return
    auth = {"Authorization": f"Bearer {token}"}
    limits = json.loads(OUT_LIMITS.read_text())

    # Section 8 income limits. Response keys VERIFY: data.extremely_low.il30_p1 ... data.very_low.il50_p8
    il = get_json(f"{HUD_USER_API}/il/data/{DC_METRO_ENTITY}", headers=auth)["data"]
    limits["section8"] = {
        "30": [il["extremely_low"][f"il30_p{n}"] for n in range(1, 9)],
        "50": [il["very_low"][f"il50_p{n}"] for n in range(1, 9)],
    }
    limits["effective"] = str(il.get("year", limits["effective"]))
    limits["sources"] = [s for s in limits["sources"] if "huduser" not in s] + [
        f"Section 8 income limits: HUD USER API il/data/{DC_METRO_ENTITY}"]

    # MTSP limits are not in the HUD USER API. Each year, update limits.mtsp by hand from the MTSP table
    # (https://www.huduser.gov/portal/datasets/mtsp.html); tests check the published values.
    OUT_LIMITS.write_text(json.dumps(limits, indent=2) + "\n")
    print(f"Wrote Section 8 limits to {OUT_LIMITS.relative_to(ROOT)}.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--inspect", action="store_true", help="print source fields and one row, then stop")
    args = ap.parse_args()
    build_buildings(args.inspect)
    if not args.inspect:
        build_map()
        build_limits()
