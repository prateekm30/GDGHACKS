import {
  Accessibility,
  BedDouble,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  HeartHandshake,
  TrainFront,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { areaInfo, areaLabel } from '../lib/areas'
import { rentTable, type Assessment } from '../lib/eligibility'
import { programLabel, sourceName } from '../lib/labels'
import type { Building, IncomeLimits, Situation } from '../lib/types'
import { BuildingPhoto } from './BuildingPhoto'
import { BurdenBadge, Note, money } from './ui'

const BR = (n: number | null) => (n === null ? '' : n === 0 ? 'studio' : `${n}BR`)
const BR_SHORT = (n: number) => (n === 0 ? 'Studio' : `${n}BR`)
const MIX_COLORS = ['#ffd1a8', '#ff8fb1', '#cf2f6a', '#5b2a7a', '#ff9f43']

/** One sentence a screen reader can hear on the pick button: where, what it costs, and the income limit. */
export function summary(b: Building, a: Assessment): string {
  const c = a.cost
  const cost =
    c.kind === 'income-based'
      ? c.monthly !== null
        ? `income-based rent, about ${money(c.monthly)} a month for you`
        : 'income-based rent, about 30% of your income'
      : c.kind === 'ceiling' && c.monthly !== null
        ? `rent up to ${money(c.monthly)} a month for a ${BR(c.bedrooms)}${c.burdenPct !== null ? `, about ${c.burdenPct}% of your income` : ''}`
        : 'rent varies by unit'
  const limit = {
    under: 'you appear to be under the estimated income limit',
    maybe: 'you may be over the usual income limit; some HUD-assisted buildings go higher',
    over: 'you appear to be over the estimated income limit',
    varies: 'income limit varies by unit',
    unknown: '',
  }[a.limit]
  return [`${b.name}, ${areaLabel(b.area)}`, cost, limit].filter(Boolean).join('. ')
}

function programBadge(b: Building) {
  return { text: programLabel(b), cls: b.program === 'HUD' ? 'bg-mint text-ink' : 'bg-white/95 text-brand-strong' }
}

/** DC covenants list homes by income tier; show it so "up to 80%" does not hide the 30% homes. */
function AmiMix({ b }: { b: Building }) {
  if (!b.amiMix) return null
  const parts = Object.entries(b.amiMix).sort(([a], [c]) => Number(a) - Number(c))
  return (
    <p className="text-xs text-ink-soft">
      <span className="font-bold uppercase tracking-wide">Homes by income tier</span>{' '}
      {parts.map(([tier, n], i) => (
        <span key={tier}>
          {i > 0 && ' · '}
          <strong className="text-ink">{n}</strong> at {tier === '30' ? 'up to 30%' : `${tier}%`} of median
        </span>
      ))}
    </p>
  )
}

/** How this building compares with HUD's estimate of market rent in its ZIP code. */
function MarketCompare({ b, monthly, bedrooms }: { b: Building; monthly: number | null; bedrooms: number | null }) {
  const size = bedrooms ?? 1
  const market = b.marketRent?.[String(Math.min(size, 4))]
  if (!market) return null
  const saves = monthly !== null ? market - monthly : null
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2">
      <p className="text-xs text-ink-soft">
        <span className="block font-bold uppercase tracking-wide">Typical rent nearby, {BR(size)}</span>
        <span className="font-display text-lg font-extrabold text-ink">{money(market)}/mo</span>{' '}
        <span>HUD estimate for ZIP {b.zip}</span>
      </p>
      {saves !== null && saves > 0 && (
        <span className="rounded-full bg-ok-tint px-2.5 py-1 text-xs font-bold text-ok">About {money(saves)}/mo less</span>
      )}
    </div>
  )
}

/** The price block. Same shape on every card, so cards compare at a glance. */
function PricePanel({ b, a, limits, situation }: { b: Building; a: Assessment; limits: IncomeLimits; situation: Situation | null }) {
  const c = a.cost
  if (c.kind === 'income-based') {
    return (
      <div className="rounded-2xl bg-ok-tint/70 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-ok">What you'd pay</p>
        <p className="font-display mt-0.5 text-3xl font-extrabold text-ink">
          {c.monthly !== null ? (
            <>
              {money(c.monthly)}
              <span className="text-base font-bold text-ink-soft">/mo</span>
            </>
          ) : (
            '30% of income'
          )}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          Rent follows your income, not the apartment. That is why every income-based building shows the same number
          {c.monthly !== null ? ' (30% of the income you entered)' : ''}.
        </p>
        <MarketCompare b={b} monthly={c.monthly} bedrooms={c.bedrooms} />
      </div>
    )
  }
  const table = rentTable(b, limits)
  if (c.kind === 'unknown' || c.monthly === null || table.length === 0) {
    return (
      <div className="rounded-2xl bg-brand-tint/70 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-strong">Highest rent allowed here</p>
        <p className="font-display mt-0.5 text-2xl font-extrabold">Varies by unit</p>
        <p className="mt-1 text-sm text-ink-soft">This building mixes income tiers, so each unit has its own cap. Ask the property.</p>
      </div>
    )
  }
  const max = Math.max(...table.map((t) => t.monthly))
  const voucherPays = situation?.voucher ? Math.round((situation.income * 0.3) / 12) : null
  return (
    <div className="rounded-2xl bg-brand-tint/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-strong">Highest rent allowed{c.bedrooms !== null ? `, ${BR(c.bedrooms)}` : ''}</p>
          <p className="font-display mt-0.5 text-3xl font-extrabold text-ink">
            {money(c.monthly)}
            <span className="text-base font-bold text-ink-soft">/mo</span>
          </p>
        </div>
        {c.burdenPct !== null && c.level && <BurdenBadge level={c.level}>About {c.burdenPct}% of your income</BurdenBadge>}
      </div>
      {/* This building's caps by unit size. Your size is highlighted. */}
      <ul aria-label="Rent caps by unit size" className="mt-3 flex items-end gap-2">
        {table.map((t) => {
          const mine = t.bedrooms === c.bedrooms
          return (
            <li key={t.bedrooms} className="flex flex-1 flex-col items-center gap-1 text-center">
              <span className={`text-[11px] font-bold ${mine ? 'text-ink' : 'text-ink-soft'}`}>{money(t.monthly)}</span>
              <span aria-hidden className="flex h-12 w-full items-end">
                <span
                  className={`grow-y block w-full rounded-t-lg ${mine ? 'bg-brand' : 'bg-brand/20'}`}
                  style={{ height: `${Math.max((t.monthly / max) * 100, 18)}%` }}
                />
              </span>
              <span className={`text-[11px] ${mine ? 'font-bold text-ink' : 'text-ink-soft'}`}>{BR_SHORT(t.bedrooms)}</span>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-xs text-ink-soft">
        Caps include utilities and are set by HUD for the whole region at this building's {b.incomeCeiling ?? 60}% tier
        {c.assumedCeiling ? ' (tier assumed)' : ''}, so same-tier buildings share them. Real rents are often lower.
      </p>
      {voucherPays !== null && (
        <p className="mt-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-xs font-medium text-ink">
          With your voucher you'd likely pay about {money(voucherPays)}/mo (30% of income). The voucher covers the rest, up to
          its limit.
        </p>
      )}
      <MarketCompare b={b} monthly={voucherPays ?? c.monthly} bedrooms={c.bedrooms} />
    </div>
  )
}

function LimitRow({ a, limits }: { a: Assessment; limits: IncomeLimits }) {
  const rows: Record<Assessment['limit'], { icon: LucideIcon; cls: string; text: string }> = {
    under: { icon: CircleCheck, cls: 'text-ok', text: 'You appear to be under the estimated income limit.' },
    maybe: { icon: CircleHelp, cls: 'text-stretch', text: 'You may be over the usual limit. Some HUD-assisted buildings admit up to 80% of area median income, so ask.' },
    over: { icon: CircleAlert, cls: 'text-heavy', text: "You appear to be over this building's estimated income limit." },
    varies: { icon: CircleHelp, cls: 'text-stretch', text: 'Income limit varies by unit. Ask the property.' },
    unknown: { icon: CircleHelp, cls: 'text-ink-soft', text: 'Add your income to check the income limit.' },
  }
  const r = rows[a.limit]
  return (
    <p className="flex gap-2 text-sm">
      <r.icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${r.cls}`} />
      <span>
        {r.text}{' '}
        {a.limit !== 'unknown' && (
          <span className="text-ink-soft">
            ({limits.effective} limits{a.limitAmount ? `, ${money(a.limitAmount)} for your household` : ''}. The property decides.)
          </span>
        )}
      </span>
    </p>
  )
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-canvas/70 px-3 py-2">
      <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
        <Icon aria-hidden className="size-3.5 text-brand" />
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold leading-snug">{value}</dd>
    </div>
  )
}

function UnitMix({ b }: { b: Building }) {
  const mix = Object.entries(b.unitMix ?? {})
    .map(([k, n]) => ({ br: Number(k), n }))
    .filter((m) => m.n > 0)
    .sort((x, y) => x.br - y.br)
  const total = mix.reduce((s, m) => s + m.n, 0)
  if (!total) {
    return (
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">Unit mix</p>
        <div aria-hidden className="mt-1 h-2.5 rounded-full bg-line" />
        <p className="mt-1 text-xs text-ink-soft">Not listed in HUD data</p>
      </div>
    )
  }
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">Unit mix</p>
      <div aria-hidden className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-line">
        {mix.map((m) => (
          <span key={m.br} className="grow-x h-full" style={{ width: `${(m.n / total) * 100}%`, background: MIX_COLORS[Math.min(m.br, 4)] }} />
        ))}
      </div>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-soft">
        {mix.map((m) => (
          <span key={m.br} className="inline-flex items-center gap-1">
            <span aria-hidden className="size-2 rounded-full" style={{ background: MIX_COLORS[Math.min(m.br, 4)] }} />
            {m.n} {m.br === 0 ? (m.n === 1 ? 'studio' : 'studios') : `${BR_SHORT(m.br)}`}
          </span>
        ))}
      </p>
    </div>
  )
}

export function BuildingCard({
  b,
  a,
  limits,
  situation,
  reasons = [],
  detailed = false,
  compact = false,
  badge,
}: {
  b: Building
  a: Assessment
  limits: IncomeLimits
  situation: Situation | null
  reasons?: string[]
  detailed?: boolean
  /** Short card for the picker: the facts that decide a pick, with the rest behind "More". */
  compact?: boolean
  badge?: ReactNode
}) {
  const pb = programBadge(b)
  const info = areaInfo(b.area)
  const bedroomText = b.bedrooms.length
    ? Math.min(...b.bedrooms) === Math.max(...b.bedrooms)
      ? BR_SHORT(Math.min(...b.bedrooms))
      : `${BR_SHORT(Math.min(...b.bedrooms))} to ${BR(Math.max(...b.bedrooms))}`
    : 'Not listed'
  const homes =
    b.affordableUnits && b.totalUnits && b.totalUnits > b.affordableUnits
      ? `${b.affordableUnits} of ${b.totalUnits} affordable`
      : b.affordableUnits || b.totalUnits
        ? `${b.affordableUnits ?? b.totalUnits} affordable`
        : 'Not listed'
  const metro =
    b.metroMiles === null
      ? 'Not listed'
      : b.metroMiles > 5
        ? 'None within 5 mi'
        : `${b.metroMiles < 0.15 ? 'Next to' : `${b.metroMiles.toFixed(1)} mi to`} ${b.metroStation ?? 'Metro'}`

  if (compact) {
    const c = a.cost
    const price =
      c.kind === 'income-based'
        ? { label: "What you'd pay", value: c.monthly !== null ? money(c.monthly) : '30% of income', per: c.monthly !== null, cls: 'bg-ok-tint/70', lcls: 'text-ok' }
        : c.kind === 'ceiling' && c.monthly !== null
          ? { label: `Rent cap${c.bedrooms !== null ? `, ${BR(c.bedrooms)}` : ''}`, value: money(c.monthly), per: true, cls: 'bg-brand-tint/70', lcls: 'text-brand-strong' }
          : { label: 'Rent cap', value: 'Varies', per: false, cls: 'bg-brand-tint/70', lcls: 'text-brand-strong' }
    const market = b.marketRent?.[String(Math.min(c.bedrooms ?? 1, 4))]
    const limitText = { under: 'Under the income limit (est.)', maybe: 'Over the usual limit, ask (est.)', over: 'Over the income limit (est.)', varies: 'Limit varies by unit', unknown: 'Add income to check the limit' }[a.limit]
    const LimitIcon = { under: CircleCheck, maybe: CircleHelp, over: CircleAlert, varies: CircleHelp, unknown: CircleHelp }[a.limit]
    const limitCls = { under: 'text-ok', maybe: 'text-stretch', over: 'text-heavy', varies: 'text-stretch', unknown: 'text-ink-soft' }[a.limit]
    return (
      <article className="flex h-full flex-col text-left">
        <div className="relative">
          <BuildingPhoto b={b} className="h-20 sm:h-40" single />
          <span className={`absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm sm:text-xs ${pb.cls}`}>{pb.text}</span>
          {badge}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-2.5 sm:gap-3 sm:p-4">
          <div>
            <h3 className="font-display line-clamp-2 text-sm font-bold leading-tight sm:text-xl">{b.name}</h3>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-ink-soft sm:text-sm">
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: info.color }} />
              {b.city}, {b.state}
            </p>
          </div>
          <div className={`rounded-xl p-2 sm:p-3 ${price.cls}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wide sm:text-xs ${price.lcls}`}>{price.label}</p>
            <p className="font-display text-xl font-extrabold leading-tight text-ink sm:text-3xl">
              {price.value}
              {price.per && <span className="text-xs font-bold text-ink-soft sm:text-base">/mo</span>}
            </p>
            {c.kind === 'ceiling' && c.burdenPct !== null && c.level ? (
              <p className="mt-1 text-[11px] sm:text-sm">
                <BurdenBadge level={c.level}>About {c.burdenPct}% of income</BurdenBadge>
              </p>
            ) : c.kind === 'income-based' ? (
              <p className="mt-0.5 text-[11px] text-ink-soft sm:text-xs">Rent follows your income</p>
            ) : null}
            {market && (
              <p className="mt-1 text-[11px] text-ink-soft sm:text-xs">
                Typical nearby <b className="text-ink">{money(market)}</b>
              </p>
            )}
          </div>
          <p className={`flex items-start gap-1 text-[11px] font-medium sm:text-sm ${limitCls}`}>
            <LimitIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {limitText}
          </p>
          <dl className="flex flex-wrap gap-1 text-[11px] sm:text-xs">
            {[
              [BedDouble, 'Sizes', bedroomText],
              [TrainFront, 'Metro', metro],
              [CalendarDays, 'Opened', b.yearPlacedInService ?? 'Not listed'],
              [Building2, 'Homes', homes],
            ].map(([Icon, label, value]) => {
              const I = Icon as LucideIcon
              return (
                <div key={label as string} className="inline-flex max-w-full items-center gap-1 rounded-lg bg-canvas/80 px-1.5 py-1">
                  <dt className="sr-only">{label as string}</dt>
                  <I aria-hidden className="size-3 shrink-0 text-brand" />
                  <dd className="truncate font-semibold">{value as ReactNode}</dd>
                </div>
              )
            })}
            {b.commuteMiles != null && (
              <div className="inline-flex items-center gap-1 rounded-lg bg-canvas/80 px-1.5 py-1">
                <dt className="sr-only">To your work or school</dt>
                <BriefcaseBusiness aria-hidden className="size-3 text-brand" />
                <dd className="font-semibold">{b.commuteMiles.toFixed(1)} mi to work</dd>
              </div>
            )}
          </dl>
          {(b.seniorOnly || b.disabilityOnly || a.belowTypicalMinimum || a.oldRestrictions || a.studentRuleMayApply) && (
            <p className="flex flex-wrap gap-1 text-[10px] font-semibold text-stretch sm:text-xs">
              {b.seniorOnly && <span className="rounded-full bg-violet/10 px-2 py-0.5 text-violet">Seniors 62+</span>}
              {b.disabilityOnly && <span className="rounded-full bg-violet/10 px-2 py-0.5 text-violet">Disability housing</span>}
              {a.belowTypicalMinimum && <span className="rounded-full bg-stretch-tint px-2 py-0.5">May be below min. income</span>}
              {a.oldRestrictions && <span className="rounded-full bg-stretch-tint px-2 py-0.5">Restrictions may have ended</span>}
              {a.studentRuleMayApply && <span className="rounded-full bg-stretch-tint px-2 py-0.5">Student rules</span>}
            </p>
          )}
          <details className="mt-auto text-xs sm:text-sm" onClick={(e) => e.stopPropagation()}>
            <summary className="cursor-pointer rounded-lg py-1 font-semibold text-brand-strong hover:bg-brand-tint">More about this building</summary>
            <div className="mt-2 space-y-3">
              <p className="text-ink-soft">{b.address}, {b.city}, {b.state} {b.zip} · {areaLabel(b.area)}</p>
              <PricePanel b={b} a={a} limits={limits} situation={situation} />
              <LimitRow a={a} limits={limits} />
              <UnitMix b={b} />
        <AmiMix b={b} />
            </div>
          </details>
        </div>
      </article>
    )
  }

  return (
    <article className="flex h-full flex-col text-left">
      <div className="relative">
        <BuildingPhoto b={b} className="h-44 sm:h-48" />
        <span className={`absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm ${pb.cls}`}>{pb.text}</span>
        {badge}
      </div>
      <div className="flex flex-1 flex-col gap-3.5 p-5">
        <div>
          <h3 className="font-display text-xl font-bold leading-tight">{b.name}</h3>
          <p className="mt-0.5 text-sm text-ink-soft">
            {b.address}, {b.city}, {b.state} {b.zip}
          </p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-canvas px-2 py-0.5 text-xs font-semibold">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: info.color }} />
            {areaLabel(b.area)}
          </p>
        </div>

        <PricePanel b={b} a={a} limits={limits} situation={situation} />
        <LimitRow a={a} limits={limits} />

        <dl className="grid grid-cols-2 gap-2">
          <Stat icon={Building2} label="Homes" value={homes} />
          <Stat icon={BedDouble} label="Sizes" value={bedroomText} />
          <Stat icon={CalendarDays} label="Opened" value={b.yearPlacedInService ?? 'Not listed'} />
          <Stat icon={TrainFront} label="Metro" value={metro} />
          {b.waitMonths != null && (
            <div className="col-span-2">
              <Stat icon={CalendarDays} label="Typical wait (HUD)" value={`about ${b.waitMonths} month${b.waitMonths === 1 ? '' : 's'} for recent move-ins`} />
            </div>
          )}
          {b.commuteMiles != null && (
            <div className="col-span-2">
              <Stat icon={BriefcaseBusiness} label="To your work or school" value={`${b.commuteMiles.toFixed(1)} mi, straight line`} />
            </div>
          )}
        </dl>
        <UnitMix b={b} />
        <AmiMix b={b} />

        {(b.seniorOnly || b.disabilityOnly) && (
          <p className="flex flex-wrap gap-1.5">
            {b.seniorOnly && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet/10 px-2.5 py-1 text-xs font-semibold text-violet">
                <HeartHandshake aria-hidden className="size-3.5" /> Seniors (62+)
              </span>
            )}
            {b.disabilityOnly && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet/10 px-2.5 py-1 text-xs font-semibold text-violet">
                <Accessibility aria-hidden className="size-3.5" /> For people with disabilities
              </span>
            )}
          </p>
        )}

        {reasons.length > 0 && (
          <ul className="space-y-1 rounded-xl bg-brand-tint/60 p-3 text-sm">
            <li className="text-[11px] font-bold uppercase tracking-wide text-brand-strong">Why it matches</li>
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
          <div className="mt-auto space-y-1 border-t border-dashed border-line pt-3 text-sm">
            <p className="text-xs text-ink-soft">{sourceName(b)} doesn't list amenities like laundry or parking. Ask when you call.</p>
            {b.contact.phone || b.contact.org || b.contact.name ? (
              <>
                <p className="font-medium">Contact (from HUD data, may not be the leasing office)</p>
                <p className="text-ink-soft">{[b.contact.org, b.contact.name].filter(Boolean).join(' · ')}</p>
                {b.contact.phone && (
                  <a className="inline-block py-1 font-semibold text-brand-strong underline-offset-2 hover:underline" href={`tel:${b.contact.phone.replace(/[^\d+]/g, '')}`}>
                    {b.contact.phone}
                  </a>
                )}
              </>
            ) : (
              <p className="text-ink-soft">{sourceName(b)} has no phone for this building.</p>
            )}
            <p>
              <a
                className="inline-block py-1 font-semibold text-brand-strong underline-offset-2 hover:underline"
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
                  className="inline-block py-1 text-brand-strong underline-offset-2 hover:underline"
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
    </article>
  )
}
