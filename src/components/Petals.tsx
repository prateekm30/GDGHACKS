import { useMemo, type CSSProperties } from 'react'

/**
 * Cherry-blossom petals drifting down: DC's own spring. Decorative only; reduced motion stops the animation,
 * which leaves every petal parked above the top edge.
 */
export function Petals({ count = 14, className = '' }: { count?: number; className?: string }) {
  const petals = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: `${(i / count) * 100 + Math.random() * (100 / count)}%`,
        dx: `${Math.round((Math.random() - 0.5) * 160)}px`,
        dur: `${9 + Math.random() * 9}s`,
        delay: `${-Math.random() * 15}s`,
        scale: (0.6 + Math.random() * 0.8).toFixed(2),
        tint: i % 3 === 0 ? '#ffd1dc' : i % 3 === 1 ? '#ffb7c5' : '#ffc9b8',
      })),
    [count],
  )
  return (
    <div aria-hidden className={`petals pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {petals.map((p, i) => (
        <span
          key={i}
          className="petal"
          style={{ left: p.left, '--dx': p.dx, '--dur': p.dur, '--delay': p.delay, '--s': p.scale, background: p.tint } as CSSProperties}
        />
      ))}
    </div>
  )
}
