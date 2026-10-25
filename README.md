# HomePick DMV

**Live:** https://gdghacks-tau.vercel.app

Pick between two income-restricted buildings at a time. HomePick learns what matters to you, estimates what
you'd pay, and gives first-time renters across the DMV (DC, suburban Maryland, and Northern Virginia) a short list with next steps.
Snap a form turns a rental application into a checklist with Gemma 4, quoting the form so you can check it.

Built for GDG Build with AI x Hacktoberfest 2026 (AI for Housing) at Virginia Tech.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173 , uses sample data
npm test             # eligibility and ranking tests
npm run build
```

The AI routes (`/api/*`) run on Vercel. Locally, use `npx vercel dev` with `GEMINI_API_KEY` in `.env`
(copy `.env.example`). Without a key, Snap a form still works with the sample form (cached result) and
falls back to highlighted lines.

## AI model

- **Model:** Gemma 4, `gemma-4-26b-a4b-it` (fallback `gemma-4-31b-it`), called through the Gemini API from `api/snap-text.ts`.
- **License:** Apache 2.0 ([Gemma 4 announcement](https://opensource.googleblog.com/2026/03/gemma-4-expanding-the-gemmaverse-with-apache-20.html)).
- **What it does:** turns the text of a rental application into a checklist of documents, fees, deadlines, and contacts. Every item must quote the form word for word, or it is dropped.
- **What it never does:** decide eligibility or cost. That math is plain code with tests.
- **Where the text goes:** the text you review in the box is sent to Google's Gemini API. This deployment uses
  a Gemini API key on the **free (unpaid) tier**. Under Google's terms for unpaid services, Google may use
  prompts and responses to improve its products, and human reviewers may read them. That is why the app asks
  you to delete names, Social Security numbers, and account numbers before you continue, and why the file
  itself never leaves your device. On the paid tier Google states it does not use the data to improve its
  products; if this deployment moves to a billing-enabled project, this note will say so.
- **Scam warnings** are code, not AI: the text is scanned for gift cards, payment apps, wire transfers,
  crypto, "pay before you see it", and pressure tactics, and the checklist carries a warning at the top and on
  each affected item. The AI's own labels are checked too: every number, address, and most words in a label
  must come from your form, so a planted label cannot ride on an honest quote.

## Architecture

```mermaid
flowchart LR
  U[Browser] -->|picks, income: stay here| APP[React app on Vercel]
  APP -->|static JSON| DATA[buildings.json + limits]
  U -->|PDF or photo| OCR[pdf.js / Tesseract on device]
  OCR -->|text the user reviewed| API[Vercel Function /api/snap-text]
  API --> G[Gemma 4 via Gemini API]
  HUD[HUD ArcGIS APIs] -->|GitHub Action: data/build.py| DATA
```

## Rubric map

| Criterion | Where to look |
|---|---|
| Problem and impact | Persona: young workers across the DMV under the 60% limit ($69,780 for one person, 2026) |
| AI integration | Multimodal Snap a form: on-device OCR, Gemma 4 extraction, quote verification |
| Architecture | `src/lib` tested logic, `api/` small functions, static data |
| Safety and grounding | Quote check and label check (server and browser), banned-phrase filter, scam-pattern warnings, no AI in eligibility math |
| Privacy | Income and files stay on the device; only reviewed text is sent; no logging |
| Inclusive design | Keyboard picker, screen reader labels and live region, focus styles, reduced motion, plain language |
| Deployment and cost | One free Vercel deploy, static data, small model, cached demo result, rate limit. A checklist is one Gemma call of roughly 1,500 input and 300 output tokens: free on the Gemini API free tier, and well under a cent at Flash-class paid rates |
| Docs | This README, `RESOURCES.md`, `data/README.md` |

## How it works

| Part | Where | Notes |
|---|---|---|
| Picker and ranking | `src/lib/ranking.ts` | Pairwise model in the browser. Features: cost, income-based rent, bedrooms, Metro distance, size. No place features. |
| Cost and income limits | `src/lib/eligibility.ts` | Computed in code, never by AI. MTSP limits for tax-credit buildings, Section 8 for HUD-assisted. |
| Snap a form | `src/lib/snap.ts`, `api/snap-text.ts` | Text is read on the device (pdf.js, Tesseract). Only text you review is sent. Items whose quote is not in your text are dropped, on the server and again in the browser. |
| Data | `data/build.py`, `.github/workflows/data.yml` | Official HUD APIs to JSON: 914 buildings across the 20 counties and cities of HUD's Washington metro income-limit area, grouped into the 12 areas you can pick in the app. Plus Census county outlines for the map and HUD Small Area Fair Market Rents by ZIP for the "typical rent nearby" comparison. A GitHub Action rebuilds and commits it. See `data/README.md`. |

## Privacy

Income, picks, and photos stay in your browser (session storage, cleared when the tab closes).
`GEMINI_API_KEY` is server-side only. The API does not log request content.
Building photos are aerial tiles from Esri World Imagery; Esri sees which public building locations are
viewed, never anything you type. The OCR engine and English language data are served from this site
(copied from `node_modules` at build time), so reading a form makes no request to any CDN. Fonts load from
Google Fonts. Security headers (CSP, frame-ancestors, nosniff, referrer policy) are set in `vercel.json`.

## Testing and accessibility

- `npm test`: 73 unit tests for eligibility math, ranking, guardrails, the API rate limiter, and text chunking.
- `npm run check:ui` (also run in CI, `.github/workflows/ci.yml`): builds the site, then walks the start,
  basics, pick, and results screens in headless Chromium at 1280px and 390px, with and without reduced
  motion. It fails on any axe-core violation (WCAG 2.0/2.1/2.2 A and AA rules), a headline that does not
  read as separate words, a missing `h1`, focus that does not move to the new screen, two pick cards that are
  not side by side on a phone, or sideways scroll.
- Last run before submission: **0 axe violations on all 4 screens**, both motion modes, both widths.
- Checked by hand: keyboard-only flow (tab, arrow keys in the picker, pause button on the hero slideshow),
  VoiceOver labels on the pick buttons, 200% zoom on a 1024px window.
- Not tested: real screen readers other than VoiceOver, Windows High Contrast mode, Safari on iOS before 16,
  text contrast on the animated gradient backgrounds beyond the fixed pairs below.
- Contrast: body text `#2a1a3a` and headline accent `#8e1247` were checked against the lightest and darkest
  stops of every background gradient (`#ffe3b0`, `#d7b8ff`, `#fff3ea`) and all pass 4.5:1. Gold `#ffc53d`
  and white are only used as text on the dark plum backgrounds (`#2a1f4d` and darker), at 9:1 or better.

## Known limitations

- **Phone numbers:** 564 of 914 buildings (62%) have no phone in HUD's data. Those cards say so and link a
  web search for the leasing office instead.
- **Waitlists and vacancies:** HUD data has neither. Every card says to call and ask.
- **Rent figures are caps, not asking rents.** Tax-credit caps come from HUD's MTSP tables for the whole
  metro area at the building's tier; real rents are often lower. Income-based rent is estimated at 30% of
  the income you enter.
- **Eligibility is estimated**, never decided. The app says "you appear to be under the limit" and the
  property decides. Student rules, minimum incomes, and credit checks vary by building.
- **Rate limiting is per serverless instance** (10 calls a minute and 100 a day per address, 200 an hour per
  instance; the sample form is served from cache and never counts). The hard ceiling is the Gemini API quota and budget alert in Google AI Studio.
- **OCR is English only** and reads up to 10 pages of a PDF (3 pages when the PDF is a scan). Photos are
  downscaled to 2200px before reading. HEIC photos open on Safari; other browsers ask for JPG or PNG.
- **Long forms** are sent in pieces of about 16 KB each, so a 40-page packet means several AI calls. If one
  piece fails, the checklist from the other pieces still shows, with a note saying which part is missing.
- **Scam detection is pattern matching.** It catches the common asks (gift cards, Zelle, wire, pay-before-viewing)
  and will miss a scam written around them. Real applications never take payment that way, so when in doubt call
  the building's number listed here, not the one on the form.
- **HUD-assisted buildings and income limits:** most admit under the very-low-income (50%) limit, some up to
  80%. Between the two the card says "may be over, ask" and the "hide buildings I'm over the limit for" toggle
  keeps them.
- **Ranking and programs:** income-based rent gets no head start in the ranking (choose "Rent based on my income"
  to favor it), and the top three never show three of one program when the other is available. HUD-assisted
  buildings often have long waitlists, and HUD publishes no waitlist data.
- **"What we learned about you"** lists only what you chose on the basics step and what your picks moved clearly
  (a weight rise of 0.9 or more; eight random picks move the biggest weight about 0.36 at the median and 0.9 at
  the 95th percentile). Mixed picks say so instead of inventing a preference.
- **Data cleanup:** rows at the same spot with the same street address are merged (one listing per building),
  unit counts that come swapped from HUD ("98 of 32") are put the right way round, a row whose address was the
  developer's office is merged into the building's own row, and group homes and sites with three or fewer homes
  are flagged and kept out of the picker (they fill by referral). The latest placed-in-service year in HUD's
  LIHTC database release is 2019; HUD-assisted rows carry no year.
- **Building names and contacts** are as HUD publishes them, tidied (capitalization, "Apts", SOME's
  properties). Some names are the legal project name, not the sign on the door.
- **No interior photos.** HUD has none and listing photos are copyrighted, so cards show aerial, neighborhood,
  and street-map views of the real location with a Street View link.
- **No ranking on neighborhood, school, or demographic data**, on purpose (fair housing).

## Credits and data

- HUD LIHTC Database and HUD Multifamily Assisted Properties (public domain, U.S. government)
- 2026 income limits for the Washington-Arlington-Alexandria HUD Metro FMR Area (MTSP and Section 8)
- WMATA Metro station locations (Open Data DC)
- Aerial imagery: Esri World Imagery (Esri, Maxar, Earthstar Geographics)
- Gemma 4 via the Gemini API
- React, Vite, Tailwind CSS, pdf.js (Apache-2.0), Tesseract.js (Apache-2.0)

Estimates only. Each property decides who qualifies.

## License

MIT
