import { Card } from './ui'

// Written by us and checked against HUD sources, not generated, so the definitions never drift.
const TERMS: { term: string; plain: string }[] = [
  {
    term: 'Income-restricted (affordable) housing',
    plain: 'Apartments that only rent to households under an income limit, usually at lower rents than the market.',
  },
  {
    term: 'Tax credit (LIHTC) building',
    plain:
      'A building built or fixed up with federal tax credits. Rent has a fixed cap based on the area, not on your exact income.',
  },
  {
    term: 'HUD-assisted building',
    plain: 'A building with a HUD contract. You usually pay about 30% of your income for rent, and HUD pays the rest.',
  },
  {
    term: 'AMI (area median income)',
    plain:
      'The middle income for the DC area. "60% AMI" means 60% of that number, adjusted for how many people live with you.',
  },
  {
    term: 'Income limit',
    plain: 'The most your household can earn and still rent there. Limits change every year, and the property checks them.',
  },
  {
    term: 'Minimum income',
    plain: 'Many buildings also want you to earn about 2.5 times the rent. Housing Choice Voucher holders are often exempt.',
  },
  {
    term: 'Income certification',
    plain: 'The step where the property checks your pay stubs and documents to confirm you are under the limit.',
  },
  {
    term: 'Waitlist',
    plain: 'When no units are free, you join a list. Ask each building if theirs is open and how long it is.',
  },
]

export function Glossary() {
  return (
    <Card className="p-5">
      <h2 id="words-heading" className="text-lg font-semibold">
        Words to know
      </h2>
      <div className="mt-3 divide-y divide-line">
        {TERMS.map((t) => (
          <details key={t.term} className="group py-2">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-1 text-sm font-medium">
              {t.term}
              <span aria-hidden className="text-ink-soft transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="pb-1 pt-1 text-sm text-ink-soft">{t.plain}</p>
          </details>
        ))}
      </div>
    </Card>
  )
}
