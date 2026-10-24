import { useCallback, useEffect, useMemo, useState } from 'react'
import { PickStep } from './components/PickStep'
import { ResultsStep } from './components/ResultsStep'
import { BasicsForm, toSituation, type Basics } from './components/BasicsForm'
import { Button, Card, Note } from './components/ui'
import limitsJson from './data/limits.2026.json'
import { isVisible } from './lib/eligibility'
import { fit, nextPair, priorFor, rank, type Pick } from './lib/ranking'
import type { Area, Building, IncomeLimits } from './lib/types'

const limits = limitsJson as IncomeLimits
const ROUNDS = 8
const BASICS_KEY = 'homepick.basics'

type Step = 'start' | 'basics' | 'pick' | 'results'
type AreaChoice = Area | 'BOTH'

const AREA_OPTIONS: { value: AreaChoice; title: string; hint: string }[] = [
  { value: 'DC', title: 'Washington, DC', hint: 'All eight wards' },
  { value: 'ARLINGTON', title: 'Arlington, VA', hint: 'Arlington County' },
  { value: 'BOTH', title: 'Both', hint: 'Show me everything' },
]

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

  useEffect(() => {
    fetch('/data/buildings.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<Building[]>
      })
      .then(setBuildings)
      .catch(() => setLoadError('We could not load the building list. Check your connection and reload.'))
  }, [])

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
      <header className="no-print border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <button type="button" onClick={restart} className="flex items-center gap-2 whitespace-nowrap rounded-lg font-bold tracking-tight">
            <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-brand text-white">H</span>
            HomePick DMV
          </button>
          <span className="whitespace-nowrap rounded-full bg-ok-tint px-3 py-1 text-xs font-medium text-ok">
            <span className="hidden sm:inline">Your answers </span>
            <span className="sm:hidden">Answers </span>stay on this device
          </span>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        {isSample && (
          <Note tone="warn">
            Sample data. These buildings are made up for testing. Real HUD data loads once the data pipeline runs.
          </Note>
        )}

        {loadError && <Note tone="warn">{loadError}</Note>}
        {!buildings && !loadError && (
          <div role="status" className="py-16 text-center text-ink-soft">
            Loading buildings…
          </div>
        )}

        {buildings && step === 'start' && (
          <section aria-labelledby="start-heading" className="space-y-8 py-6">
            <div className="max-w-2xl space-y-3">
              <h1 id="start-heading" className="text-4xl font-bold tracking-tight sm:text-5xl">
                Find income-restricted apartments you'd actually pick.
              </h1>
              <p className="text-lg text-ink-soft">
                Answer a few quick questions, then pick between two real buildings at a time. We learn what matters to you,
                estimate what you'd pay, and give you a short list with next steps.
              </p>
            </div>
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">Where do you want to live?</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {AREA_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => begin(o.value)}
                    className="rounded-card border border-line bg-surface p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-brand"
                  >
                    <span className="block text-lg font-semibold">{o.title}</span>
                    <span className="text-sm text-ink-soft">{o.hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <p className="max-w-2xl text-xs text-ink-soft">
              Estimates only. Each property decides who qualifies. We never rank by neighborhood, schools, or who lives
              there.
            </p>
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
