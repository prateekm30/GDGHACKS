import { useEffect } from 'react'
import { prefersReducedMotion } from '../lib/motion'

/** One soft light that follows the pointer across every screen. Touch devices and reduced motion get nothing. */
export function Lamp() {
  useEffect(() => {
    if (prefersReducedMotion() || !window.matchMedia?.('(hover: hover)').matches) return
    const root = document.documentElement
    let raf = 0
    let x = 0
    let y = 0
    const paint = () => {
      raf = 0
      root.style.setProperty('--lx', `${x}px`)
      root.style.setProperty('--ly', `${y}px`)
      root.style.setProperty('--lamp', '1')
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      x = e.clientX
      y = e.clientY
      if (!raf) raf = requestAnimationFrame(paint)
    }
    const onLeave = () => root.style.setProperty('--lamp', '0')
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
  return <div aria-hidden className="lamp" />
}
