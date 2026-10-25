import type { Building } from './types'

/** The badge on a card: which public program the building is in, in plain words. */
export function programLabel(b: Building): string {
  switch (b.subsidy) {
    case 'public-housing':
      return 'Public housing'
    case 'usda':
      return b.program === 'HUD' ? 'USDA rural · rent by income' : 'USDA rural rental'
    case 'dc':
      return b.incomeCeiling === 'avg' || b.incomeCeiling == null ? 'DC covenant' : `DC covenant · up to ${b.incomeCeiling}% MFI`
    case 'md':
      return 'Maryland-financed'
  }
  if (b.program === 'HUD') return 'HUD-assisted'
  if (b.incomeCeiling === 'avg') return 'Tax credit · mixed tiers'
  return `Tax credit · ${b.incomeCeiling ?? 60}% tier`
}

/** One line on how rent works here. */
export function rentModel(b: Building): string {
  if (b.program === 'HUD') return b.subsidy === 'public-housing' ? 'Rent is about 30% of income; the housing authority runs the waitlist' : 'Rent set by your income'
  if (b.subsidy === 'dc') return 'Rents capped by DC income tier'
  return 'Rent capped by tier'
}

/** The dataset a row came from, for the "no phone" line and the source footnote. */
export function sourceName(b: Building): string {
  switch (b.subsidy) {
    case 'public-housing':
      return "HUD's public housing data"
    case 'usda':
      return "USDA's data"
    case 'dc':
      return "DC's affordable housing list"
    case 'md':
      return "Maryland's multifamily list"
  }
  return 'HUD data'
}
