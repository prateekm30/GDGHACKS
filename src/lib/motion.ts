import { flushSync } from 'react-dom'
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Run a state change inside a View Transition when the browser supports it. */
export function withTransition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  if (!doc.startViewTransition || prefersReducedMotion()) return update()
  doc.startViewTransition(() => flushSync(update))
}

/** Adds .is-visible to every .reveal element inside the ref once it scrolls into view. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const items = root.querySelectorAll<HTMLElement>('.reveal')
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    items.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  return ref
}

/** Pointer handlers for a gentle 3D tilt and glare. Mouse and pen only; touch scrolls normally. */
export function tiltHandlers(max = 6) {
  return {
    onPointerMove(e: ReactPointerEvent<HTMLElement>) {
      if (e.pointerType === 'touch' || prefersReducedMotion()) return
      const el = e.currentTarget
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width
      const py = (e.clientY - r.top) / r.height
      el.style.setProperty('--ry', `${(px - 0.5) * max}deg`)
      el.style.setProperty('--rx', `${(0.5 - py) * max}deg`)
      el.style.setProperty('--gx', `${px * 100}%`)
      el.style.setProperty('--gy', `${py * 100}%`)
      el.style.setProperty('--go', '1')
    },
    onPointerLeave(e: ReactPointerEvent<HTMLElement>) {
      const el = e.currentTarget
      for (const p of ['--rx', '--ry']) el.style.setProperty(p, '0deg')
      el.style.setProperty('--go', '0')
    },
  }
}
