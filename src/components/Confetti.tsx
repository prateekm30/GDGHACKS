import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../lib/motion'

const COLORS = ['#cf2f6a', '#ff8fb1', '#ffb27a', '#ff9f43', '#ffc53d', '#e0b3ff', '#ffffff']

/** One short burst of confetti from the top of the screen. Skipped with reduced motion. */
export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || prefersReducedMotion()) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = window.innerWidth
    const h = window.innerHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)
    const pieces = Array.from({ length: w < 640 ? 70 : 140 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: h * 0.25,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 14 - 4,
      size: 6 + Math.random() * 7,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)] as string,
      round: Math.random() < 0.3,
    }))
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = now - start
      ctx.clearRect(0, 0, w, h)
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 1800) / 900)
      for (const p of pieces) {
        p.vy += 0.38
        p.vx *= 0.985
        p.x += p.vx
        p.y += p.vy
        p.rot += p.spin
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        if (p.round) {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2.4, 0, Math.PI * 2)
          ctx.fill()
        } else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      }
      if (t < 2700) frame = requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, w, h)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-50 h-dvh w-screen" />
}
