/** The rent model: LIHTC = capped rent by income tier, HUD = rent follows income (about 30%). */
export type Program = 'LIHTC' | 'HUD'
/** Which public list the row comes from when it is not HUD's two main datasets. */
export type Subsidy = 'public-housing' | 'usda' | 'dc' | 'md'
/** Income tier as a percent of area median income. */
export type Ceiling = 30 | 50 | 60 | 80
export type Area =
  | 'DC'
  | 'MONTGOMERY'
  | 'PRINCE_GEORGES'
  | 'FREDERICK'
  | 'SOUTHERN_MD'
  | 'ARLINGTON'
  | 'ALEXANDRIA'
  | 'FAIRFAX'
  | 'LOUDOUN'
  | 'PRINCE_WILLIAM'
  | 'FREDERICKSBURG'
  | 'FAUQUIER_CLARKE'

/** One row of public/data/buildings.json. Built by data/build.py from HUD files. */
export interface Building {
  id: string
  name: string
  address: string
  city: string
  state: 'DC' | 'VA' | 'MD'
  zip: string
  area: Area
  lat: number
  lon: number
  program: Program
  totalUnits: number | null
  /** LIHTC low-income units, or HUD assisted units. */
  affordableUnits: number | null
  /** Income ceiling: 50 or 60 (% AMI) for tax-credit buildings, 30 or 80 for DC covenants, 'avg' for income averaging, null if unknown. */
  incomeCeiling: Ceiling | 'avg' | null
  /** Set for rows from public housing, USDA, DC DHCD, or Maryland DHCD lists. Absent for HUD's two main datasets. */
  subsidy?: Subsidy
  /** Public housing: average months on the waitlist for recent move-ins (HUD). Unknown when absent. */
  waitMonths?: number | null
  /** DC covenants: affordable homes by income tier ("30", "50", "60", "80" percent of median income). */
  amiMix?: Record<string, number>
  /** Bedroom sizes that exist in the building (0 = studio). Empty if unknown. */
  bedrooms: number[]
  /** Number of units by bedroom count ("0" = studio). Missing in older data. */
  unitMix?: Record<string, number>
  yearPlacedInService: number | null
  seniorOnly: boolean
  disabilityOnly: boolean
  /** Straight-line miles to the nearest Metro station. */
  metroMiles: number | null
  /** HUD Small Area Fair Market Rent for the building's ZIP, by bedroom count ("0" = studio). Utilities included. */
  marketRent?: Record<string, number>
  /** Name of the nearest Metro station. */
  metroStation?: string | null
  /** Straight-line miles to the work or school spot the person chose. Added in the browser, never stored. */
  commuteMiles?: number | null
  contact: { name: string | null; org: string | null; phone: string | null; email: string | null }
  source: { dataset: string; url: string; retrieved: string }
  /** True for the made-up rows in the dev sample. Never shown as real. */
  sample?: boolean
  /** A group home or a site with three or fewer homes: usually by referral, so it stays out of the picker. */
  groupHome?: boolean
}

/** Income limits for one HUD area, by household size 1..8 (index 0 = 1 person). */
export interface IncomeLimits {
  area: string
  effective: string
  mtsp: { '50': number[]; '60': number[] }
  /** Section 8 limits for HUD-assisted buildings. null until the pipeline fills them. */
  section8: { '30': number[]; '50': number[] } | null
  sources: string[]
  notes: string[]
}

export interface Situation {
  income: number
  householdSize: number
  allFullTimeStudents: boolean
  includeSeniorDisability: boolean
  /** Has a Housing Choice Voucher (Section 8). Changes what they'd pay at tax-credit buildings. */
  voucher?: boolean
  /** Bedrooms the person asked for (0 = studio, 3 = three or more). null means "whatever fits the household". */
  bedroomsNeeded?: number | null
}
