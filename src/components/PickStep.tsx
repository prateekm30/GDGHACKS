import { Check, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { assess } from '../lib/eligibility'
import { prefersReducedMotion, tiltHandlers } from '../lib/motion'
import type { Building, IncomeLimits, Situation } from '../lib/types'
import { BuildingCard, summary } from './BuildingCard'
import { Button } from './ui'

/** Progress as stops on a Metro line: done stops are filled, the current one pulses. */
function MetroProgress({ value, max }: { value: number; max: number }) {
  const done = Math.min(value, max)
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs font-semibold text-ink-soft">
        <span>Your picks</span>
        <span>
          {done} of {max}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={done}
        aria-label="Your picks"
        className="relative flex items-center justify-between"
      >
        <span aria-hidden className="absolute inset-x-2 h-1.5 rounded-full bg-line" />
        <span
          aria-hidden
          className="absolute left-2 h-1.5 rounded-full bg-brand transition-[width] duration-500 ease-out"
          style={{ width: `calc(${(done / max) * 100}% - ${(done / max) * 1}rem)` }}
        />
        {Array.from({ length: max + 1 }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={`relative grid size-4 place-items-center rounded-full border-[3px] transition-colors duration-300 ${
              i <= done ? 'border-brand bg-white' : 'border-line bg-white'
            }`}
          >
            {i === done && i < max && <span className="absolute inset-[-6px] animate-ping rounded-full bg-brand/30" />}
          </span>
        ))}
      </div>
    </div>
  )
}

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
  announce,
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
  announce?: (msg: string) => void
}) {
  const groupRef = useRef<HTMLDivElement>(null)
  const [left, right] = pair
  const [chosenId, setChosenId] = useState<string | null>(null)

  // Each new pair: focus the picker and say what the choice is.
  useEffect(() => {
    groupRef.current?.focus({ preventScroll: true })
    announce?.(`Round ${round + 1} of ${rounds}: ${left.name} or ${right.name}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Show the pick for a moment (the card lifts away, the other drops), then move on. No delay with reduced motion.
  function choose(b: Building, other: Building) {
    if (chosenId) return
    if (prefersReducedMotion()) return onPick(b, other)
    setChosenId(b.id)
    window.setTimeout(() => onPick(b, other), 430)
  }

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
    <section aria-labelledby="pick-heading" className="space-y-3 sm:space-y-6">
      <MetroProgress value={round} max={rounds} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="pick-heading" className="text-xl font-extrabold sm:text-4xl">
            Which would you rather live in?
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            <span className="sm:hidden">Tap the one you'd rather live in.</span>
            <span className="hidden sm:inline">Tap a building. With a keyboard, focus here and use the left and right arrow keys.</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onUndo} disabled={!canUndo}>
            <Undo2 aria-hidden className="mr-1.5 size-4" />
            Undo
          </Button>
          {round >= 3 && (
            <Button variant="ghost" onClick={onFinish}>
              See my matches
            </Button>
          )}
        </div>
      </div>
      {/* Two columns at every width, so both buildings are on screen together, even on a phone. */}
      <div
        ref={groupRef}
        tabIndex={0}
        role="group"
        aria-label={`Choose between ${left.name} and ${right.name}`}
        onKeyDown={onKeyDown}
        className="relative grid grid-cols-2 gap-2.5 rounded-card sm:gap-5"
      >
        <span
          aria-hidden
          className={`wiggle font-display pointer-events-none absolute left-1/2 top-16 z-30 grid size-10 place-items-center rounded-full bg-accent text-sm font-extrabold text-ink shadow-lift ring-4 ring-canvas transition-opacity duration-200 sm:top-[6.5rem] sm:size-16 sm:text-xl sm:ring-[6px] ${
            chosenId ? 'opacity-0' : ''
          }`}
        >
          or
        </span>
        {[
          [left, right],
          [right, left],
        ].map(([b, other], i) => {
          const a = assess(b, limits, situation)
          const state = chosenId === b.id ? 'picked' : chosenId ? 'dropped' : i === 0 ? 'in-left' : 'in-right'
          return (
            <div key={b.id} className={`min-w-0 ${state}`} style={{ ['--drop-r' as string]: i === 0 ? '-4deg' : '4deg' }}>
              {/* The whole card is a click target for mouse and touch; the button below is the real control. */}
              <div
                {...tiltHandlers()}
                onClick={() => choose(b, other)}
                className="tilt group relative flex h-full cursor-pointer flex-col overflow-hidden glass-panel rounded-card hover:ring-brand hover:shadow-lift"
              >
                {chosenId === b.id && (
                  <span aria-hidden className="pop absolute right-3 top-3 z-20 grid size-10 place-items-center rounded-full bg-brand text-white shadow-lift ring-4 ring-white sm:size-14">
                    <Check className="size-6 sm:size-8" strokeWidth={3} />
                  </span>
                )}
                <span aria-hidden className="glare pointer-events-none absolute inset-0 z-10" />
                <BuildingCard b={b} a={a} limits={limits} situation={situation} compact />
                <div className="px-2.5 pb-2.5 sm:px-4 sm:pb-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      choose(b, other)
                    }}
                    aria-label={`Pick ${summary(b, a)}.${i === 0 ? ' Left arrow key.' : ' Right arrow key.'}`}
                    className="sheen flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand py-2 text-sm font-bold text-white transition duration-200 hover:bg-brand-strong active:scale-[0.98] sm:min-h-12 sm:rounded-2xl sm:py-3"
                  >
                    {chosenId === b.id ? 'Picked!' : 'Pick this one'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <p aria-hidden className="font-hand text-center text-2xl text-ink-soft">
        no wrong answers, just go with your gut
      </p>
    </section>
  )
}
