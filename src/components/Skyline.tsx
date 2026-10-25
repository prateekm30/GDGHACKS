// Hand-drawn DC rowhouses, the Capitol, the Monument, and a Metro train. All decorative SVG, no images.
import { useRef, type PointerEvent } from 'react'

const HOUSE_COLORS = ['#ff6b4a', '#ff8fb1', '#d6264a', '#ffb27a', '#ff5fa2', '#b88cff', '#ffc53d', '#ff9f43', '#e2548f', '#9d6bff']
const TRIM = '#fff7ec'

/** Small seeded random, so a building always gets the same houses. */
function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

export function hashString(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

interface House {
  x: number
  w: number
  h: number
  color: string
  turret: boolean
  gable: boolean
  floors: number
  cols: number
}

function makeHouses(seed: number, width: number, minW: number, maxW: number, minH: number, maxH: number): House[] {
  const r = rng(seed)
  const out: House[] = []
  let x = 0
  let last = ''
  while (x < width) {
    const w = Math.round(minW + r() * (maxW - minW))
    let color = HOUSE_COLORS[Math.floor(r() * HOUSE_COLORS.length)] as string
    if (color === last) color = HOUSE_COLORS[(HOUSE_COLORS.indexOf(color) + 3) % HOUSE_COLORS.length] as string
    last = color
    const h = Math.round(minH + r() * (maxH - minH))
    out.push({ x, w, h, color, turret: r() < 0.22, gable: r() < 0.2, floors: h > (minH + maxH) / 2 ? 3 : 2, cols: w > (minW + maxW) / 2 ? 3 : 2 })
    x += w
  }
  return out
}

function HouseShape({ house, ground, seed, animated }: { house: House; ground: number; seed: number; animated: boolean }) {
  const { x, w, h, color, turret, gable, floors, cols } = house
  const top = ground - h
  const r = rng(seed)
  const winW = Math.min(16, (w - 20) / cols - 8)
  const gapX = (w - cols * winW) / (cols + 1)
  const floorH = (h - 46) / floors
  const doorCol = Math.floor(r() * cols)
  const windows = []
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      if (f === floors - 1 && c === doorCol) continue
      const wx = x + gapX + c * (winW + gapX)
      const wy = top + 22 + f * floorH
      const lit = r() < 0.55
      const flicker = animated && r() < 0.35
      windows.push(
        <g key={`${f}-${c}`}>
          <rect x={wx - 2} y={wy - 2} width={winW + 4} height={floorH * 0.62 + 4} rx={2} fill={TRIM} opacity={0.9} />
          <rect
            x={wx}
            y={wy}
            width={winW}
            height={floorH * 0.62}
            rx={1.5}
            fill={lit ? '#fff1c4' : '#2d1b4a'}
            className={flicker ? 'win' : undefined}
            style={flicker ? { animationDelay: `${(r() * -12).toFixed(1)}s`, animationDuration: `${(7 + r() * 8).toFixed(1)}s` } : undefined}
          />
          {/* Comes on as night falls (--night is driven by scroll) or when the pointer is near the house. */}
          {!lit && (
            <rect x={wx} y={wy} width={winW} height={floorH * 0.62} rx={1.5} fill="#fff1c4" className="win-night" style={{ animationDelay: `${(r() * 1.2).toFixed(2)}s` }} />
          )}
        </g>,
      )
    }
  }
  const doorX = x + gapX + doorCol * (winW + gapX) - 2
  const doorW = winW + 4
  return (
    <g className="house" data-x={x + w / 2}>
      {turret && <path d={`M${x + w * 0.2} ${top} L${x + w * 0.5} ${top - 34} L${x + w * 0.8} ${top} Z`} fill="#2a1f4d" />}
      {gable && !turret && <path d={`M${x} ${top} L${x + w / 2} ${top - 22} L${x + w} ${top} Z`} fill={color} />}
      <rect x={x} y={top} width={w} height={h} fill={color} />
      <rect x={x + w * 0.72} y={top} width={w * 0.28} height={h} fill="#000" opacity={0.08} />
      {/* Cornice */}
      <rect x={x - 2} y={top} width={w + 4} height={8} fill="#2a1f4d" opacity={0.85} />
      <rect x={x} y={top + 8} width={w} height={3} fill={TRIM} opacity={0.6} />
      {windows}
      {/* Door and stoop */}
      <rect x={doorX} y={ground - 30} width={doorW} height={26} rx={doorW / 2} ry={6} fill="#2a1f4d" />
      <rect x={doorX - 5} y={ground - 5} width={doorW + 10} height={5} fill={TRIM} opacity={0.85} />
    </g>
  )
}

/** The hero skyline: monuments behind, rowhouses in front, a Metro train on the line. */
export function Skyline({ className = '', animated = true, night = false }: { className?: string; animated?: boolean; night?: boolean }) {
  const W = 1440
  const ground = 250
  const houses = makeHouses(7, W, 70, 120, 120, 190)
  const ref = useRef<SVGSVGElement>(null)

  // Windows light up in the houses under the pointer, like walking down the block at dusk.
  function onMove(e: PointerEvent<SVGSVGElement>) {
    const svg = ref.current
    if (!svg || e.pointerType === 'touch') return
    const r = svg.getBoundingClientRect()
    // preserveAspectRatio="xMidYMax slice": the drawing is scaled to cover, centered on x.
    const scale = Math.max(r.width / W, r.height / 320)
    const x = (e.clientX - r.left - (r.width - W * scale) / 2) / scale
    for (const g of svg.querySelectorAll<SVGGElement>('g.house')) {
      const hx = Number(g.dataset.x)
      g.classList.toggle('is-near', Math.abs(hx - x) < 110)
    }
  }
  function onLeave() {
    ref.current?.querySelectorAll('g.house.is-near').forEach((g) => g.classList.remove('is-near'))
  }

  return (
    <svg
      ref={ref}
      aria-hidden
      viewBox={`0 0 ${W} 320`}
      preserveAspectRatio="xMidYMax slice"
      className={`${className} ${night ? 'is-night' : ''}`}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {night && (
        <g>
          {Array.from({ length: 40 }, (_, i) => {
            const r = rng(i * 7 + 3)
            return <circle key={i} cx={r() * W} cy={r() * 150} r={0.8 + r() * 1.4} fill="#fff6e8" className="star" style={{ animationDelay: `${(r() * -6).toFixed(1)}s` }} />
          })}
          <circle cx="1180" cy="70" r="26" fill="#fff6e8" />
          <circle cx="1192" cy="62" r="22" fill="#2a1f4d" />
        </g>
      )}
      {/* Monuments, far away */}
      <g fill={night ? '#5a3a6e' : '#d9a0b8'} opacity="0.55">
        <path d="M1010 250 L1016 40 L1022 30 L1028 40 L1034 250 Z" />
        <rect x="280" y="170" width="200" height="80" />
        <rect x="320" y="140" width="120" height="30" />
        <path d="M330 140 Q380 58 430 140 Z" />
        <rect x="372" y="64" width="16" height="22" />
        <path d="M374 64 L380 46 L386 64 Z" />
      </g>
      <g className={animated ? 'houses-up' : undefined}>
        {houses.map((h, i) => (
          <HouseShape key={i} house={h} ground={ground} seed={i * 97 + 13} animated={animated} />
        ))}
      </g>
      {/* Street, track, and train */}
      <rect x="0" y={ground} width={W} height="70" fill="#2a1f4d" />
      <rect x="0" y={ground + 22} width={W} height="4" fill="#ffc53d" opacity="0.9" />
      <g className={animated ? 'train' : undefined} style={animated ? undefined : { transform: 'translateX(55%)' }}>
        <g transform={`translate(0 ${ground + 30})`}>
          {[0, 1, 2].map((c) => (
            <g key={c} transform={`translate(${c * 128} 0)`}>
              <rect width="124" height="30" rx="8" fill="#d9dde0" />
              <rect y="18" width="124" height="5" fill="#cf2f6a" />
              {[10, 34, 58, 82, 104].map((wx) => (
                <rect key={wx} x={wx} y="5" width="14" height="10" rx="2" fill="#2a1f4d" />
              ))}
            </g>
          ))}
        </g>
      </g>
    </svg>
  )
}

/** A few rowhouses for a card photo when the aerial photo can't load. */
export function RowhouseArt({ seed, className = '' }: { seed: number; className?: string }) {
  const W = 320
  const ground = 150
  const houses = makeHouses(seed, W, 80, 120, 90, 130)
  return (
    <svg aria-hidden viewBox={`0 0 ${W} 160`} preserveAspectRatio="xMidYMax slice" className={className}>
      {houses.map((h, i) => (
        <HouseShape key={i} house={h} ground={ground} seed={seed + i * 31} animated={false} />
      ))}
      <rect x="0" y={ground} width={W} height="10" fill="#2a1f4d" />
    </svg>
  )
}
