import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PickStep } from './components/PickStep'
import { ResultsStep } from './components/ResultsStep'
import { BasicsForm, sanitizeBasics, toSituation, type Basics } from './components/BasicsForm'
import { Landing } from './components/Landing'
import { HowItWorks } from './components/HowItWorks'
import { About } from './components/About'
import { SnapForm } from './components/SnapForm'
import { LogoMark } from './components/Logo'
import { Button, Card, money, Note, StepIndicator } from './components/ui'
import limitsJson from './data/limits.2026.json'
import { assess, isVisible } from './lib/eligibility'
import { AREAS, areaInfo, HUBS, milesBetween, widenAreas } from './lib/areas'
import { fit, nextPair, priorFor, rank, shortlistFrom, type Pick } from './lib/ranking'
import type { Area, Building, IncomeLimits } from './lib/types'
import { prefersReducedMotion, withTransition } from './lib/motion'
import { loadStreetViewKey } from './lib/streetview'
import { Skyline } from './components/Skyline'
import { Lamp } from './components/Lamp'

const limits = limitsJson as IncomeLimits
const ROUNDS = 8
/** Fewer fitting buildings than this in the chosen areas and the search widens to neighboring areas. */
const MIN_POOL = ROUNDS * 2
const BASICS_KEY = 'homepick.basics'

type Step = 'start' | 'basics' | 'pick' | 'results' | 'snap' | 'how' | 'about'
const STEPS: readonly Step[] = ['start', 'basics', 'pick', 'results', 'snap', 'how', 'about']
const TITLES: Record<Step, string> = {
  start: 'HomePick DMV: find a home you can afford',
  basics: 'Check what fits your income · HomePick DMV',
  pick: 'Which would you rather live in? · HomePick DMV',
  results: 'Your top matches · HomePick DMV',
  snap: 'Snap a form · HomePick DMV',
  how: 'How it works · HomePick DMV',
  about: 'Our goal: income-restricted housing, made findable · HomePick DMV',
}
const stepFromState = (state: unknown): Step => {
  const s = (state as { step?: unknown } | null)?.step
  return STEPS.includes(s as Step) ? (s as Step) : 'start'
}


const PICKS_KEY = 'homepick.picks.v1'
const INTRO_KEY = 'homepick.intro.v1'
const AREAS_KEY = 'homepick.areas.v1'

/** The screen to open on load: a refresh mid-flow stays where you were (the URL hash names the step). */
function initialStep(basics: Basics | null): Step {
  const h = window.location.hash.slice(1) as Step
  if (!STEPS.includes(h)) return 'start'
  if ((h === 'pick' || h === 'results') && !basics) return 'basics'
  return h
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function saveJson(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage blocked: keep it in memory only */
  }
}

// Session storage only: income is gone when the tab closes, and storage can be blocked.
function loadBasics(): Basics | null {
  try {
    const raw = sessionStorage.getItem(BASICS_KEY)
    return raw ? sanitizeBasics(JSON.parse(raw)) : null
  } catch {
    return null
  }
}
function saveBasics(b: Basics) {
  try {
    sessionStorage.setItem(BASICS_KEY, JSON.stringify(b))
  } catch {
    /* storage blocked: keep it in memory only */
  }
}

/** Hide buildings whose known unit sizes are all smaller than what the person needs. Unknown sizes stay. */
function fitsBedrooms(b: Building, needed: number | null): boolean {
  return needed === null || b.bedrooms.length === 0 || Math.max(...b.bedrooms) >= needed
}

export default function App() {
  const [buildings, setBuildings] = useState<Building[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [basics, setBasics] = useState<Basics | null>(loadBasics)
  const [step, setStep] = useState<Step>(() => initialStep(basics))
  // Empty means all of the DMV.
  const [areas, setAreas] = useState<ReadonlySet<Area>>(() => {
    const saved = loadJson<unknown>(AREAS_KEY, [])
    return new Set(Array.isArray(saved) ? (saved.filter((a) => AREAS.some((k) => k.id === a)) as Area[]) : [])
  })
  const [picks, setPicks] = useState<Pick[]>([])
  // First arrival only: the page grows out of a blurred sunrise. Not after a refresh, not with reduced motion.
  const introRan = useRef(step === 'start' && !prefersReducedMotion() && !loadJson(INTRO_KEY, false))
  const [intro, setIntro] = useState(introRan.current)
  useEffect(() => {
    if (!introRan.current) return
    saveJson(INTRO_KEY, true)
    const t = window.setTimeout(() => setIntro(false), 1700)
    return () => window.clearTimeout(t)
  }, [])
  // The spotlight plays when the picks just finished, not when the results come back from history.
  const celebrateRef = useRef(false)
  // Picks are kept by id in this tab's session storage so a refresh mid-flow keeps the rounds you did.
  const savedPicks = useRef<unknown>(loadJson<unknown>(PICKS_KEY, []))
  const [message, setMessage] = useState('')

  const announce = useCallback((msg: string) => setMessage(msg), [])

  const [loadTry, setLoadTry] = useState(0)
  useEffect(() => {
    setLoadError('')
    fetch('/data/buildings.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<Building[]>
      })
      .then((rows) => {
        const byId = new Map(rows.map((b) => [b.id, b]))
        const saved = Array.isArray(savedPicks.current) ? savedPicks.current : []
        savedPicks.current = []
        const restored = saved.flatMap((p) => {
          const [c, o] = Array.isArray(p) ? p : []
          const chosen = byId.get(String(c))
          const other = byId.get(String(o))
          return chosen && other && chosen !== other ? [{ chosen, other }] : []
        })
        // Back on the picker with all rounds done would need a ninth pick: keep one round to go.
        if (restored.length) setPicks(restored.slice(0, stepRef.current === 'pick' ? ROUNDS - 1 : ROUNDS))
        setBuildings(rows)
      })
      .catch(() => setLoadError('We could not load the building list. Check your connection and try again.'))
  }, [loadTry])

  useEffect(() => saveJson(PICKS_KEY, picks.map((p) => [p.chosen.id, p.other.id])), [picks])
  useEffect(() => saveJson(AREAS_KEY, [...areas]), [areas])

  const situation = useMemo(() => (basics ? toSituation(basics) : null), [basics])
  const hub = HUBS.find((h) => h.id === basics?.workHub) ?? null
  const prior = useMemo(() => priorFor(basics?.priorities ?? [], !!hub), [basics, hub])
  // Only buildings the person appears to fit: never one whose estimated income limit their income is over.
  // When the chosen areas hold too few of those for eight rounds, neighboring areas join in and the screens say so.
  const { pool, widenNote } = useMemo(() => {
    const fitting = (buildings ?? []).filter(
      (b) =>
        isVisible(b, { includeSeniorDisability: basics?.includeSeniorDisability ?? false }) &&
        fitsBedrooms(b, basics?.bedroomsNeeded ?? null) &&
        (!situation || assess(b, limits, situation).limit !== 'over'),
    )
    const inAreas = (set: ReadonlySet<Area>) => fitting.filter((b) => set.size === 0 || set.has(b.area))
    const { areas: searched, added } = buildings ? widenAreas(areas, (set) => inAreas(set).length, MIN_POOL) : { areas, added: [] as Area[] }
    const kept = inAreas(searched)
    const names = (ids: Iterable<Area>) => new Intl.ListFormat('en', { type: 'conjunction' }).format([...ids].map((a) => areaInfo(a).short))
    const here = inAreas(areas).length
    const widenNote = added.length
      ? `${here === 0 ? 'No buildings' : here === 1 ? 'Only 1 building' : `Only ${here} buildings`} in ${names(areas)} fit your answers, so we added ${names(added)}.`
      : ''
    // Distance to work or school is worked out here in the browser and never saved.
    return { pool: hub ? kept.map((b) => ({ ...b, commuteMiles: Math.round(milesBetween(b.lat, b.lon, hub.lat, hub.lon) * 10) / 10 })) : kept, widenNote }
  }, [buildings, areas, basics, situation, hub])
  const weights = useMemo(() => fit(picks, limits, situation, prior), [picks, situation, prior])
  const seen = useMemo(() => new Set(picks.flatMap((p) => [p.chosen.id, p.other.id])), [picks])
  const pair = useMemo(() => nextPair(pool, seen, weights, limits, situation), [pool, seen, weights, situation])
  const shortlist = useMemo(
    () => shortlistFrom(rank(pool, weights, limits, situation), 3, (b) => !situation || assess(b, limits, situation).limit !== 'over'),
    [pool, weights, situation],
  )
  const isSample = !!buildings?.some((b) => b.sample)

  // Every screen change goes through here, so it gets the same transition and a history entry: the browser's
  // Back button goes to the previous screen instead of leaving the site.
  const stepRef = useRef(step)
  stepRef.current = step
  const basicsRef = useRef(basics)
  basicsRef.current = basics

  function go(next: Step, fromHistory = false) {
    // The picker and the results need the basics; Forward after "Start over" must not open an empty picker.
    if ((next === 'pick' || next === 'results') && !basicsRef.current) next = 'basics'
    if (fromHistory && next === stepRef.current) return
    if (!fromHistory) {
      try {
        window.history.pushState({ step: next }, '', next === 'start' ? window.location.pathname : `#${next}`)
      } catch {
        /* history blocked (sandboxed frame): the app still works */
      }
    }
    withTransition(() => {
      setStep(next)
      window.scrollTo({ top: 0 })
    })
  }

  useEffect(() => {
    try {
      const first = stepRef.current
      window.history.replaceState({ step: first }, '', first === 'start' ? window.location.pathname : `#${first}`)
    } catch {
      /* ignore */
    }
    const onPop = (e: PopStateEvent) => {
      // An in-page link (#main, #matches) makes a history entry with no step. Stay on this screen. A typed or
      // pasted hash that names a screen (#about, #how) is a real navigation, so open that screen.
      if (!STEPS.includes((e.state as { step?: Step } | null)?.step as Step)) {
        const named = window.location.hash.slice(1) as Step
        if (STEPS.includes(named) && named !== stepRef.current && !((named === 'pick' || named === 'results') && !basicsRef.current)) {
          go(named, true)
          return
        }
        try {
          window.history.replaceState({ step: stepRef.current }, '', window.location.href)
        } catch {
          /* ignore */
        }
        return
      }
      go(stepFromState(e.state), true)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // In-page links ("Skip to content", the results menu, "Choose my areas first") scroll and move focus on this
  // screen without touching the URL, so they never look like a navigation to the app's history.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]')
      const id = a?.getAttribute('href')?.slice(1)
      if (!id || STEPS.includes(id as Step)) return
      const el = document.getElementById(decodeURIComponent(id))
      if (!el) return
      e.preventDefault()
      if (!el.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.setAttribute('tabindex', '-1')
      el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
      el.focus({ preventScroll: true })
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  // The tab title says where you are.
  useEffect(() => {
    document.title = TITLES[step]
  }, [step])

  // Street View photos switch on when a (public, site-restricted) key is configured.
  useEffect(loadStreetViewKey, [])

  function begin() {
    setPicks([])
    go('basics')
  }

  function startIn(a: Area) {
    setAreas(new Set([a]))
    begin()
  }

  function toggleArea(a: Area) {
    setAreas((prev) => {
      const next = new Set(prev)
      if (next.has(a)) next.delete(a)
      else next.add(a)
      return next
    })
  }

  function onBasicsDone(b: Basics) {
    setBasics(b)
    basicsRef.current = b
    saveBasics(b)
    if (picks.length >= ROUNDS) {
      go('results')
      announce('Your matches are updated')
    } else {
      go('pick')
      announce('First pair ready')
    }
  }

  // A double tap must count once: the second tap lands on the next pair a few milliseconds later.
  const lastPickAt = useRef(0)
  function onPick(chosen: Building, other: Building) {
    const now = Date.now()
    if (now - lastPickAt.current < 350) return
    lastPickAt.current = now
    const next = [...picks, { chosen, other }]
    setPicks(next)
    announce(`You picked ${chosen.name}`)
    if (next.length >= ROUNDS) finish()
  }

  function finish() {
    celebrateRef.current = true
    go('results')
    announce('Your matches are ready')
  }

  // The spotlight plays once per finish: Back then Forward to the results must not replay it.
  useEffect(() => {
    if (step === 'results') celebrateRef.current = false
  }, [step])

  // Mid-flow with nothing left to compare (a small pool, or answers edited to a smaller one): show the matches
  // from the picks so far instead of an empty picker.
  useEffect(() => {
    if (step === 'pick' && buildings && !pair && picks.length > 0) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, buildings, pair, picks.length])

  function restart() {
    celebrateRef.current = false
    setPicks([])
    go('start')
    announce('Starting over')
  }

  // Move focus to the new screen's content so keyboard and screen reader users land on it. The picker focuses
  // its own group, so it is skipped here.
  useEffect(() => {
    if (step === 'start' || step === 'pick') return
    const el = document.getElementById('main')
    el?.focus({ preventScroll: true })
  }, [step])

  // Pool ran out before the rounds did: go straight to results.
  useEffect(() => {
    if (step === 'pick' && buildings && !pair && picks.length > 0) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pair, buildings, picks.length])

  return (
    <>
      {intro && <div aria-hidden className="intro-backdrop" />}
      <div data-step={step} className={`app-shell relative min-h-dvh text-ink ${intro ? 'intro-run' : ''}`}>
      <div aria-hidden className="sky" />
      <Lamp />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-40 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <nav aria-label="Site" className="pill-nav no-print fixed left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-xl py-1.5 pl-3 pr-1.5 sm:top-5 sm:gap-3 sm:pl-4">
        <button type="button" onClick={restart} className="group flex items-center gap-2 whitespace-nowrap rounded-full font-bold tracking-tight">
          <LogoMark className="size-7 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
          <span className="font-display text-base sm:text-lg">
            HomePick <span className="text-brand-strong">DMV</span>
          </span>
        </button>
        <button type="button" onClick={() => go('how')} aria-current={step === 'how' ? 'page' : undefined} className="hidden whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold text-ink/80 transition hover:text-brand-strong aria-[current=page]:text-brand-strong min-[480px]:inline-flex sm:text-sm">
          How it works
        </button>
        <button type="button" onClick={() => go('about')} aria-current={step === 'about' ? 'page' : undefined} className="hidden whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold text-ink/80 transition hover:text-brand-strong aria-[current=page]:text-brand-strong min-[560px]:inline-flex sm:text-sm">
          Our goal
        </button>
        {step === 'start' || step === 'how' || step === 'about' ? (
          <button type="button" onClick={begin} className="inline-flex min-h-9 items-center rounded-lg bg-dusk px-3.5 text-xs font-bold text-white transition hover:bg-ink sm:text-sm">
            Start
          </button>
        ) : (
          <button type="button" onClick={restart} className="inline-flex min-h-9 items-center whitespace-nowrap rounded-lg bg-brand-tint px-3.5 text-xs font-bold text-brand-strong transition hover:bg-brand hover:text-white sm:text-sm">
            Start over
          </button>
        )}
      </nav>

      <main id="main" tabIndex={-1} className={`outline-none ${step === 'start' || step === 'how' || step === 'about' ? '' : 'mx-auto max-w-6xl space-y-4 px-4 pb-5 pt-20 sm:pb-8 sm:pt-24'}`}>
        {step === 'about' && <About buildings={buildings} limits={limits} onBegin={begin} onHow={() => go('how')} />}
        {step === 'how' && (
          <HowItWorks buildings={buildings} limits={limits} searchLabel={areas.size === 0 ? 'Search all of the DMV' : `Search ${areas.size} ${areas.size === 1 ? 'area' : 'areas'}`} onBegin={begin} onSnap={() => go('snap')} />
        )}
        {step !== 'start' && step !== 'snap' && step !== 'how' && step !== 'about' && <StepIndicator current={step === 'basics' ? 0 : step === 'pick' ? 1 : 2} />}
        {isSample && (
          <Note tone="warn">
            Sample data. These buildings are made up for testing. Real HUD data loads once the data pipeline runs.
          </Note>
        )}

        {loadError && (
          <Card className="mx-auto max-w-md p-6 text-center">
            <p className="font-semibold">Something went wrong</p>
            <p className="mt-1 text-sm text-ink-soft">{loadError}</p>
            <Button className="mt-4" onClick={() => setLoadTry((n) => n + 1)}>
              Try again
            </Button>
          </Card>
        )}
        {!buildings && !loadError && (step === 'pick' || step === 'results') && (
          <div role="status" aria-label="Loading buildings" className="grid gap-4 py-6 md:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="overflow-hidden rounded-card border border-line bg-surface">
                <div className="skeleton h-44" />
                <div className="space-y-3 p-5">
                  <div className="skeleton h-5 w-2/3 rounded" />
                  <div className="skeleton h-4 w-1/2 rounded" />
                  <div className="skeleton h-8 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 'start' && (
          <Landing
            buildings={buildings}
            limits={limits}
            selected={areas}
            onToggleArea={toggleArea}
            onClearAreas={() => setAreas(new Set())}
            onBegin={begin}
            onStartIn={startIn}
            onSnap={() => go('snap')}
            firstVisit={introRan.current}
            onHow={() => go('how')}
            onAbout={() => go('about')}
          />
        )}

        {step === 'snap' && (
          <section className="rise-in mx-auto max-w-3xl space-y-4">
            <Button variant="secondary" onClick={() => go('start')}>
              Back to home
            </Button>
            <SnapForm announce={announce} standalone />
          </section>
        )}

        {buildings && step === 'pick' && pair && (
          <PickStep
            key={pair[0].id + pair[1].id}
            pair={pair}
            round={picks.length}
            rounds={ROUNDS}
            limits={limits}
            situation={situation}
            onPick={onPick}
            onUndo={() => {
              setPicks(picks.slice(0, -1))
              announce('Last pick undone')
            }}
            canUndo={picks.length > 0}
            onFinish={finish}
            announce={announce}
            note={widenNote}
          />
        )}
        {buildings && step === 'pick' && !pair && picks.length === 0 && (
          <Card className="p-6 text-center">
            <p className="font-medium">No two buildings in the whole DMV fit those answers.</p>
            <p className="mt-1 text-sm text-ink-soft">
              {basics && basics.income > (limits.mtsp['60'][Math.min(basics.householdSize, 8) - 1] ?? 0)
                ? `Income-restricted buildings here take households of ${basics.householdSize === 1 ? 'one' : basics.householdSize} up to about ${money(Math.round(((limits.mtsp['50'][Math.min(basics.householdSize, 8) - 1] ?? 0) * 1.6) / 10) * 10)} a year at the most (80% of area median), and most stop at ${money(limits.mtsp['60'][Math.min(basics.householdSize, 8) - 1] ?? 0)}. Check the income and household size.`
                : 'Try a different bedroom size, include senior or disability buildings, or check the income and household size.'}
            </p>
            <Button variant="secondary" className="mt-3" onClick={() => go('basics')}>
              Edit my answers
            </Button>
          </Card>
        )}

        {step === 'basics' && (
          <section
            aria-labelledby="basics-heading"
            className="glass-panel rise-in relative overflow-hidden p-5 sm:p-10"
          >
            <span aria-hidden className="metro-stripe absolute inset-x-0 top-0 h-1.5" />
            <BasicsForm initial={basics} onDone={onBasicsDone} limits={limits} />
          </section>
        )}

        {buildings && step === 'results' && (
          <ResultsStep
            shortlist={shortlist}
            weights={weights}
            prior={prior}
            chosen={basics?.priorities ?? []}
            limits={limits}
            situation={situation}
            onEditSituation={() => go('basics')}
            onRestart={restart}
            announce={announce}
            celebrate={celebrateRef.current}
            note={widenNote}
          />
        )}
      </main>

      {step !== 'how' && step !== 'about' && (
        <div aria-hidden className="dusk-fade no-print pt-10">
          <Skyline night className="block h-24 w-full sm:h-32" />
        </div>
      )}
      <footer className="no-print bg-dusk text-white/85">
        <div aria-hidden className="metro-stripe h-1.5" />
        <div className="mx-auto max-w-6xl space-y-1 px-4 py-8 text-xs">
          <p className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-white">
            <button type="button" onClick={() => go('about')} className="underline-offset-4 hover:underline">Our goal</button>
            <button type="button" onClick={() => go('how')} className="underline-offset-4 hover:underline">How it works</button>
            <a href="https://github.com/prateekm30/GDGHACKS" target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">Open source (MIT)</a>
          </p>
          <p>
            Data: HUD LIHTC, Multifamily, and Public Housing datasets; USDA Rural Development rentals; DC DHCD, Maryland DHCD, and City of Alexandria affordable housing lists. County outlines: U.S. Census TIGERweb. Income limits {limits.effective}{' '}
            for the Washington-Arlington-Alexandria HUD metro area. Not affiliated with HUD or any local government.
          </p>
          <p>
            Also try{' '}
            <a className="underline" href="https://www.dchousingsearch.org" target="_blank" rel="noreferrer">
              DCHousingSearch.org
            </a>{' '}
            and{' '}
            <a className="underline" href="https://www.virginiahousingsearch.com" target="_blank" rel="noreferrer">
              VirginiaHousingSearch.com
            </a>{' '}
            for current listings.
          </p>
        </div>
      </footer>

      <div aria-live="polite" className="sr-only">
        {message}
      </div>
      </div>
    </>
  )
}
