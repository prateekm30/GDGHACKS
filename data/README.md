# Data pipeline

`python3 data/build.py` turns official HUD sources into the two files the app reads. No scraping.

| Output | What it holds | Source |
|---|---|---|
| `public/data/buildings.json` | One row per building (see `Building` in `src/lib/types.ts`) | HUD LIHTC Database and HUD Multifamily Properties (Assisted), both public ArcGIS REST query APIs on HUD's ArcGIS Online, no key. Filtered to DC (FIPS 11001) and Arlington (51013). |
| `src/data/limits.2026.json` | MTSP limits (for tax-credit buildings) and Section 8 limits (for HUD-assisted buildings), by household size 1 to 8 | HUD USER API (free token) for Section 8; HUD MTSP table entered by hand |

## Run it

Easiest: GitHub, Actions tab, **Refresh housing data**, Run workflow. It runs the script and commits the result,
and Vercel redeploys. Or locally:

```bash
python3 data/build.py --inspect                        # 1. check the fields each source returns
python3 data/build.py                                  # 2. write buildings.json
HUD_USER_TOKEN=... python3 data/build.py               # 2b. also write Section 8 limits
```

Get a HUD USER token at https://www.huduser.gov/hudapi/public/register . Then copy the FY2026 MTSP
50% and 60% rows for the Washington-Arlington-Alexandria area from https://www.huduser.gov/portal/datasets/mtsp.html
into `limits.mtsp` and delete the PLACEHOLDER note. A test checks the 1BR 60% rent ceiling is $1,869.

## Metro distance

The script downloads WMATA station points (Open Data DC, "Metro Stations Regional") into
`data/metro_stations.geojson` and computes straight-line miles. If that fails, `metroMiles` is null.

## Rules

- Run it in GitHub Actions or on a laptop. The cloud workspace this was built in cannot reach HUD hosts.
- Fields marked `VERIFY` in `build.py` come from the HUD data dictionaries. If `--inspect` shows a different name, fix the mapping.
- Never add place-based scores (crime, schools, demographics). Fair housing rule for this project.
- `npm run data:sample` writes 24 made-up buildings for UI work. The app shows a "Sample data" banner while they are loaded.
