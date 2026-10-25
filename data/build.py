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
# More official sources (all public query APIs, no key). Each one fails soft: a county site being down must not
# stop the HUD build.
PUBLIC_HOUSING_URL = "https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/Public_Housing_Developments/FeatureServer/0"
USDA_URL = "https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/USDA_Rural_Housing_Assets/FeatureServer/0"
DC_AFFORDABLE_URL = "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/FeatureServer/62"
MD_SITES_URL = "https://mdgeodata.md.gov/imap/rest/services/BusinessEconomy/MD_MultifamilySites/FeatureServer/0"
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
# HUD Small Area Fair Market Rents by ZIP (FY2026): HUD's estimate of a modest market rent, utilities included.
SAFMR_URL = "https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/HUD_PDR_Small_Area_Fair_Market_Rents/FeatureServer/1"
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
# Public housing: the layer also carries resident demographics (race, age, income shares). Never requested.
PH_FIELDS = ["DEVELOPMENT_CODE", "PROJECT_NAME", "SCATTERED_SITE_IND", "PD_STATUS_TYPE_CODE", "TOTAL_UNITS",
             "ACC_UNITS", "PCT_BED1", "PCT_BED2", "PCT_BED3", "MONTHS_WAITING", "STD_ADDR", "STD_CITY", "STD_ST",
             "STD_ZIP5", "FORMAL_PARTICIPANT_NAME", "HA_PHN_NUM", "HA_EMAIL_ADDR_TEXT", "COUNTY_LEVEL", "LAT", "LON"]
USDA_FIELDS = ["OBJECTID", "PROJECT_NAME", "STD_ADDR", "STD_CITY", "STD_ST", "STD_ZIP5", "TOTAL_UNITS", "RA_UNITS",
               "RENTAL_DESIGNATION", "MGMT_AGENT_NAME", "MGMT_AGENT_PH_NBR", "MGMT_AGENT_EMAIL", "STUDIO_COUNT",
               "BEDROOM1_COUNT", "BEDROOM2_COUNT", "BEDROOM3_COUNT", "BEDROOM4_COUNT", "EFFECTIVE_DATE",
               "COUNTY_LEVEL", "LAT", "LON"]
DC_FIELDS = ["OBJECTID", "MAR_ID", "PROJECT_NAME", "ADDRESS", "FULLADDRESS", "STATUS_PUBLIC", "AGENCY_CALCULATED",
             "TOTAL_AFFORDABLE_UNITS", "AFFORDABLE_UNITS_AT_0_30_AMI", "AFFORDABLE_UNITS_AT_31_50_AMI",
             "AFFORDABLE_UNITS_AT_51_60_AMI", "AFFORDABLE_UNITS_AT_61_80_AMI", "AFFORDABLE_UNITS_AT_81_AMI",
             "UNITS_TOTAL", "CONSTRUCTION_END_DATE", "LATITUDE", "LONGITUDE"]
MD_FIELDS = ["ProjID", "ProjName", "MFPrograms", "PInitClos", "ResUnits", "PrimOcc", "Address", "City", "Zip", "County",
             "XCoord", "YCoord"]
MD_COUNTY_AREA = {"Montgomery": "MONTGOMERY", "Prince George's": "PRINCE_GEORGES", "Prince Georges": "PRINCE_GEORGES",
                  "Frederick": "FREDERICK", "Charles": "SOUTHERN_MD", "Calvert": "SOUTHERN_MD"}
MD_WHERE = "County IN (" + ",".join("'" + c.replace("'", "''") + "'" for c in MD_COUNTY_AREA) + ")"
# Which row wins when two sources list the same building: HUD rows carry phones and unit mixes, then public
# housing, the LIHTC database, USDA, the DC and Maryland agency lists (which carry the fewest fields).
SOURCE_RANK = {"hud": 0, "ph": 1, "lihtc": 2, "usda": 3, "dc": 4, "md": 5}


def rank(b: dict) -> int:
    return SOURCE_RANK.get(b["id"].split("-", 1)[0], 9)


def stable_id(prefix: str, *parts) -> str:
    """An id that survives a refresh (ArcGIS OBJECTIDs do not)."""
    import hashlib
    return prefix + "-" + hashlib.sha1("|".join(str(p or "").strip().lower() for p in parts).encode()).hexdigest()[:10]


def phone(v) -> str | None:
    """HUD and USDA give bare digits ("2025351500"); show them the way people dial."""
    s = clean(v)
    if not s:
        return None
    d = re.sub(r"\D", "", s)
    if len(d) == 11 and d.startswith("1"):
        d = d[1:]
    return f"({d[:3]}) {d[3:6]}-{d[6:]}" if len(d) == 10 else s


def year_of(ms) -> int | None:
    """A year from an ArcGIS epoch-milliseconds date."""
    try:
        return int(date.fromtimestamp(int(ms) / 1000).year) if ms else None
    except (TypeError, ValueError, OverflowError, OSError):
        return None




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


def add_market_rents(rows: list[dict]) -> None:
    """Attach HUD's Small Area Fair Market Rent for each building's ZIP, so cards can compare against the market."""
    zips = sorted({b["zip"] for b in rows if re.fullmatch(r"\d{5}", b["zip"] or "")})
    by_zip: dict[str, dict] = {}
    try:
        for i in range(0, len(zips), 100):
            chunk = zips[i:i + 100]
            fields = ["ID", "HUD_CODE"] + [f"SAFMR_{n}BR" for n in range(5)]
            for a in query_layer(SAFMR_URL, "ID IN (" + ",".join(f"'{z}'" for z in chunk) + ")", fields):
                by_zip[str(a["ID"])] = a
    except SystemExit as e:
        print(f"Could not load market rents ({e}); cards will skip the comparison.", file=sys.stderr)
        return
    hit = 0
    for b in rows:
        a = by_zip.get(b["zip"])
        if a and a.get("HUD_CODE") == DC_METRO_ENTITY:
            b["marketRent"] = {str(n): num(a.get(f"SAFMR_{n}BR")) for n in range(5) if num(a.get(f"SAFMR_{n}BR"))}
            hit += 1
    print(f"Market rents: {len(by_zip)} ZIPs, matched {hit} of {len(rows)} buildings")


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
        "name": clean_name(title(clean(a.get("PROJECT")))) or "Unnamed property",
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
        "name": clean_name(title(clean(a.get("PROPERTY_NAME_TEXT")))) or "Unnamed property",
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


def ph_building(a: dict, today: str) -> dict | None:
    """HUD public housing developments. Rent is about 30% of income; the housing authority runs the waitlist."""
    area = area_of(a)
    if not area or a.get("SCATTERED_SITE_IND") == "Y" or a.get("PD_STATUS_TYPE_CODE") != "M":
        return None  # scattered sites have no one address; only developments under management
    name = clean_name(title(clean(a.get("PROJECT_NAME")))) or "Unnamed property"
    bedrooms = [n for n in (1, 2, 3) if (num(a.get(f"PCT_BED{n}")) or 0) > 0]
    return {
        "id": f"ph-{a['DEVELOPMENT_CODE']}",
        "name": name,
        "address": title(clean(a.get("STD_ADDR"))),
        "city": title(clean(a.get("STD_CITY"))),
        "state": (a.get("STD_ST") or "").upper(),
        "zip": str(a.get("STD_ZIP5") or "")[:5],
        "area": area,
        "lat": a["_lat"], "lon": a["_lon"],
        "program": "HUD",
        "subsidy": "public-housing",
        "totalUnits": num(a.get("TOTAL_UNITS")),
        "affordableUnits": num(a.get("ACC_UNITS")),
        "incomeCeiling": None,
        "bedrooms": bedrooms,
        "unitMix": {},
        "yearPlacedInService": None,
        "seniorOnly": bool(re.search(r"\b(senior|elderly)\b", name, re.I)),
        "disabilityOnly": False,
        # Average months on the waitlist for recent move-ins; HUD's 0 and negatives both read as unknown.
        "waitMonths": num(a.get("MONTHS_WAITING")) or None,
        "metroMiles": None,
        "metroStation": None,
        "contact": {"name": None, "org": title(clean(a.get("FORMAL_PARTICIPANT_NAME"))).replace("D.c  ", "DC ") or None,
                    "phone": phone(a.get("HA_PHN_NUM")), "email": clean(a.get("HA_EMAIL_ADDR_TEXT"))},
        "source": {"dataset": "HUD Public Housing Developments", "url": PUBLIC_HOUSING_URL, "retrieved": today},
    }


def usda_building(a: dict, today: str) -> dict | None:
    """USDA Rural Development rentals (Section 515/514). Units with Rental Assistance charge about 30% of income."""
    area = area_of(a)
    if not area:
        return None
    mix = {str(n): c for n, f in ((0, "STUDIO_COUNT"), (1, "BEDROOM1_COUNT"), (2, "BEDROOM2_COUNT"), (3, "BEDROOM3_COUNT"), (4, "BEDROOM4_COUNT"))
           if (c := num(a.get(f)) or 0) > 0}
    assisted = num(a.get("RA_UNITS")) or 0
    year = str(a.get("EFFECTIVE_DATE") or "")[:4]
    return {
        "id": stable_id("usda", a.get("PROJECT_NAME"), a.get("STD_ADDR"), a.get("STD_ZIP5")),
        "name": clean_name(title(clean(a.get("PROJECT_NAME")))) or "Unnamed property",
        "address": title(clean(a.get("STD_ADDR"))),
        "city": title(clean(a.get("STD_CITY"))),
        "state": (a.get("STD_ST") or "").upper(),
        "zip": str(a.get("STD_ZIP5") or "")[:5],
        "area": area,
        "lat": a["_lat"], "lon": a["_lon"],
        # With rental assistance the rent follows income; without it USDA sets a basic rent we do not know.
        "program": "HUD" if assisted > 0 else "LIHTC",
        "subsidy": "usda",
        "totalUnits": num(a.get("TOTAL_UNITS")),
        "affordableUnits": assisted or num(a.get("TOTAL_UNITS")),
        "incomeCeiling": None,
        "bedrooms": [int(n) for n in mix],
        "unitMix": mix,
        "yearPlacedInService": int(year) if year.isdigit() else None,
        "seniorOnly": str(a.get("RENTAL_DESIGNATION") or "").startswith("EL"),
        "disabilityOnly": False,
        "metroMiles": None,
        "metroStation": None,
        "contact": {"name": None, "org": title(clean(a.get("MGMT_AGENT_NAME"))) or None,
                    "phone": phone(a.get("MGMT_AGENT_PH_NBR")), "email": clean(a.get("MGMT_AGENT_EMAIL"))},
        "source": {"dataset": "USDA Rural Housing Assets (via HUD)", "url": USDA_URL, "retrieved": today},
    }


DC_TIERS = (("30", "AFFORDABLE_UNITS_AT_0_30_AMI"), ("50", "AFFORDABLE_UNITS_AT_31_50_AMI"),
            ("60", "AFFORDABLE_UNITS_AT_51_60_AMI"), ("80", "AFFORDABLE_UNITS_AT_61_80_AMI"))


def dc_building(a: dict, today: str) -> dict | None:
    """DC DHCD's Affordable Housing list: projects with covenanted affordable homes, completed 2015 to date."""
    if not str(a.get("STATUS_PUBLIC") or "").lower().startswith("completed"):
        return None
    mix = {t: c for t, f in DC_TIERS if (c := num(a.get(f)) or 0) > 0}
    if not mix:
        return None  # only homes above 80% of median income
    lat, lon = a.get("LATITUDE") or a["_lat"], a.get("LONGITUDE") or a["_lon"]
    if lat is None or lon is None:
        return None
    addr = clean(a.get("ADDRESS")) or ""
    zip_m = re.search(r"\b(20\d{3})\b", addr)
    street = title(clean(a.get("FULLADDRESS"))) or title(addr.split(",")[0])
    name = clean(a.get("PROJECT_NAME")) or street
    highest = max(int(t) for t in mix)
    return {
        "id": f"dc-{int(a['MAR_ID']) if a.get('MAR_ID') else 'o' + str(a['OBJECTID'])}",
        "name": clean_name(title(name)) if name.isupper() else name,
        "address": street,
        "city": "Washington",
        "state": "DC",
        "zip": zip_m.group(1) if zip_m else "",
        "area": "DC",
        "lat": lat, "lon": lon,
        "program": "LIHTC",
        "subsidy": "dc",
        "totalUnits": num(a.get("UNITS_TOTAL")),
        "affordableUnits": num(a.get("TOTAL_AFFORDABLE_UNITS")),
        # The highest income tier with homes: rents and limits shown are the "up to" for the building.
        "incomeCeiling": highest,
        "amiMix": mix,
        "bedrooms": [],
        "unitMix": {},
        "yearPlacedInService": year_of(a.get("CONSTRUCTION_END_DATE")),
        "seniorOnly": bool(re.search(r"\b(senior|elderly)\b", name, re.I)),
        "disabilityOnly": False,
        "metroMiles": None,
        "metroStation": None,
        "contact": {"name": None, "org": None, "phone": None, "email": None},
        "source": {"dataset": "DC DHCD Affordable Housing (Open Data DC)", "url": DC_AFFORDABLE_URL, "retrieved": today},
    }


def md_building(a: dict, today: str) -> dict | None:
    """Maryland DHCD multifamily sites: state-financed rentals (tax credit, rental housing loans, preservation)."""
    area = MD_COUNTY_AREA.get(str(a.get("County") or "").strip())
    if not area:
        return None
    lat, lon = a.get("YCoord") or a["_lat"], a.get("XCoord") or a["_lon"]
    if lat is None or lon is None:
        return None
    occ = str(a.get("PrimOcc") or "")
    return {
        "id": f"md-{int(a['ProjID']) if a.get('ProjID') else 'o' + str(a.get('OBJECTID'))}",
        "name": clean_name(title(clean(a.get("ProjName")))) or "Unnamed property",
        "address": title(re.sub(r"\s+", " ", clean(a.get("Address")) or "")),
        "city": title(clean(a.get("City"))),
        "state": "MD",
        "zip": str(a.get("Zip") or "")[:5],
        "area": area,
        "lat": lat, "lon": lon,
        "program": "LIHTC",
        "subsidy": "md",
        "totalUnits": num(a.get("ResUnits")),
        "affordableUnits": num(a.get("ResUnits")),
        "incomeCeiling": None,
        "bedrooms": [],
        "unitMix": {},
        "yearPlacedInService": year_of(a.get("PInitClos")),
        "seniorOnly": occ == "Elderly",
        "disabilityOnly": occ == "Special Needs",
        "metroMiles": None,
        "metroStation": None,
        "contact": {"name": None, "org": None, "phone": None, "email": None},
        "source": {"dataset": "Maryland DHCD Multifamily Sites (MD iMAP)", "url": MD_SITES_URL, "retrieved": today},
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


SMALL_WORDS = {"of", "at", "and", "the", "on", "in", "for", "by"}


def clean_name(s: str) -> str:
    """Tidy HUD property names: SOME (the DC nonprofit), 'Apts', trailing '(the)', and lowercase words in parentheses."""
    if not s:
        return s
    n = s.strip()
    n = re.sub(r"^Some[\s-]+(?=The\b)", "SOME: ", n)
    n = re.sub(r"^Some\b", "SOME", n)
    n = re.sub(r"\bApts?\.?(?=\s|$|-)", lambda m: "Apartments" if m.group(0).lower().startswith("apts") else "Apartment", n)
    n = re.sub(r",\s*inc\.?$", ", Inc.", n, flags=re.I)
    m = re.fullmatch(r"(.*?)\s*\(the\)", n, flags=re.I)
    if m:
        n = "The " + m.group(1)
    # Words inside parentheses come out lowercase from title(); capitalize them.
    n = re.sub(r"\(([^)]*)\)", lambda m: "(" + " ".join(w[:1].upper() + w[1:] for w in m.group(1).split(" ")) + ")", n)
    # Small words stay lowercase unless they start the name.
    words = n.split(" ")
    n = " ".join(
        w[:1].upper() + w[1:] if i == 0 or words[i - 1].endswith(":") else (w.lower() if w.lower() in SMALL_WORDS else w)
        for i, w in enumerate(words)
    )
    return re.sub(r"\s{2,}", " ", n).strip()


def addr_key(b: dict) -> str:
    s = re.sub(r"[^a-z0-9 ]", "", b["address"].lower())
    s = re.sub(r"\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|place|pl)\b", "", s)
    return re.sub(r"\s+", " ", s).strip() + "|" + b["zip"]


def name_key(b: dict) -> str:
    s = re.sub(r"[^a-z0-9 ]", "", b["name"].lower())
    s = re.sub(r"\b(apts?|apartments?|the|llc|lp)\b", "", s)
    return re.sub(r"\s+", " ", s).strip() + "|" + b["area"]


def dedupe(buildings: list[dict]) -> list[dict]:
    """Many buildings are in several datasets. Keep the best-ranked row (see SOURCE_RANK), fill its gaps."""
    by_key: dict[str, dict] = {}
    by_name: dict[str, dict] = {}
    for b in sorted(buildings, key=rank):
        k, nk = addr_key(b), name_key(b)
        kept = by_key.get(k) or by_name.get(nk)
        if kept is None:
            by_key[k] = by_name[nk] = b
            continue
        fill_gaps(kept, b)
        # Keep the kept row's senior/disability flags: they say who may live there, LIHTC's only who is targeted.
    return list({id(b): b for b in by_key.values()}.values())


def fill_gaps(kept: dict, other: dict) -> None:
    for f in ("bedrooms", "yearPlacedInService", "totalUnits", "affordableUnits", "incomeCeiling", "unitMix", "marketRent",
              "amiMix", "waitMonths"):
        if not kept.get(f) and other.get(f):
            kept[f] = other[f]
    if not kept["contact"]["phone"] and other["contact"]["phone"]:
        kept["contact"] = other["contact"]


# Rows HUD publishes with the developer's office as the address. The building itself is another row.
MERGE_INTO = {
    "lihtc-MDA20190007": "hud-800249298",  # Momentum at Shady Grove Metro: office in Vienna VA, building in Derwood MD
}
SMALL_SITE_UNITS = 3


def refine(rows: list[dict]) -> list[dict]:
    """Fixes that need the whole list: same-spot duplicates, swapped unit counts, group homes, known bad rows.
    Also runs on the committed JSON (--refine) so the fixes land without a full rebuild."""
    by_id = {b["id"]: b for b in rows}
    out: list[dict] = []
    for b in rows:
        target = by_id.get(MERGE_INTO.get(b["id"], ""))
        if target is not None:
            for f in ("yearPlacedInService", "incomeCeiling", "unitMix"):
                if not target.get(f) and b.get(f):
                    target[f] = b[f]
            if not target["bedrooms"] and b["bedrooms"]:
                target["bedrooms"] = b["bedrooms"]
            continue
        out.append(b)
    rows = out

    # Two rows at the same point (within ~10 m) with the same house number are one building listed twice
    # (a re-syndicated tax-credit deal, or a HUD contract plus its LIHTC record; street spellings differ:
    # "S Alfred St" vs "South Alfred Street"). Keep the HUD row, else the newest LIHTC row, and fill its gaps.
    # Sources geocode the same door a little differently, so the match is within ~100 m plus the house number.
    by_spot: dict[tuple, dict] = {}
    out = []
    for b in sorted(rows, key=lambda b: (rank(b), -(b["yearPlacedInService"] or 0))):
        house = re.match(r"\d+", b["address"] or "")
        key = (round(b["lat"], 3), round(b["lon"], 3), house.group(0) if house else name_key(b))
        kept = by_spot.get(key)
        if kept is None:
            by_spot[key] = b
            out.append(b)
            continue
        fill_gaps(kept, b)
    rows = out

    for b in rows:
        # A building has at least as many homes as assisted homes. When HUD's two counts are the wrong way
        # round ("98 of 32"), swap them.
        t, a = b["totalUnits"], b["affordableUnits"]
        if t is not None and a is not None and a > t:
            b["totalUnits"], b["affordableUnits"] = a, t
        # Group homes and sites with three or fewer homes are not apartment buildings; they fill by referral.
        # Same for a block with three or fewer covenanted homes (one inclusionary unit in a condo building).
        small = any(b.get(f) is not None and b[f] <= SMALL_SITE_UNITS for f in ("totalUnits", "affordableUnits"))
        if re.search(r"\bgroup home\b", b["name"], re.I) or small:
            b["groupHome"] = True
            if "group home" in b["name"].lower():
                b["disabilityOnly"] = True
    rows.sort(key=lambda b: (b["area"], b["name"]))
    return rows


def refine_file() -> None:
    rows = json.loads(OUT_BUILDINGS.read_text())
    before = len(rows)
    rows = refine(rows)
    OUT_BUILDINGS.write_text(json.dumps(rows, indent=1))
    small = sum(1 for b in rows if b.get("groupHome"))
    print(f"Refined {before} -> {len(rows)} buildings ({small} group homes or small sites flagged).")


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
    for label, url, where, fields, mapper in (
        ("Public housing", PUBLIC_HOUSING_URL, WHERE, PH_FIELDS, ph_building),
        ("USDA rural", USDA_URL, WHERE, USDA_FIELDS, usda_building),
        ("DC affordable", DC_AFFORDABLE_URL, "1=1", DC_FIELDS, dc_building),
        ("Maryland sites", MD_SITES_URL, MD_WHERE, MD_FIELDS, md_building),
    ):
        try:
            raw = query_layer(url, where, fields)
            mapped = [b for a in raw if (b := mapper(a, today))]
            print(f"{label}: {len(raw)} rows, {len(mapped)} usable")
            rows += mapped
        except Exception as e:  # noqa: BLE001 - one source down must not stop the build
            print(f"WARNING {label} skipped: {e!r}"[:400])
    rows = [b for b in dedupe(rows) if b["lat"] is not None]
    stations = load_stations()
    print(f"Metro stations: {len(stations)}")
    for b in rows:
        b["metroMiles"], b["metroStation"] = nearest_metro(b["lat"], b["lon"], stations)
    add_market_rents(rows)
    rows = refine(rows)

    OUT_BUILDINGS.write_text(json.dumps(rows, indent=1))
    by_area = dict(Counter(b["area"] for b in rows))
    by_source = dict(Counter(b["id"].split("-", 1)[0] for b in rows))
    print(f"Wrote {len(rows)} buildings to {OUT_BUILDINGS.relative_to(ROOT)}: {by_area}\nby source: {by_source}")


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
    ap.add_argument("--refine", action="store_true", help="re-apply the fixes in refine() to the committed JSON, no network")
    args = ap.parse_args()
    if args.refine:
        refine_file()
        sys.exit()
    build_buildings(args.inspect)
    if not args.inspect:
        build_map()
        build_limits()
