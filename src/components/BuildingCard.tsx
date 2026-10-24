import type { Assessment } from '../lib/eligibility'
import type { Building, IncomeLimits } from '../lib/types'
import { Accessibility, BedDouble, Building2, Check, Hammer, HeartHandshake, MapPin, TrainFront, type LucideIcon } from 'lucide-react'
import { BuildingPhoto } from './BuildingPhoto'
import { BurdenBadge, Note, Pill, money } from './ui'

const BR = (n: number | null) => (n === null ? '' : n === 0 ? 'studio' : `${n}BR`)

/** Facts we actually have from HUD. HUD lists no amenities (laundry, parking), so we don't invent any. */
function facts(b: Building): { icon: LucideIcon; label: string }[] {
  const out: { icon: LucideIcon; label: string }[] = []
  if (b.metroMiles !== null) out.push({ icon: TrainFront, label: b.metroMiles < 0.15 ? 'Next to Metro' : `${b.metroMiles.toFixed(1)} mi to Metro` })
  if (b.bedrooms.length) {
    const lo = Math.min(...b.bedrooms)
    const hi = Math.max(...b.bedrooms)
    out.push({ icon: BedDouble, label: lo === hi ? BR(lo) : `${BR(lo)} to ${BR(hi)}` })
  }
  if (b.yearPlacedInService) out.push({ icon: Hammer, label: `Opened ${b.yearPlacedInService}` })
  if (b.affordableUnits) out.push({ icon: Building2, label: `${b.affordableUnits} affordable homes` })
  out.push({ icon: MapPin, label: b.area === 'DC' ? 'Washington, DC' : 'Arlington, VA' })
  if (b.seniorOnly) out.push({ icon: HeartHandshake, label: 'Seniors (62+)' })
  if (b.disabilityOnly) out.push({ icon: Accessibility, label: 'For people with disabilities' })
  return out
}

export function CostLine({ a }: { a: Assessment }) {
  const c = a.cost
  if (c.kind === 'income-based') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <BurdenBadge level="ok">Income-based rent</BurdenBadge>
        <span className="text-sm text-ink-soft">
          {c.monthly !== null ? (
            <>About {money(c.monthly)}/mo: 30% of the income you entered</>
          ) : (
            <>Rent is set at about 30% of whatever your household earns</>
          )}
        </span>
      </div>
    )
  }
  if (c.kind === 'unknown' || c.monthly === null) {
    return <span className="text-sm text-ink-soft">Rent limit varies by unit. Ask the property.</span>
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-lg font-bold">{money(c.monthly)}</span>
      <span className="text-sm text-ink-soft">
        max gross rent{c.bedrooms !== null ? `, ${BR(c.bedrooms)}` : ''}
        {c.assumedCeiling ? ' (assumed 60% limit)' : ''}
      </span>
      {c.burdenPct !== null && c.level && (
        <BurdenBadge level={c.level}>About {c.burdenPct}% of your income</BurdenBadge>
      )}
    </div>
  )
}

export function LimitLine({ a, limits }: { a: Assessment; limits: IncomeLimits }) {
  if (a.limit === 'unknown') return null
  const text = {
    under: 'You appear to be under the estimated income limit.',
    over: "You appear to be over this building's estimated income limit.",
    varies: 'Income limit varies by unit. Ask the property.',
  }[a.limit]
  return (
    <p className="text-sm">
      {text}{' '}
      <span className="text-ink-soft">
        ({limits.effective} limits{a.limitAmount ? `, ${money(a.limitAmount)} for your household` : ''}. The property decides.)
      </span>
    </p>
  )
}

export function BuildingCard({
  b,
  a,
  limits,
  reasons = [],
  detailed = false,
}: {
  b: Building
  a: Assessment
  limits: IncomeLimits
  reasons?: string[]
  detailed?: boolean
}) {
  return (
    <div className="flex h-full flex-col gap-3 text-left">
      <div className="relative -mx-5 -mt-5 mb-1">
        <BuildingPhoto b={b} className={`rounded-t-card ${detailed ? 'h-36' : 'h-40 sm:h-44'}`} />
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-ink shadow-sm">
          {b.program === 'LIHTC' ? 'Tax credit (LIHTC)' : 'HUD-assisted'}
        </span>
      </div>
      <div>
        <h3 className="text-lg font-semibold leading-snug">{b.name}</h3>
        <p className="text-sm text-ink-soft">
          {b.address}, {b.city}, {b.state} {b.zip}
        </p>
      </div>
      <CostLine a={a} />
      <LimitLine a={a} limits={limits} />
      <ul aria-label="Building facts" className="flex flex-wrap gap-1.5">
        {facts(b).map((f) => (
          <li key={f.label}>
            <Pill>
              <f.icon aria-hidden className="mr-1 size-3.5 shrink-0 text-brand" strokeWidth={2.25} />
              {f.label}
            </Pill>
          </li>
        ))}
      </ul>
      {reasons.length > 0 && (
        <ul className="space-y-1 text-sm">
          {reasons.map((r) => (
            <li key={r} className="flex gap-2">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={2.5} />
              {r}
            </li>
          ))}
        </ul>
      )}
      {a.belowTypicalMinimum && (
        <Note tone="warn">Many buildings also require income of about 2.5 times the rent. You may be below a typical minimum. Ask the property (voucher holders are often exempt).</Note>
      )}
      {a.oldRestrictions && <Note tone="warn">Opened over 30 years ago. Income restrictions may have ended. Confirm with the property.</Note>}
      {a.studentRuleMayApply && <Note tone="warn">Student rules may apply. Ask the property.</Note>}
      {detailed && (
        <div className="mt-auto space-y-1 border-t border-line pt-3 text-sm">
          <p className="text-xs text-ink-soft">HUD data doesn't list amenities like laundry or parking. Ask when you call.</p>
          {b.contact.phone || b.contact.org || b.contact.name ? (
            <>
              <p className="font-medium">Contact (from HUD data, may not be the leasing office)</p>
              <p className="text-ink-soft">{[b.contact.org, b.contact.name].filter(Boolean).join(' · ')}</p>
              {b.contact.phone && (
                <a
                  className="inline-block py-1 font-semibold text-brand underline-offset-2 hover:underline"
                  href={`tel:${b.contact.phone.replace(/[^\d+]/g, '')}`}
                >
                  {b.contact.phone}
                </a>
              )}
            </>
          ) : (
            <p className="text-ink-soft">HUD data has no phone for this building.</p>
          )}
          <p>
            <a
              className="inline-block py-1 text-brand underline-offset-2 hover:underline"
              href={`https://www.google.com/search?q=${encodeURIComponent(`${b.name} ${b.address} ${b.city} ${b.state} leasing`)}`}
              target="_blank"
              rel="noreferrer"
            >
              Find the leasing office
            </a>
          </p>
          {b.area === 'ARLINGTON' && (
            <p>
              <a
                className="inline-block py-1 text-brand underline-offset-2 hover:underline"
                href="https://www.arlingtonva.us/Government/Programs/Housing/Housing-Assistance/Rental-Services/Affordable-Units/Committed-Affordable-Units"
                target="_blank"
                rel="noreferrer"
              >
                Arlington's list of affordable units (rents and minimum incomes)
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
