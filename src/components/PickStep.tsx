import { useEffect, useRef, type KeyboardEvent } from 'react'
import { assess } from '../lib/eligibility'
import type { Building, IncomeLimits, Situation } from '../lib/types'
import { BuildingCard } from './BuildingCard'
import { Button, Card, ProgressBar } from './ui'

export function PickStep({
  pair,
  round,
  rounds,
  limits,
  situation,
  onPick,
  onUndo,
  canUndo,
  onFinish,
}: {
  pair: [Building, Building]
  round: number
  rounds: number
  limits: IncomeLimits
  situation: Situation | null
  onPick: (chosen: Building, other: Building) => void
  onUndo: () => void
  canUndo: boolean
  onFinish: () => void
}) {
  const groupRef = useRef<HTMLDivElement>(null)
  const [left, right] = pair

  useEffect(() => {
    groupRef.current?.focus()
  }, [])

  // Arrow keys only while the picker has focus, so screen-reader keys are not taken over.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== groupRef.current) return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onPick(left, right)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      onPick(right, left)
    }
  }

  return (
    <section aria-labelledby="pick-heading" className="space-y-5">
      <ProgressBar value={round} max={rounds} label="Your picks" />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="pick-heading" className="text-2xl font-bold tracking-tight">
            Which would you rather live in?
          </h2>
          <p className="text-sm text-ink-soft">Tap a building. With a keyboard, focus here and use the left and right arrow keys.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onUndo} disabled={!canUndo}>
            Undo
          </Button>
          {round >= 3 && (
            <Button variant="ghost" onClick={onFinish}>
              See my matches
            </Button>
          )}
        </div>
      </div>
      <div
        ref={groupRef}
        tabIndex={0}
        role="group"
        aria-label={`Choose between ${left.name} and ${right.name}`}
        onKeyDown={onKeyDown}
        className="grid gap-4 rounded-card md:grid-cols-2"
      >
        {[
          [left, right],
          [right, left],
        ].map(([b, other], i) => (
          <Card key={b.id} className="transition hover:-translate-y-0.5 hover:border-brand">
            <button
              type="button"
              className="flex h-full w-full flex-col rounded-card p-5"
              onClick={() => onPick(b, other)}
              aria-label={`Pick ${b.name}${i === 0 ? ' (left arrow)' : ' (right arrow)'}`}
            >
              <BuildingCard b={b} a={assess(b, limits, situation)} limits={limits} />
              <span className="mt-4 inline-flex w-full justify-center rounded-xl bg-brand-tint py-2 text-sm font-semibold text-brand">
                Pick this one
              </span>
            </button>
          </Card>
        ))}
      </div>
    </section>
  )
}
