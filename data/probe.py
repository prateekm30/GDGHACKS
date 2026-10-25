"""Probe candidate open-data sources for more income-restricted buildings. Read-only: prints and writes a report.

Run in GitHub Actions ("Probe data sources"); the cloud workspace cannot reach these hosts.
"""
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import COUNTIES, WHERE, get_json  # noqa: E402

HUB = "https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services"
report: dict = {}


def probe(name, fn):
    try:
        report[name] = fn()
        print(f"OK   {name}")
    except Exception as e:  # noqa: BLE001
        report[name] = {"error": repr(e)[:500]}
        print(f"FAIL {name}: {e!r}"[:300])


def layer_info(url):
    j = get_json(url, {"f": "json"})
    return {"name": j.get("name"), "fields": [f["name"] for f in j.get("fields", [])], "maxRecordCount": j.get("maxRecordCount"),
            "description": (j.get("description") or "")[:300]}


def count(url, where="1=1"):
    return get_json(url + "/query", {"where": where, "returnCountOnly": "true", "f": "json"}).get("count")


def sample(url, where="1=1", n=2):
    j = get_json(url + "/query", {"where": where, "outFields": "*", "outSR": 4326, "resultRecordCount": n, "f": "json"})
    return [{"attributes": f.get("attributes"), "geometry": f.get("geometry")} for f in j.get("features", [])][:n]


def arcgis_layer(url, where_candidates=("1=1",)):
    out = {"info": layer_info(url)}
    for w in where_candidates:
        try:
            out[f"count[{w[:60]}]"] = count(url, w)
        except Exception as e:  # noqa: BLE001
            out[f"count[{w[:60]}]"] = repr(e)[:200]
    out["sample"] = sample(url, where_candidates[0])
    return out


def arcgis_search(q, extra=""):
    j = get_json("https://www.arcgis.com/sharing/rest/search", {"q": f'{q} type:"Feature Service" {extra}', "num": 12, "f": "json",
                                                                 "sortField": "numviews", "sortOrder": "desc"})
    return [{"title": r.get("title"), "owner": r.get("owner"), "url": r.get("url"), "views": r.get("numViews"), "id": r.get("id"),
             "snippet": (r.get("snippet") or "")[:160]} for r in j.get("results", [])]


def socrata(domain, q):
    j = get_json("https://api.us.socrata.com/api/catalog/v1", {"domains": domain, "q": q, "limit": 10})
    return [{"name": r["resource"].get("name"), "id": r["resource"].get("id"), "type": r["resource"].get("type"),
             "columns": r["resource"].get("columns_name", [])[:25], "desc": (r["resource"].get("description") or "")[:160]}
            for r in j.get("results", [])]


def hub_search(site, q):
    j = get_json(f"https://{site}/api/search/v1/collections/all/items", {"q": q, "limit": 10})
    return [{"title": f.get("properties", {}).get("title"), "type": f.get("properties", {}).get("type"),
             "url": f.get("properties", {}).get("url"), "id": f.get("id")} for f in j.get("features", [])]


def null_geometry(url, where):
    rows, offset, nulls, total = [], 0, 0, 0
    while True:
        j = get_json(url + "/query", {"where": where, "outFields": "HUD_ID,PROJ_ADD,PROJ_CTY,PROJ_ST,N_UNITS,YR_PIS", "returnGeometry": "true",
                                      "outSR": 4326, "resultOffset": offset, "resultRecordCount": 1000, "f": "json"})
        feats = j.get("features", [])
        for f in feats:
            total += 1
            if not f.get("geometry"):
                nulls += 1
                if len(rows) < 12:
                    rows.append(f["attributes"])
        if not j.get("exceededTransferLimit") or not feats:
            break
        offset += len(feats)
    return {"total": total, "nullGeometry": nulls, "examples": rows}


def groups(url, field, where="1=1"):
    j = get_json(url + "/query", {"where": where, "groupByFieldsForStatistics": field, "f": "json",
                                  "outStatistics": json.dumps([{"statisticType": "count", "onStatisticField": "OBJECTID", "outStatisticFieldName": "n"}])})
    return {str(f["attributes"].get(field)): f["attributes"]["n"] for f in j.get("features", [])}


DC_AFF = "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/FeatureServer/62"
MD_SITES = "https://mdgeodata.md.gov/imap/rest/services/BusinessEconomy/MD_MultifamilySites/FeatureServer/0"
MD_WHERE = "County IN ('Montgomery','Prince George''s','Prince Georges','Frederick','Charles','Calvert')"
PH = f"{HUB}/Public_Housing_Developments/FeatureServer/0"
USDA = f"{HUB}/USDA_Rural_Housing_Assets/FeatureServer/0"
ALX = "https://services2.arcgis.com/ChYV69FhfjwkvRmy/arcgis/rest/services/Committed_and_Affordable_Rentals/FeatureServer"
probe("dc.aff.status", lambda: groups(DC_AFF, "STATUS_PUBLIC"))
probe("dc.aff.agency", lambda: groups(DC_AFF, "AGENCY_CALCULATED"))
probe("dc.aff.completed.sample", lambda: sample(DC_AFF, "STATUS_PUBLIC = 'Completed 2015 to Date' AND TOTAL_AFFORDABLE_UNITS >= 20", 3))
probe("md.sites.counties", lambda: groups(MD_SITES, "County"))
probe("md.sites.programs", lambda: groups(MD_SITES, "MFPrograms", MD_WHERE))
probe("md.sites.occ", lambda: groups(MD_SITES, "PrimOcc", MD_WHERE))
probe("md.sites.sample", lambda: sample(MD_SITES, MD_WHERE, 3))
probe("ph.status", lambda: groups(PH, "PD_STATUS_TYPE_CODE", WHERE))
probe("ph.scattered", lambda: groups(PH, "SCATTERED_SITE_IND", WHERE))
probe("ph.pha", lambda: groups(PH, "FORMAL_PARTICIPANT_NAME", WHERE))
probe("ph.sample", lambda: get_json(PH + "/query", {"where": WHERE + " AND SCATTERED_SITE_IND = 'N'", "outFields": "PROJECT_NAME,DEVELOPMENT_CODE,PD_STATUS_TYPE_CODE,TOTAL_DWELLING_UNITS,ACC_UNITS,TOTAL_UNITS,PCT_BED1,PCT_BED2,PCT_BED3,MONTHS_WAITING,STD_ADDR,STD_CITY,STD_ST,STD_ZIP5,LAT,LON,COUNTY_LEVEL,HA_PHN_NUM,HA_EMAIL_ADDR_TEXT,FORMAL_PARTICIPANT_NAME", "resultRecordCount": 4, "f": "json"}).get("features"))
probe("usda.count", lambda: count(USDA, WHERE))
probe("usda.designation", lambda: groups(USDA, "RENTAL_DESIGNATION", WHERE))
probe("usda.sample", lambda: get_json(USDA + "/query", {"where": WHERE, "outFields": "PROJECT_NAME,STD_ADDR,STD_CITY,STD_ST,STD_ZIP5,TOTAL_UNITS,RA_UNITS,HUD_UNITS,RENTAL_DESIGNATION,MGMT_AGENT_NAME,MGMT_AGENT_PH_NBR,MGMT_AGENT_EMAIL,STUDIO_COUNT,BEDROOM1_COUNT,BEDROOM2_COUNT,BEDROOM3_COUNT,BEDROOM4_COUNT,EFFECTIVE_DATE,RESTRICTIVE_CLAUSE_EXPIRATION,LAT,LON,COUNTY_LEVEL", "resultRecordCount": 4, "f": "json"}).get("features"))
probe("alx.service", lambda: [(l["id"], l["name"]) for l in get_json(ALX, {"f": "json"}).get("layers", []) + get_json(ALX, {"f": "json"}).get("tables", [])])
for i in range(3):
    probe(f"alx.layer{i}", lambda i=i: arcgis_layer(f"{ALX}/{i}"))

Path("probe").mkdir(exist_ok=True)
Path("probe/report.json").write_text(json.dumps(report, indent=1, default=str))
print("wrote probe/report.json")
