# Data pipeline

`python3 data/build.py` turns official HUD sources into the two files the app reads. No scraping.

| Output | What it holds | Source |
|---|---|---|
| `public/data/buildings.json` | One row per building (see `Building` in `src/lib/types.ts`) | Six public query APIs, no key, no scraping: HUD LIHTC Database; HUD Multifamily Properties (Assisted); HUD Public Housing Developments (only the fields about the building, never the resident demographics the layer also carries); USDA Rural Housing Assets (as served by HUD); DC DHCD Affordable Housing (Open Data DC, projects completed 2015 to date with homes at or under 80% of median income); Maryland DHCD Multifamily Sites (MD iMAP); City of Alexandria Committed Affordable Rentals (constructed, public). Filtered to the 20 counties and cities of HUD's Washington metro income-limit area. |
| `src/data/limits.2026.json` | MTSP limits (for tax-credit buildings) and Section 8 limits (for HUD-assisted buildings), by household size 1 to 8 | 2026 table for the Washington-Arlington-Alexandria HUD Metro FMR Area, entered by hand and checked by tests. Optional: HUD USER API (free token) refreshes Section 8 rows. |

## Sources that were looked at and left out

`python3 data/probe.py` (run as the "Probe data sources" Action) is the read-only survey behind these choices.

- Arlington committed affordable units, Fairfax ADU/WDU, Loudoun ADU: no public query layer found (Arlington's CAF list is a PDF).
- Montgomery MPDU: the county's open data counts MPDUs by planning area without addresses, and the GIS layer needs a sign-in.
- HUD Insured Multifamily and Section 202/811 layers: market-rate FHA loans, or already inside the Assisted dataset.
- DC Housing Finance Agency portfolio and university-made county layers: financed-project lists and student projects, not eligibility lists.
- National Housing Preservation Database: needs an account.

## Run it

Easiest: GitHub, Actions tab, **Refresh housing data**, Run workflow. It runs the script and commits the result,
and Vercel redeploys. Or locally:

```bash
python3 data/build.py --inspect                        # 1. check the fields each source returns
python3 data/build.py                                  # 2. write buildings.json
HUD_USER_TOKEN=... python3 data/build.py               # 2b. also write Section 8 limits
```

The 2026 limits are already in `limits.2026.json`, with sources. When HUD publishes new limits, update
`limits.mtsp` from https://www.huduser.gov/portal/datasets/mtsp.html and the tests that pin the values.
A HUD USER token (https://www.huduser.gov/hudapi/public/register) lets the script refresh the Section 8 rows.

## Metro distance

The script downloads WMATA station points (Open Data DC, "Metro Stations Regional") into
`data/metro_stations.geojson` and computes straight-line miles. If that fails, `metroMiles` is null.

## Rules

- Run it in GitHub Actions or on a laptop. The cloud workspace this was built in cannot reach HUD hosts.
- Fields marked `VERIFY` in `build.py` come from the HUD data dictionaries. If `--inspect` shows a different name, fix the mapping.
- Never add place-based scores (crime, schools, demographics). Fair housing rule for this project.
- `npm run data:sample` writes 24 made-up buildings for UI work. The app shows a "Sample data" banner while they are loaded.
