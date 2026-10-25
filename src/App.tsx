import { ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PickStep } from './components/PickStep'
import { ResultsStep } from './components/ResultsStep'
import { BasicsForm, sanitizeBasics, toSituation, type Basics } from './components/BasicsForm'
import { Landing } from './components/Landing'
import { SnapForm } from './components/SnapForm'
import { LogoMark } from './components/Logo'
import { Button, Card, Note, StepIndicator } from './components/ui'
import limitsJson from './data/limits.2026.json'
import { assess, isVisible } from './lib/eligibility'
import { AREAS, HUBS, milesBetween } from './lib/areas'
import { fit, nextPair, priorFor, rank, shortlistFrom, type Pick } from './lib/ranking'
import type { Area, Building, IncomeLimits } from './lib/types'
import { prefersReducedMotion, withTransition } from './lib/motion'
import { loadStreetViewKey } from './lib/streetview'
import { Skyline } from './components/Skyline'
import { Lamp } from './components/Lamp'

const limits = limitsJson as IncomeLimits
const ROUNDS = 8
const BASICS_KEY = 'homepick.basics'

type Step = 'start' | 'basics' | 'pick' | 'results' | 'snap'
const STEPS: readonly Step[] = ['start', 'basics', 'pick', 'results', 'snap']
const TITLES: Record<Step, string> = {
  start: 'HomePick DMV: find a home you can afford',
  basics: 'Your basics · HomePick DMV',
  pick: 'Which would you rather live in? · HomePick DMV',
  results: 'Your top matches · HomePick DMV',
  snap: 'Snap a form · HomePick DMV',
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
  const pool = useMemo(() => {
    const kept = (buildings ?? []).filter(
      (b) =>
        (areas.size === 0 || areas.has(b.area)) &&
        isVisible(b, { includeSeniorDisability: basics?.includeSeniorDisability ?? false }) &&
        fitsBedrooms(b, basics?.bedroomsNeeded ?? null) &&
        !(basics?.hideOverLimit && situation && assess(b, limits, situation).limit === 'over'),
    )
    // Distance to work or school is worked out here in the browser and never saved.
    return hub ? kept.map((b) => ({ ...b, commuteMiles: Math.round(milesBetween(b.lat, b.lon, hub.lat, hub.lon) * 10) / 10 })) : kept
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
      // An in-page link (#main, #matches) makes a history entry with no step. Stay on this screen.
      if (!STEPS.includes((e.state as { step?: Step } | null)?.step as Step)) {
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

  function onPick(chosen: Building, other: Building) {
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
      <div data-step={step} className={`app-shell relative min-h-dvh bg-canvas text-ink ${intro ? 'intro-run' : ''}`}>
      <Lamp />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-40 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <nav aria-label="Site" className="pill-nav no-print fixed left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full py-1.5 pl-3 pr-1.5 sm:top-5 sm:gap-3 sm:pl-4">
        <button type="button" onClick={restart} className="group flex items-center gap-2 whitespace-nowrap rounded-full font-bold tracking-tight">
          <LogoMark className="size-7 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
          <span className="font-display text-base sm:text-lg">
            HomePick <span className="text-brand-strong">DMV</span>
          </span>
        </button>
        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-ok-tint px-2 py-1 text-[11px] font-medium text-ok sm:px-2.5 sm:text-xs">
          <ShieldCheck aria-hidden className="size-3.5" />
          <span className="hidden sm:inline">Stays on this device</span>
          <span className="sr-only sm:hidden">Your answers stay on this device</span>
        </span>
        {step === 'start' ? (
          <button type="button" onClick={begin} className="inline-flex min-h-9 items-center rounded-full bg-dusk px-3.5 text-xs font-bold text-white transition hover:bg-ink sm:text-sm">
            Start
          </button>
        ) : (
          <button type="button" onClick={restart} className="inline-flex min-h-9 items-center whitespace-nowrap rounded-full bg-brand-tint px-3.5 text-xs font-bold text-brand-strong transition hover:bg-brand hover:text-white sm:text-sm">
            Start over
          </button>
        )}
      </nav>

      <main id="main" tabIndex={-1} className={`outline-none ${step === 'start' ? '' : 'mx-auto max-w-6xl space-y-4 px-4 pb-5 pt-20 sm:space-y-6 sm:pb-8 sm:pt-24'}`}>
        {step !== 'start' && step !== 'snap' && <StepIndicator current={step === 'basics' ? 0 : step === 'pick' ? 1 : 2} />}
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
          />
        )}

        {step === 'snap' && (
          <section className="rise-in mx-auto max-w-3xl space-y-4">
            <Button variant="secondary" onClick={() => go('start')}>
              Back to home
            </Button>
            <SnapForm announce={announce} />
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
          />
        )}
        {buildings && step === 'pick' && !pair && picks.length === 0 && (
          <Card className="p-6 text-center">
            <p className="font-medium">Not enough buildings here to compare.</p>
            <Button variant="secondary" className="mt-3" onClick={restart}>
              Choose another area
            </Button>
          </Card>
        )}

        {step === 'basics' && (
          <section
            aria-labelledby="basics-heading"
            className="rise-in relative overflow-hidden rounded-[2rem] p-5 shadow-card sm:p-10"
            style={{ background: 'linear-gradient(160deg, #fff0dd 0%, #ffd9d2 55%, #f1d6f5 100%)' }}
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
          />
        )}
      </main>

      {step !== 'start' && (
        <div aria-hidden className="dusk-fade no-print pt-10">
          <Skyline night className="block h-24 w-full sm:h-32" />
        </div>
      )}
      <footer className="no-print bg-dusk text-white/85">
        <div aria-hidden className="metro-stripe h-1.5" />
        <div className="mx-auto max-w-6xl space-y-1 px-4 py-8 text-xs">
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
