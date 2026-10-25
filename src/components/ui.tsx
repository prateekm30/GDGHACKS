import type { CSSProperties, ReactNode } from 'react'
import type { BurdenLevel } from '../lib/eligibility'
import { Check } from 'lucide-react'

export function Button({
  children,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const styles = {
    primary: 'bg-brand text-white shadow-sm hover:bg-brand-strong hover:shadow-md active:scale-[0.98]',
    secondary: 'bg-surface text-ink border border-line hover:border-brand hover:text-brand active:scale-[0.98]',
    ghost: 'text-brand-strong hover:bg-brand-tint',
  }[variant]
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50 ${styles} ${props.className ?? ''}`}
    >
      {children}
    </button>
  )
}

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`rounded-card bg-surface shadow-card border border-line ${className}`} style={style}>
      {children}
    </div>
  )
}

const BADGE: Record<BurdenLevel, string> = {
  ok: 'bg-ok-tint text-ok',
  stretch: 'bg-stretch-tint text-stretch',
  heavy: 'bg-heavy-tint text-heavy',
}

export function BurdenBadge({ level, children }: { level: BurdenLevel; children: ReactNode }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE[level]}`}>{children}</span>
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-canvas px-2.5 py-1 text-xs font-medium text-ink-soft">
      {children}
    </span>
  )
}

export function Note({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'danger'; children: ReactNode }) {
  const cls = tone === 'warn' ? 'bg-stretch-tint text-stretch' : tone === 'danger' ? 'bg-heavy-tint text-heavy' : 'bg-brand-tint text-brand-strong'
  return <p className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${cls}`}>{children}</p>
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs font-medium text-ink-soft">
        <span>{label}</span>
        <span>
          {Math.min(value, max)} of {max}
        </span>
      </div>
      <div
        className="h-2 rounded-full bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(value, max)}
        aria-label={label}
      >
        <div className="h-2 rounded-full bg-brand transition-all" style={{ width: `${(Math.min(value, max) / max) * 100}%` }} />
      </div>
    </div>
  )
}

export const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US')

const FUNNEL = ['Basics', 'Pick', 'Shortlist'] as const

/** Where you are in the three steps. Done steps show a check. */
export function StepIndicator({ current }: { current: 0 | 1 | 2 }) {
  return (
    <nav aria-label="Progress" className="no-print">
      <ol className="flex items-center gap-2 text-xs font-semibold sm:text-sm">
        {FUNNEL.map((name, i) => {
          const state = i < current ? 'done' : i === current ? 'now' : 'next'
          return (
            <li key={name} className="flex items-center gap-2" aria-current={state === 'now' ? 'step' : undefined}>
              <span
                className={`grid size-6 place-items-center rounded-full text-[11px] transition-colors ${
                  state === 'done' ? 'bg-brand text-white' : state === 'now' ? 'bg-accent text-ink' : 'bg-line text-ink-soft'
                }`}
              >
                {state === 'done' ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className={state === 'next' ? 'text-ink-soft' : 'text-ink'}>
                {name}
                {state === 'done' && <span className="sr-only"> (done)</span>}
              </span>
              {i < FUNNEL.length - 1 && <span aria-hidden className={`h-px w-6 sm:w-10 ${i < current ? 'bg-brand' : 'bg-line'}`} />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
