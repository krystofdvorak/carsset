import type { Car, PriceTier } from '../data/cars'

/** Příplatek za zapůjčení antiradaru (Kč). */
export const ANTIRADAR_PRICE = 500

/** Víkendový začátek nájmu = pátek / sobota / neděle (tarif pá–po). */
export function isWeekendStart(startLocal: string): boolean {
  if (!startLocal) return false
  const d = new Date(startLocal)
  if (isNaN(d.getTime())) return false
  const day = d.getDay() // 0 = ne, 5 = pá, 6 = so
  return day === 5 || day === 6 || day === 0
}

/** 72h balíček (pá–po) smí začít pouze v pátek. */
export function is72Allowed(startLocal: string): boolean {
  if (!startLocal) return false
  const d = new Date(startLocal)
  if (isNaN(d.getTime())) return false
  return d.getDay() === 5
}

export function priceFor(car: Car, tier: PriceTier, startLocal: string): number {
  switch (tier) {
    case '5h':
      return car.prices.p5
    case '10h':
      return car.prices.p10
    case '24h':
      return isWeekendStart(startLocal) ? car.prices.p24w : car.prices.p24
    case '72h':
      return car.prices.p72
  }
}

const TIER_HOURS: Record<PriceTier, number> = { '5h': 5, '10h': 10, '24h': 24, '72h': 72 }

/** Přičti hodiny tarifu k začátku, vrať datetime-local řetězec konce. */
export function computeEnd(startLocal: string, tier: PriceTier): string {
  if (!startLocal) return ''
  const d = new Date(startLocal)
  if (isNaN(d.getTime())) return ''
  d.setHours(d.getHours() + TIER_HOURS[tier])
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function nowLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
