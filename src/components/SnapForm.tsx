import { ShieldAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DEMO_FORM_TEXT } from '../../shared/demoForm'
import { scamSignals } from '../../shared/snapCheck'
import { extractText, highlightLines, requestChecklist, type ChecklistItem } from '../lib/snap'
import { Button, Card, Note } from './ui'

type Phase = 'idle' | 'reading' | 'review' | 'asking' | 'done' | 'error'

const TYPE_LABEL = { document: 'Bring', deadline: 'Deadline', fee: 'Fee', contact: 'Contact' } as const

export function SnapForm({ announce }: { announce: (msg: string) => void }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [text, setText] = useState('')
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [failed, setFailed] = useState<[number, number]>([0, 1])
  const [confirmed, setConfirmed] = useState<Record<number, boolean>>({})
  const [error, setError] = useState('')
  // Scam signals come from the text itself, by code, as soon as it is read: no AI call needed.
  const warnings = useMemo(() => scamSignals(text), [text])

  async function onFile(file: File) {
    setPhase('reading')
    setError('')
    announce('Reading your form on this device')
    try {
      const t = await extractText(file, setProgress)
      setText(t)
      setPhase('review')
      announce('Text ready to review')
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
      announce('Could not read the file')
    }
  }

  async function makeChecklist() {
    setPhase('asking')
    announce('Making your checklist')
    try {
      const found = await requestChecklist(text, (done, total) => total > 1 && setProgress(Math.round((done / total) * 100)))
      setItems(found.items)
      setFailed([found.failedParts, found.totalParts])
      setConfirmed(Object.fromEntries(found.items.map((_, i) => [i, true])))
      setPhase('done')
      announce(
        `Checklist ready with ${found.items.length} items${found.warnings.length ? '. Warning: this form has signs of a rental scam' : ''}`,
      )
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
      announce('Checklist failed. Showing highlighted text instead')
    }
  }

  return (
    <Card className="p-5">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Snap a form</h2>
          <p className="text-sm text-ink-soft">
            Add an application or a letter from a property. We read it on your device and turn it into a checklist.
          </p>
        </div>
        <Note>
          Your file never leaves this device. Only the text you review below is sent to Google's Gemini API (the Gemma model, free
          tier) to make the checklist. Under Google's free-tier terms that text may be used to improve its products, so delete names,
          Social Security numbers, and account numbers first.
        </Note>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line p-6 text-center text-sm transition hover:border-brand has-[:focus-visible]:border-brand has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand">
          <span className="font-semibold text-brand">Choose a PDF or photo</span>
          <span className="text-ink-soft">PDF, JPG, PNG, or HEIC (iPhone). English text. Up to 10 pages.</span>
          <input
            type="file"
            accept="application/pdf,image/*,.heic,.heif"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => {
              setText(DEMO_FORM_TEXT)
              setError('')
              setPhase('review')
              announce('Sample form loaded')
            }}
          >
            No form yet? Try a sample
          </Button>
        </div>

        {phase === 'reading' && (
          <div role="status" className="text-sm text-ink-soft">
            Reading on your device{progress ? ` (${progress}%)` : ''}. Photos can take 10 to 30 seconds on a phone.
          </div>
        )}

        {warnings.length > 0 && text && phase !== 'idle' && phase !== 'reading' && (
          <div role="alert" className="rounded-2xl border-2 border-heavy/40 bg-heavy-tint p-4 text-heavy">
            <p className="flex items-center gap-2 text-base font-extrabold">
              <ShieldAlert aria-hidden className="size-5 shrink-0" />
              This form has signs of a rental scam
            </p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {warnings.map((w) => (
                <li key={w.kind}>
                  It says "<span className="font-semibold">{w.match}</span>". {w.why}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm">
              Real income-restricted buildings take applications in person or through their own office, charge an application fee
              by check, money order, or card, and never ask for payment before you see the home. If in doubt, call the number listed
              on the building's page here, not the one on the form.
            </p>
          </div>
        )}

        {(phase === 'review' || phase === 'asking') && (
          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="snap-text">
              Check the text. Delete anything personal before you continue.
            </label>
            <textarea
              id="snap-text"
              className="h-48 w-full rounded-xl border border-line p-3 font-mono text-xs"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button onClick={makeChecklist} disabled={phase === 'asking' || text.trim().length < 20}>
              {phase === 'asking' ? `Making checklist…${progress && progress < 100 ? ` ${progress}%` : ''}` : 'Make my checklist'}
            </Button>
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-3">
            {failed[0] > 0 && (
              <Note tone="warn">
                {failed[0]} of {failed[1]} pieces of this form could not be read by the AI. The items below come from the rest. Read the
                highlighted text at the bottom for the missing part.
              </Note>
            )}
            <p className="text-sm text-ink-soft">Each item shows the exact words from your form. Uncheck anything that looks wrong.</p>
            {items.length === 0 && <Note tone="warn">We couldn't find items we could verify. Read the highlighted text below.</Note>}
            <ul className="space-y-2">
              {items.map((it, i) => (
                <li key={i} className={`rounded-xl border p-3 ${it.risky ? 'border-heavy/50 bg-heavy-tint/40' : 'border-line'}`}>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-brand"
                      checked={confirmed[i] ?? true}
                      onChange={(e) => setConfirmed({ ...confirmed, [i]: e.target.checked })}
                    />
                    <span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-brand">{TYPE_LABEL[it.type]}</span>
                      {it.risky && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-heavy px-2 py-0.5 text-[11px] font-bold text-white">
                          <ShieldAlert aria-hidden className="size-3" />
                          Scam warning
                        </span>
                      )}
                      <span className="block font-medium">{it.label}</span>
                      <span className="block text-xs text-ink-soft">From your form: "{it.quote}"</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(phase === 'error' || (phase === 'done' && (items.length === 0 || failed[0] > 0))) && text && (
          <div className="space-y-2">
            {error && <Note tone="warn">{error}</Note>}
            <p className="text-sm font-medium">Lines that mention documents, dates, or money:</p>
            <ul className="max-h-64 space-y-1 overflow-auto text-sm">
              {highlightLines(text).map((l, i) => (
                <li key={i} className={l.hit ? 'rounded bg-stretch-tint px-2 py-1' : 'px-2 py-1 text-ink-soft'}>
                  {l.line}
                </li>
              ))}
            </ul>
          </div>
        )}
        {phase === 'error' && !text && error && <Note tone="warn">{error}</Note>}
      </div>
    </Card>
  )
}
