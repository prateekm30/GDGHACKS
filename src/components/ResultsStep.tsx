import { Award, Share2 } from 'lucide-react'
import { useState } from 'react'
import { prefersReducedMotion, useReveal } from '../lib/motion'
import { marketFor, SpotlightReveal } from './SpotlightReveal'
import { addressLine } from './BuildingCard'
import { CountUp } from './CountUp'
import { money } from './ui'
import { Confetti } from './Confetti'
import { assess } from '../lib/eligibility'
import { learnedPriorities, whyReasons, type Feature, type Weights } from '../lib/ranking'
import type { Building, IncomeLimits, Situation } from '../lib/types'
import { BuildingCard } from './BuildingCard'
import { Glossary } from './Glossary'
import { SnapForm } from './SnapForm'
import { Button, Card, Note } from './ui'

const QUESTIONS = [
  'Is your waitlist open, and how long is it?',
  'Which income limit do you use, and what year is the table?',
  'Is there a minimum income? Do you accept Housing Choice Vouchers?',
  'What does rent include (utilities)?',
]

const DOCUMENTS = [
  'Photo ID for each adult',
  'Social Security cards or numbers',
  'Proof of income: recent pay stubs, benefit letters',
  'Last tax return or W-2',
  'Bank statements (often 2 to 3 months)',
]

export function ResultsStep({
  shortlist,
  weights,
  prior,
  chosen,
  limits,
  situation,
  onEditSituation,
  onRestart,
  announce,
  celebrate = false,
}: {
  shortlist: Building[]
  weights: Weights
  prior: Weights
  chosen: readonly Feature[]
  limits: IncomeLimits
  situation: Situation | null
  onEditSituation: () => void
  onRestart: () => void
  announce: (msg: string) => void
  /** True when the person just finished picking (not on refresh, Back, or Forward): spotlight and confetti. */
  celebrate?: boolean
}) {
  const priorities = learnedPriorities(weights, prior, chosen)
  const max = Math.max(...priorities.map((p) => p.weight), 1)
  const fromPicks = priorities.filter((p) => p.source === 'picks').length
  const revealRef = useReveal<HTMLDivElement>()
  // Ranking already puts every building you appear to fit first. If the shortlist still has "over" buildings,
  // there were not enough others; say so instead of calling one the best match.
  const over = shortlist.map((b) => !!situation && assess(b, limits, situation).limit === 'over')
  const allOver = shortlist.length > 0 && over.every(Boolean)
  // The spotlight runs once, when the picks just finished and motion is allowed; then the cards slide in.
  const [spot, setSpot] = useState(() => celebrate && shortlist.length > 0 && !allOver && !prefersReducedMotion())
  const top = shortlist[0]
  const topCost = top ? assess(top, limits, situation) : null
  const topMonthly = topCost?.cost.monthly ?? null
  const topMarket = top && topCost ? marketFor(top, topCost.cost.bedrooms) : null
  const saving = topMonthly !== null && topMarket !== null && topMarket > topMonthly ? topMarket - topMonthly : null

  async function share() {
    const lines = shortlist.map((b, i) => {
      const c = assess(b, limits, situation).cost
      const cost = c.monthly !== null ? `${c.kind === 'income-based' ? 'est. ' : 'rent cap '}${money(c.monthly)}/mo` : c.kind === 'income-based' ? 'rent is 30% of income' : 'rent varies'
      return `${i + 1}. ${b.name} — ${addressLine(b)} — ${cost}${b.contact.phone ? ` — ${b.contact.phone}` : ''}`
    })
    const text = ['My HomePick DMV shortlist (estimates; each property decides who qualifies):', ...lines, 'https://gdghacks-tau.vercel.app'].join('\n')
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My HomePick DMV shortlist', text })
        return
      }
      await navigator.clipboard.writeText(text)
      announce('Shortlist copied to your clipboard')
    } catch {
      announce('Could not share. Use Print my plan instead.')
    }
  }

  return (
    <div ref={revealRef} className="space-y-6">
      {spot && top && <SpotlightReveal b={top} limits={limits} situation={situation} onDone={() => setSpot(false)} />}
      {celebrate && shortlist.length > 0 && !spot && <Confetti />}
      <nav aria-label="On this page" className="no-print flex gap-5 overflow-x-auto border-b border-ink/10 pb-0">
        {[
          ['#matches', 'Your matches'],
          ['#next-steps', 'Next steps'],
          ['#snap', 'Snap a form'],
          ['#words', 'Words to know'],
        ].map(([href, label]) => (
          <a key={href} href={href} className="shrink-0 border-b-2 border-transparent px-1 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-ink/70 transition hover:border-brand hover:text-brand-strong">
            {label}
          </a>
        ))}
      </nav>
      <section aria-labelledby="learned-heading">
        <Card className="rise-in relative overflow-hidden p-6 sm:p-8">
          <span aria-hidden className="metro-stripe absolute inset-x-0 top-0 h-1.5" />
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 id="learned-heading" className="text-sm font-semibold uppercase tracking-wider text-ink-soft" style={{ fontFamily: 'var(--font-sans)' }}>What we learned about you</h2>
              {priorities[0] ? (
                <p className="font-display mt-1 text-3xl font-extrabold leading-tight text-ink sm:text-4xl">You care most about{' '}
                  <span className="text-brand">{priorities[0].label.charAt(0).toLowerCase() + priorities[0].label.slice(1)}</span>.</p>
              ) : (
                <p className="font-display mt-1 text-3xl font-extrabold leading-tight text-ink sm:text-4xl">Your picks were mixed.</p>
              )}
              <p className="mt-1 text-sm text-ink-soft">
                {priorities.length === 0
                  ? 'No single thing stood out, so the ranking uses our starting point: lower cost first, then Metro. Edit your answers to steer it.'
                  : fromPicks > 0
                    ? 'From what you chose and what your picks taught us. Wrong? Edit your answers or start over.'
                    : 'From what you chose on the basics step. Your picks did not change it much. Wrong? Edit your answers or start over.'}
              </p>
            </div>
            <div className="no-print flex gap-2">
              <Button variant="secondary" onClick={onEditSituation}>
                {situation ? 'Edit my answers' : 'Add income for estimates'}
              </Button>
              <Button variant="ghost" onClick={onRestart}>
                Start over
              </Button>
            </div>
          </div>
          <ul className="mt-4 space-y-2.5">
            {priorities.map((p, i) => (
              <li key={p.feature} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3 text-sm sm:grid-cols-[12rem_1fr_3rem]">
                <span className={i === 0 ? 'font-semibold' : ''}>
                  {p.label}
                  <span className="block text-[11px] font-medium text-ink-soft">{p.source === 'picks' ? 'from your picks' : 'you chose this'}</span>
                </span>
                <span className="h-3 overflow-hidden rounded-full bg-line" aria-hidden>
                  <span
                    className={`grow-x block h-full rounded-full ${i === 0 ? 'bg-brand' : i === 1 ? 'bg-coral' : 'bg-accent'}`}
                    style={{ width: `${(p.weight / max) * 100}%`, animationDelay: `${i * 70}ms` }}
                  />
                </span>
                <span className="text-right text-xs font-semibold tabular-nums text-ink-soft">
                  {Math.round((p.weight / max) * 100)}%<span className="sr-only"> of your strongest priority</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section id="matches" aria-labelledby="short-heading" className="scroll-mt-24 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <span aria-hidden className="font-hand text-2xl text-brand-strong">
              ta-da! picked just for you
            </span>
            <h1 id="short-heading" className="text-3xl font-extrabold sm:text-4xl">
              Your top matches
            </h1>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <Button variant="secondary" onClick={share}>
              <Share2 aria-hidden className="size-4" />
              Share my shortlist
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              Print my plan
            </Button>
          </div>
        </div>
        {top && !allOver && (topMonthly !== null || topMarket !== null) && (
          <dl className="stat-strip grid grid-cols-2 gap-3 sm:grid-cols-3">
            {topMonthly !== null && (
              <div className="glass-panel p-4">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{topCost?.cost.kind === 'income-based' ? "What you'd pay at #1" : 'Rent cap at #1'}</dt>
                <dd className="font-display text-3xl font-extrabold tabular-nums text-ink">
                  <CountUp value={topMonthly} duration={1300} format={money} />
                  <span className="text-sm font-semibold text-ink-soft">/mo</span>
                </dd>
              </div>
            )}
            {topMarket !== null && (
              <div className="glass-panel p-4">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Typical rent nearby (HUD)</dt>
                <dd className="font-display text-3xl font-extrabold tabular-nums text-ink">
                  <CountUp value={topMarket} duration={1300} format={money} />
                  <span className="text-sm font-semibold text-ink-soft">/mo</span>
                </dd>
              </div>
            )}
            {saving !== null && (
              <div className="glass-dark col-span-2 p-4 text-white sm:col-span-1">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-white/70">You could keep (est.)</dt>
                <dd className="font-display text-3xl font-extrabold tabular-nums">
                  <CountUp value={saving * 12} duration={1600} format={money} />
                  <span className="text-sm font-semibold text-white/70">/yr</span>
                </dd>
              </div>
            )}
          </dl>
        )}
        {shortlist.length === 0 && <p className="text-sm text-ink-soft">No buildings to show yet. Try starting over with a different area.</p>}
        {allOver ? (
          <div className="mb-4">
            <Note tone="warn">
              At the income you entered, you appear to be over the estimated limit for every building we can show here. These are
              the closest fits to your picks, not matches. Check the income you entered (yearly, before taxes), or ask the
              property: limits change every year and the property decides.
            </Note>
          </div>
        ) : (
          over.some(Boolean) && (
            <div className="mb-4">
              <Note tone="warn">Only a few buildings here fit your estimated income limit, so the list also shows closest fits that are over it.</Note>
            </div>
          )
        )}
        <div className="grid gap-4 lg:grid-cols-3">
          {shortlist.map((b, i) => (
            <div
              key={b.id}
              className={`${celebrate && i > 0 ? (i === 1 ? 'in-left' : 'in-right') : 'rise-in'} ${i === 0 ? 'glow-border' : ''}`}
              style={{ animationDelay: `${200 + i * 160}ms` }}
            >
              <Card className="group relative h-full overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-lift">
                <BuildingCard
                  b={b}
                  a={assess(b, limits, situation)}
                  limits={limits}
                  situation={situation}
                  reasons={whyReasons(b, weights, limits, situation)}
                  detailed
                  badge={
                    <span
                      className={`absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold shadow-sm ${
                        i === 0 ? 'bg-accent text-ink' : 'bg-white/95 text-ink'
                      }`}
                    >
                      {over[i] ? (
                        `#${i + 1} · over the limit (est.)`
                      ) : i === 0 ? (
                        <>
                          <Award aria-hidden className="size-3.5" strokeWidth={2.5} />
                          Best match
                        </>
                      ) : (
                        `#${i + 1} match`
                      )}
                    </span>
                  }
                />
              </Card>
            </div>
          ))}
        </div>
      </section>

      <section id="next-steps" aria-labelledby="next-heading" className="reveal scroll-mt-24">
        <Card className="p-6 sm:p-8">
          <h2 id="next-heading" className="text-2xl font-extrabold">Your next steps</h2>
          <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm">
            <li>
              Call each building above. Ask:
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-soft">
                {QUESTIONS.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </li>
            <li>
              Gather the documents most applications ask for:
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-soft">
                {DOCUMENTS.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </li>
            <li>When a property sends you an application, use Snap a form below to turn it into a checklist.</li>
          </ol>
        </Card>
      </section>

      <section id="snap" className="no-print reveal scroll-mt-24">
        <SnapForm announce={announce} />
      </section>

      <section id="words" aria-labelledby="words-heading" className="no-print reveal scroll-mt-24">
        <Glossary />
      </section>
    </div>
  )
}
