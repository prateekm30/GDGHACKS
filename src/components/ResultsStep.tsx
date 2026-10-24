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

  return (
    <div className="space-y-8">
      <section aria-labelledby="learned-heading">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 id="learned-heading" className="text-lg font-semibold">What we learned about you</h2>
              <p className="text-sm text-ink-soft">From your picks. Wrong? Go back and pick again.</p>
            </div>
            <div className="no-print flex gap-2">
              <Button variant="secondary" onClick={onEditSituation}>
                {situation ? 'Edit income' : 'Add income'}
              </Button>
              <Button variant="ghost" onClick={onRestart}>
                Start over
              </Button>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {priorities.map((p) => (
              <li key={p.feature} className="grid grid-cols-[10rem_1fr] items-center gap-3 text-sm">
                <span>{p.label}</span>
                <span className="h-2 rounded-full bg-line" aria-hidden>
                  <span className="block h-2 rounded-full bg-brand" style={{ width: `${(p.weight / max) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section aria-labelledby="short-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="short-heading" className="text-2xl font-bold tracking-tight">
            Your top matches
          </h2>
          <Button variant="secondary" className="no-print" onClick={() => window.print()}>
            Print my plan
          </Button>
        </div>
        {shortlist.length === 0 && <p className="text-sm text-ink-soft">No buildings to show yet. Try starting over with a different area.</p>}
        <div className="grid gap-4 lg:grid-cols-3">
          {shortlist.map((b) => (
            <Card key={b.id} className="p-5">
              <BuildingCard
                b={b}
                a={assess(b, limits, situation)}
                limits={limits}
                reasons={whyReasons(b, weights, limits, situation)}
                detailed
              />
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="next-heading">
        <Card className="p-5">
          <h2 id="next-heading" className="text-lg font-semibold">Your next steps</h2>
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

      <section className="no-print">
        <SnapForm announce={announce} />
      </section>

      <section aria-labelledby="words-heading" className="no-print">
        <Glossary />
      </section>
    </div>
  )
}
