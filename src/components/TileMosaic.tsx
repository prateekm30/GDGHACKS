import { useMemo, useState } from 'react'
import { pickReel } from './HeroReel'
import { streetViewUrl, useStreetViewIndex, useStreetViewKey } from '../lib/streetview'
import type { Building } from '../lib/types'

/** Sunrise blocks between the photos. Illustration only, never text. */
const SOLIDS = ['#ffc53d', '#ff6b4a', '#cf2f6a', '#2a1f4d', '#ffd1a8', '#b88cff']

function PhotoTile({ b, k }: { b: Building; k: string }) {
  const [broken, setBroken] = useState(false)
  if (!k || broken) {
    return (
      <div className="tile solid" style={{ background: SOLIDS[b.name.length % SOLIDS.length] }}>
        <span className="tile-cap">{b.name}</span>
      </div>
    )
  }
  return (
    <div className="tile">
      <img src={streetViewUrl(b, k, 'a', 400, 460)} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
      <span className="tile-cap">
        {b.name}
        <span className="block font-normal text-white/75">{b.city}, {b.state}</span>
      </span>
    </div>
  )
}

/**
 * Three columns of real front doors and sunrise color blocks, drifting up and down for ever. Every photo is a
 * building in the data whose Street View location the index trusts. Decorative: hidden from assistive tech.
 */
export function TileMosaic({ buildings, className = '' }: { buildings: Building[] | null; className?: string }) {
  const index = useStreetViewIndex()
  const k = useStreetViewKey()
  const columns = useMemo(() => {
    const reel = buildings ? pickReel(buildings, index) : []
    // 3 columns x 5 cells: photo, solid, photo, photo, solid (offset per column), then cloned once for a seamless loop.
    const cols: (Building | string)[][] = [[], [], []]
    let p = 0
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < 5; i++) {
        const solid = (i + c) % 5 === 1 || (i + c) % 5 === 4
        cols[c].push(solid || !reel[p] ? SOLIDS[(c * 5 + i) % SOLIDS.length] : reel[p++])
      }
    }
    return cols
  }, [buildings, index])

  return (
    <div aria-hidden className={`mosaic ${className}`}>
      {columns.map((col, c) => (
        <div
          key={c}
          className={`mosaic-col ${c === 1 ? 'up' : ''}`}
          style={{ left: `calc(${c} * (var(--tw) + var(--tg)))`, top: c === 1 ? '-3rem' : c === 2 ? '2rem' : '0', animationDuration: `${34 + c * 5}s` }}
        >
          {[...col, ...col].map((cell, i) =>
            typeof cell === 'string' ? <div key={i} className="tile solid" style={{ background: cell }} /> : <PhotoTile key={i} b={cell} k={k} />,
          )}
        </div>
      ))}
    </div>
  )
}
