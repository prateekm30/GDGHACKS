import type { ReactNode } from 'react'
import type { BurdenLevel } from '../lib/eligibility'

export function Button({
  children,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const styles = {
    primary: 'bg-brand text-white hover:bg-brand-strong',
    secondary: 'bg-surface text-ink border border-line hover:border-brand hover:text-brand',
    ghost: 'text-brand hover:bg-brand-tint',
  }[variant]
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${styles} ${props.className ?? ''}`}
    >
      {children}
    </button>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card bg-surface shadow-card border border-line ${className}`}>{children}</div>
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
    <span className="inline-flex rounded-full bg-canvas border border-line px-2.5 py-1 text-xs font-medium text-ink-soft">
      {children}
    </span>
  )
}

export function Note({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: ReactNode }) {
  const cls = tone === 'warn' ? 'bg-stretch-tint text-stretch' : 'bg-brand-tint text-brand-strong'
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
