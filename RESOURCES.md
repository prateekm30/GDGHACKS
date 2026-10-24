# HomePick DMV: resources and setup

## What we use

| Piece | Choice | Cost | Key needed? |
|---|---|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind v4 | Free | No |
| Backend | Vercel Functions in `api/` (3 small routes) | Free (Hobby) | No |
| Hosting | Vercel: one deploy for the site and the API, preview URL per push | Free | Vercel account |
| AI | Gemma 4 (`gemma-4-26b-a4b-it`, fallback `gemma-4-31b-it`) via the Gemini API | Free tier | `GEMINI_API_KEY` from https://aistudio.google.com/apikey |
| On-device text reading | pdf.js (PDFs), Tesseract.js (photos) | Free | No |
| Building data | HUD LIHTC + HUD Multifamily ArcGIS REST APIs | Free | No |
| Income limits | HUD USER API (Section 8) + HUD MTSP table | Free | `HUD_USER_TOKEN` (data script only) |

Why Vercel over Firebase or Cloud Run: the static site and the Gemma calls deploy together from the
GitHub repo with zero config, and every PR gets a preview link to test on phones. Nothing here needs GCP.

## Housing data: no scraping

We query HUD's official public APIs, which return JSON. `data/build.py` filters to DC and Arlington,
merges the two datasets by address, adds Metro distance, and writes:

- `public/data/buildings.json`: an array of buildings (name, address, program, units, bedroom sizes,
  rent ceiling type, year opened, senior/disability flags, contact, source and retrieval date)
- `src/data/limits.2026.json`: income limits by household size 1 to 8

The app loads these as static files, so there is no database. Until the script runs, the app uses 24
made-up buildings and shows a "Sample data" banner.

## API routes

| Route | Does | Gets |
|---|---|---|
| `POST /api/snap-text` | Turns reviewed form text into a checklist; drops any item whose quote is not in the text | Text only, max 20 KB, rate limited |
| `POST /api/explain` | Plain-English explainer for a fixed list of terms (optional, not wired into the UI yet) | A term name only |
| `GET /api/health` | Says whether the AI key is set | Nothing |

## Who does what

Done in this workspace: the whole app skeleton, eligibility and ranking math with 19 tests, all UI
screens (start, picker, income form, results, next steps, Snap a form with a sample form), the API
routes, the data script, README.

Needs the team:
1. Create a public GitHub repo, connect GitHub to Claude, and tell me the owner/name. I push after your OK.
2. Import the repo in Vercel (vercel.com/new). Framework preset: Vite. Add env vars `GEMINI_API_KEY`,
   `GEMMA_MODEL`, `GEMMA_FALLBACK_MODEL`.
3. Run `python3 data/build.py --inspect`, then `python3 data/build.py` on a laptop (this workspace cannot
   reach HUD hosts). Paste the FY2026 MTSP rows into `limits.2026.json`.
4. Test Snap a form with a real (blank) application PDF and a phone photo.
