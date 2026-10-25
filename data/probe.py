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


MD_COUNTIES = "('MONTGOMERY','PRINCE GEORGE''S','FREDERICK','CHARLES','CALVERT')"
TARGETS = {
    "hud.ph.dev": (f"{HUB}/Public_Housing_Developments/FeatureServer/0", (WHERE,)),
    "hud.usda.assets": (f"{HUB}/USDA_Rural_Housing_Assets/FeatureServer/0", ("1=1",)),
    "hud.mf.pipeline": (f"{HUB}/Multifamily_Properties_and_Pipeline/FeatureServer/0", (WHERE, "1=1")),
    "hud.s202": (f"{HUB}/HUD_Section_202_Properties/FeatureServer/0", (WHERE, "1=1")),
    "dc.affordable": ("https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/FeatureServer/62", ("1=1",)),
    "dc.hfa": ("https://services.arcgis.com/neT9SoYxizqTHZPH/arcgis/rest/services/Housing_Finance_Agency_Portfolio/FeatureServer/0", ("1=1",)),
    "alx.caf": ("https://services2.arcgis.com/ChYV69FhfjwkvRmy/arcgis/rest/services/Committed_and_Affordable_Rentals/FeatureServer/0", ("1=1",)),
    "moco.mpdu": ("https://services.arcgis.com/hdlG36cOubTzNDBb/arcgis/rest/services/MoCo_Rental_MPDU_Locations_WFL1/FeatureServer/0", ("1=1",)),
    "md.mfsites": ("https://mdgeodata.md.gov/imap/rest/services/BusinessEconomy/MD_MultifamilySites/FeatureServer/0", ("1=1",)),
    "shimberg.2026": ("https://services8.arcgis.com/GfH4uM8d7iVMXBlB/arcgis/rest/services/HUD_RD_Properties_as_of_2026_02_04/FeatureServer/0", ("1=1",)),
    "pg.umd": ("https://services1.arcgis.com/qTQ6qYkHpxlu0G82/arcgis/rest/services/Prince_George_s_County_Affordable_Housing/FeatureServer/0", ("1=1",)),
}
for name, (url, wheres) in TARGETS.items():
    probe(name, lambda u=url, w=wheres: arcgis_layer(u, w))
probe("hud.lihtc.nullgeom", lambda: null_geometry(f"{HUB}/LIHTC/FeatureServer/0", WHERE))
probe("hud.mf.nullgeom", lambda: null_geometry(f"{HUB}/MULTIFAMILY_PROPERTIES_ASSISTED/FeatureServer/0", WHERE))
for site, q in (("gisdata-arlgis.opendata.arcgis.com", "affordable"), ("data-fairfaxcountygis.opendata.arcgis.com", "affordable housing"),
                ("geohub-loudoungis.opendata.arcgis.com", "affordable"), ("gisdata.pgplanning.org", "affordable housing"),
                ("data.princegeorgescountymd.gov", "affordable"), ("data-mcgov-gis.opendata.arcgis.com", "MPDU")):
    probe(f"hub.{site.split('.')[0]}", lambda s=site, q=q: hub_search(s, q))
probe("search.arlington2", lambda: arcgis_search("Arlington County affordable housing CAF", 'orgid:0HCyYvHeF3dpfdG4'))
probe("search.arlington3", lambda: arcgis_search("Arlington committed affordable"))
probe("search.fairfax2", lambda: arcgis_search("Fairfax County affordable dwelling unit rental"))
probe("socrata.pg", lambda: socrata("data.princegeorgescountymd.gov", "affordable housing"))
probe("socrata.moco.mpdu.rows", lambda: get_json("https://data.montgomerycountymd.gov/resource/pbh5-g4e5.json", {"$limit": 3}))

Path("probe").mkdir(exist_ok=True)
Path("probe/report.json").write_text(json.dumps(report, indent=1, default=str))
print("wrote probe/report.json")
