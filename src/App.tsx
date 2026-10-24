import { useCallback, useEffect, useMemo, useState } from 'react'
import { PickStep } from './components/PickStep'
import { ResultsStep } from './components/ResultsStep'
import { BasicsForm, toSituation, type Basics } from './components/BasicsForm'
import { Landing, type AreaChoice } from './components/Landing'
import { LogoMark } from './components/Logo'
import { Button, Card, Note, StepIndicator } from './components/ui'
import limitsJson from './data/limits.2026.json'
import { isVisible } from './lib/eligibility'
import { fit, nextPair, priorFor, rank, type Pick } from './lib/ranking'
import type { Building, IncomeLimits } from './lib/types'

const limits = limitsJson as IncomeLimits
const ROUNDS = 8
const BASICS_KEY = 'homepick.basics'

type Step = 'start' | 'basics' | 'pick' | 'results'


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
  const [area, setArea] = useState<AreaChoice>('BOTH')
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

  // A real pair for the landing preview: one in DC, one in Arlington, different programs when possible.
  const preview = useMemo<[Building, Building] | null>(() => {
    if (!buildings) return null
    const dc = buildings.find((b) => b.area === 'DC' && b.program === 'LIHTC' && b.metroMiles !== null && b.metroMiles < 0.5)
    const va = buildings.find((b) => b.area === 'ARLINGTON' && b.program === 'HUD')
    return dc && va ? [dc, va] : null
  }, [buildings])

  const situation = useMemo(() => (basics ? toSituation(basics) : null), [basics])
  const prior = useMemo(() => priorFor(basics?.priorities ?? []), [basics])
  const pool = useMemo(
    () =>
      (buildings ?? []).filter(
        (b) =>
          (area === 'BOTH' || b.area === area) &&
          isVisible(b, { includeSeniorDisability: basics?.includeSeniorDisability ?? false }) &&
          fitsBedrooms(b, basics?.bedroomsNeeded ?? null),
      ),
    [buildings, area, basics],
  )
  const weights = useMemo(() => fit(picks, limits, situation, prior), [picks, situation, prior])
  const seen = useMemo(() => new Set(picks.flatMap((p) => [p.chosen.id, p.other.id])), [picks])
  const pair = useMemo(() => nextPair(pool, seen, weights, limits, situation), [pool, seen, weights, situation])
  const shortlist = useMemo(() => rank(pool, weights, limits, situation).slice(0, 3), [pool, weights, situation])
  const isSample = !!buildings?.some((b) => b.sample)

  function begin(choice: AreaChoice) {
    setArea(choice)
    setPicks([])
    setStep('basics')
    window.scrollTo({ top: 0 })
  }

  function onBasicsDone(b: Basics) {
    setBasics(b)
    saveBasics(b)
    window.scrollTo({ top: 0 })
    if (picks.length >= ROUNDS) {
      setStep('results')
      announce('Your matches are updated')
    } else {
      setStep('pick')
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
    setStep('results')
    announce('Your matches are ready')
    window.scrollTo({ top: 0 })
  }

  function restart() {
    setPicks([])
    setStep('start')
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
      <header className="no-print sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <button type="button" onClick={restart} className="flex items-center gap-2 whitespace-nowrap rounded-lg font-bold tracking-tight">
            <LogoMark />
            <span className="font-display text-lg">
              HomePick <span className="text-brand">DMV</span>
            </span>
          </button>
          <span className="whitespace-nowrap rounded-full bg-ok-tint px-3 py-1 text-xs font-medium text-ok">
            <span className="hidden sm:inline">Your answers </span>
            <span className="sm:hidden">Answers </span>stay on this device
          </span>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        {buildings && step !== 'start' && <StepIndicator current={step === 'basics' ? 0 : step === 'pick' ? 1 : 2} />}
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
        {!buildings && !loadError && (
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

        {buildings && step === 'start' && <Landing onBegin={begin} count={buildings.length} preview={preview} />}

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

        {buildings && step === 'basics' && (
          <section aria-labelledby="basics-heading">
            <Card className="mx-auto max-w-2xl p-6 sm:p-8">
              <BasicsForm initial={basics} onDone={onBasicsDone} />
            </Card>
          </section>
        )}

        {buildings && step === 'results' && (
          <ResultsStep
            shortlist={shortlist}
            weights={weights}
            limits={limits}
            situation={situation}
            onEditSituation={() => setStep('basics')}
            onRestart={restart}
            announce={announce}
          />
        )}
      </main>

      <footer className="no-print border-t border-line">
        <div className="mx-auto max-w-5xl space-y-1 px-4 py-6 text-xs text-ink-soft">
          <p>
            Data: HUD LIHTC and HUD Multifamily datasets. Income limits {limits.effective}. Not affiliated with HUD, DC, or
            Arlington County.
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
