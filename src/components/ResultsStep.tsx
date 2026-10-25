import { Award } from 'lucide-react'
import { useReveal } from '../lib/motion'
import { Confetti } from './Confetti'
import { assess } from '../lib/eligibility'
import { learnedPriorities, whyReasons, type Weights } from '../lib/ranking'
import type { Building, IncomeLimits, Situation } from '../lib/types'
import { BuildingCard } from './BuildingCard'
import { Glossary } from './Glossary'
import { SnapForm } from './SnapForm'
import { Button, Card } from './ui'

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
  limits,
  situation,
  onEditSituation,
  onRestart,
  announce,
}: {
  shortlist: Building[]
  weights: Weights
  limits: IncomeLimits
  situation: Situation | null
  onEditSituation: () => void
  onRestart: () => void
  announce: (msg: string) => void
}) {
  const priorities = learnedPriorities(weights)
  const max = Math.max(...priorities.map((p) => p.weight), 1)
  const revealRef = useReveal<HTMLDivElement>()

  return (
    <div ref={revealRef} className="space-y-10">
      {shortlist.length > 0 && <Confetti />}
      <nav aria-label="On this page" className="no-print flex gap-2 overflow-x-auto pb-1">
        {[
          ['#matches', 'Your matches'],
          ['#next-steps', 'Next steps'],
          ['#snap', 'Snap a form'],
          ['#words', 'Words to know'],
        ].map(([href, label]) => (
          <a key={href} href={href} className="shrink-0 rounded-full bg-dusk px-3.5 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:bg-ink">
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
              {priorities[0] && (
                <p className="font-display mt-1 text-3xl font-extrabold leading-tight text-ink sm:text-4xl">You care most about{' '}
                  <span className="text-brand">{priorities[0].label.charAt(0).toLowerCase() + priorities[0].label.slice(1)}</span>.</p>
              )}
              <p className="mt-1 text-sm text-ink-soft">From your basics and picks. Wrong? Edit your answers or start over.</p>
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
                <span className={i === 0 ? 'font-semibold' : ''}>{p.label}</span>
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
          <Button variant="secondary" className="no-print" onClick={() => window.print()}>
            Print my plan
          </Button>
        </div>
        {shortlist.length === 0 && <p className="text-sm text-ink-soft">No buildings to show yet. Try starting over with a different area.</p>}
        <div className="grid gap-4 lg:grid-cols-3">
          {shortlist.map((b, i) => (
            <div
              key={b.id}
              className={`rise-in ${i === 0 ? 'glow-border' : ''}`}
              style={{ animationDelay: `${200 + i * 140}ms` }}
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
                      {i === 0 ? (
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
