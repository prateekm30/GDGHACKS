import { Check } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
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
  const [chosenId, setChosenId] = useState<string | null>(null)

  // Show the pick for a moment (ring, check, other card fades), then move on. No delay with reduced motion.
  function choose(b: Building, other: Building) {
    if (chosenId) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return onPick(b, other)
    setChosenId(b.id)
    window.setTimeout(() => onPick(b, other), 280)
  }

  useEffect(() => {
    groupRef.current?.focus()
  }, [])

  // Arrow keys only while the picker has focus, so screen-reader keys are not taken over.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== groupRef.current) return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      choose(left, right)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      choose(right, left)
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
        className="relative grid gap-4 rounded-card md:grid-cols-2"
      >
        <span
          aria-hidden
          className="font-display pointer-events-none absolute left-1/2 top-1/2 z-10 hidden size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-base font-extrabold text-ink shadow-lift ring-4 ring-canvas md:grid"
        >
          or
        </span>
        {[
          [left, right],
          [right, left],
        ].map(([b, other], i) => (
          <Card
            key={b.id}
            className={`relative transition duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-lift ${
              i === 0 ? 'rise-in' : 'rise-in-delay'
            } ${chosenId === b.id ? 'scale-[1.01] border-brand ring-2 ring-brand' : chosenId ? 'scale-[0.98] opacity-40' : ''}`}
          >
            {chosenId === b.id && (
              <span aria-hidden className="pop absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-brand text-white shadow-lift">
                <Check className="size-6" strokeWidth={3} />
              </span>
            )}
            <button
              type="button"
              className="flex h-full w-full flex-col rounded-card p-5"
              onClick={() => choose(b, other)}
              aria-label={`Pick ${b.name}${i === 0 ? ' (left arrow)' : ' (right arrow)'}`}
            >
              <BuildingCard b={b} a={assess(b, limits, situation)} limits={limits} />
              <span className="mt-4 inline-flex w-full justify-center rounded-xl bg-brand-tint py-2.5 text-sm font-semibold text-brand-strong">
                {chosenId === b.id ? 'Picked' : 'Pick this one'}
              </span>
            </button>
          </Card>
        ))}
      </div>
    </section>
  )
}
