export type Program = 'LIHTC' | 'HUD'
export type Area = 'DC' | 'ARLINGTON'

/** One row of public/data/buildings.json. Built by data/build.py from HUD files. */
export interface Building {
  id: string
  name: string
  address: string
  city: string
  state: 'DC' | 'VA'
  zip: string
  area: Area
  lat: number
  lon: number
  program: Program
  totalUnits: number | null
  /** LIHTC low-income units, or HUD assisted units. */
  affordableUnits: number | null
  /** LIHTC elected income ceiling: 50 or 60 (% AMI), 'avg' for income averaging, null if unknown. */
  incomeCeiling: 50 | 60 | 'avg' | null
  /** Bedroom sizes that exist in the building (0 = studio). Empty if unknown. */
  bedrooms: number[]
  yearPlacedInService: number | null
  seniorOnly: boolean
  disabilityOnly: boolean
  /** Straight-line miles to the nearest Metro station. */
  metroMiles: number | null
  contact: { name: string | null; org: string | null; phone: string | null; email: string | null }
  source: { dataset: string; url: string; retrieved: string }
  /** True for the made-up rows in the dev sample. Never shown as real. */
  sample?: boolean
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
}
