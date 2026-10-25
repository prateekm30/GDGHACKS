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


states = "STATE IN ('DC','MD','VA')"
# HUD hub: everything it serves
probe("hud.services", lambda: [s["name"] for s in get_json(HUB, {"f": "json"}).get("services", [])])
for svc in ("Public_Housing_Developments", "Public_Housing_Buildings", "HUD_Insured_Multifamily_Properties", "Multifamily_Properties_Assisted",
            "LIHTC", "Housing_Choice_Vouchers_by_Tract", "HOME_Activities", "USDA_Rural_Development_Multifamily"):
    probe(f"hud.{svc}", lambda s=svc: arcgis_layer(f"{HUB}/{s}/FeatureServer/0", (WHERE, "1=1")))
# Current sources: raw counts in our counties
probe("hud.lihtc.count", lambda: count(f"{HUB}/LIHTC/FeatureServer/0", WHERE))
probe("hud.mf.count", lambda: count(f"{HUB}/MULTIFAMILY_PROPERTIES_ASSISTED/FeatureServer/0", WHERE))
# DC
probe("dc.housing.layers", lambda: [(l["id"], l["name"]) for l in get_json(
    "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Housing_WebMercator/MapServer", {"f": "json"}).get("layers", [])])
probe("dc.affordable", lambda: arcgis_layer("https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Housing_WebMercator/MapServer/62"))
probe("dc.search", lambda: arcgis_search("affordable housing", "owner:DCGISopendata"))
probe("dc.search.iz", lambda: arcgis_search("inclusionary zoning", "owner:DCGISopendata"))
# Counties and states
for name, q in (("arlington", "committed affordable housing Arlington"), ("montgomery", "MPDU Montgomery County"),
                ("fairfax", "affordable housing Fairfax County"), ("alexandria", "affordable housing Alexandria"),
                ("loudoun", "affordable dwelling unit Loudoun"), ("princegeorges", "affordable housing Prince George's"),
                ("usda", "USDA Rural Development multifamily housing"), ("virginia", "Virginia Housing affordable rental"),
                ("maryland", "Maryland DHCD affordable rental housing"), ("hoc", "Housing Opportunities Commission properties")):
    probe(f"search.{name}", lambda q=q: arcgis_search(q))
probe("socrata.montgomery", lambda: socrata("data.montgomerycountymd.gov", "affordable housing"))
probe("socrata.montgomery.mpdu", lambda: socrata("data.montgomerycountymd.gov", "MPDU"))
probe("socrata.arlington", lambda: socrata("data.arlingtonva.us", "affordable"))

Path("probe").mkdir(exist_ok=True)
Path("probe/report.json").write_text(json.dumps(report, indent=1, default=str))
print("wrote probe/report.json")
