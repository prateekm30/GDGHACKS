import { useCallback, useEffect, useMemo, useState } from 'react'
import { PickStep } from './components/PickStep'
import { ResultsStep } from './components/ResultsStep'
import { BasicsForm, toSituation, type Basics } from './components/BasicsForm'
import { Landing } from './components/Landing'
import { SnapForm } from './components/SnapForm'
import { LogoMark } from './components/Logo'
import { Button, Card, Note, StepIndicator } from './components/ui'
import limitsJson from './data/limits.2026.json'
import { assess, isVisible } from './lib/eligibility'
import { HUBS, milesBetween } from './lib/areas'
import { fit, nextPair, priorFor, rank, type Pick } from './lib/ranking'
import type { Area, Building, IncomeLimits } from './lib/types'
import { withTransition } from './lib/motion'

const limits = limitsJson as IncomeLimits
const ROUNDS = 8
const BASICS_KEY = 'homepick.basics'

type Step = 'start' | 'basics' | 'pick' | 'results' | 'snap'


// Session storage only: income is gone when the tab closes, and storage can be blocked.
function loadBasics(): Basics | null {
  try {
    const raw = sessionStorage.getItem(BASICS_KEY)
    return raw ? (JSON.parse(raw) as Basics) : null
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
  const [step, setStep] = useState<Step>('start')
  // Empty means all of the DMV.
  const [areas, setAreas] = useState<ReadonlySet<Area>>(() => new Set())
  const [basics, setBasics] = useState<Basics | null>(loadBasics)
  const [picks, setPicks] = useState<Pick[]>([])
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
      .then(setBuildings)
      .catch(() => setLoadError('We could not load the building list. Check your connection and try again.'))
  }, [loadTry])

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
  // Top three, but if the top two are the same kind of building, the third is the best of the other kind.
  // Income-based buildings all show the same rent, so three of them in a row tells you little.
  const shortlist = useMemo(() => {
    const ranked = rank(pool, weights, limits, situation)
    const top = ranked.slice(0, 2)
    const other = top.length === 2 && top[0]?.program === top[1]?.program ? ranked.find((b) => b.program !== top[0]?.program) : undefined
    return [...top, other ?? ranked[2]].filter((b): b is Building => !!b)
  }, [pool, weights, situation])
  const isSample = !!buildings?.some((b) => b.sample)

  // Every screen change goes through here, so it gets the same transition.
  function go(next: Step) {
    withTransition(() => {
      setStep(next)
      window.scrollTo({ top: 0 })
    })
  }

  function begin() {
    setPicks([])
    go('basics')
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
    go('results')
    announce('Your matches are ready')
  }

  function restart() {
    setPicks([])
    go('start')
    announce('Starting over')
  }

  // Pool ran out before the rounds did: go straight to results.
  useEffect(() => {
    if (step === 'pick' && buildings && !pair && picks.length > 0) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pair, buildings, picks.length])

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="no-print sticky top-0 z-30 border-b border-line/70 bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <button type="button" onClick={restart} className="group flex items-center gap-2 whitespace-nowrap rounded-lg font-bold tracking-tight">
            <LogoMark className="size-8 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
            <span className="font-display text-lg">
              HomePick <span className="text-brand-strong">DMV</span>
            </span>
          </button>
          <span className="whitespace-nowrap rounded-full bg-ok-tint px-3 py-1 text-xs font-medium text-ok">
            <span className="hidden sm:inline">Your answers </span>
            <span className="sm:hidden">Answers </span>stay on this device
          </span>
        </div>
      </header>

      <main id="main" className={step === 'start' ? '' : 'mx-auto max-w-6xl space-y-6 px-4 py-8'}>
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
            selected={areas}
            onToggleArea={toggleArea}
            onClearAreas={() => setAreas(new Set())}
            onBegin={begin}
            onSnap={() => go('snap')}
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
            style={{ background: 'linear-gradient(160deg, #e4efff 0%, #d6e5fd 55%, #d8defa 100%)' }}
          >
            <span aria-hidden className="metro-stripe absolute inset-x-0 top-0 h-1.5" />
            <BasicsForm initial={basics} onDone={onBasicsDone} limits={limits} />
          </section>
        )}

        {buildings && step === 'results' && (
          <ResultsStep
            shortlist={shortlist}
            weights={weights}
            limits={limits}
            situation={situation}
            onEditSituation={() => go('basics')}
            onRestart={restart}
            announce={announce}
          />
        )}
      </main>

      <footer className="no-print bg-dusk text-white/85">
        <div aria-hidden className="metro-stripe h-1.5" />
        <div className="mx-auto max-w-6xl space-y-1 px-4 py-8 text-xs">
          <p>
            Data: HUD LIHTC and HUD Multifamily datasets. County outlines: U.S. Census TIGERweb. Income limits {limits.effective}{' '}
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
  )
}
