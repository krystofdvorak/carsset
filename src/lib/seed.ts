import { supabase } from './supabase'
import { CARS } from '../data/cars'
import { computeEnd } from './pricing'

const NAMES: [string, string, string][] = [
  ['Jan', 'Novák', '900101/1234'],
  ['Petr', 'Svoboda', '880512/2345'],
  ['Lucie', 'Dvořáková', '9155230123'],
  ['Tomáš', 'Procházka', '870707/3456'],
  ['Eva', 'Kučerová', '925410/4567'],
  ['Martin', 'Veselý', '830228/5678'],
  ['Jana', 'Horáková', '945612/6789'],
  ['Ondřej', 'Němec', '910903/7890'],
]
const TIERS = ['5h', '10h', '24h'] as const

/**
 * Vloží ~14 ukázkových smluv (posledních 5 dní) do Supabase.
 * Idempotentní – pevná demo-* id, opakované volání přepíše (upsert).
 */
export async function seedDemoContracts(now: number): Promise<number> {
  const dayOffsets = [-5, -5, -4, -4, -3, -3, -3, -2, -2, -1, -1, -1, 0, 0]
  const hours = [8, 15, 9, 17, 7, 12, 19, 10, 16, 8, 13, 18, 9, 14]
  const rows = []

  for (let i = 0; i < dayOffsets.length; i++) {
    const car = CARS[i % CARS.length]
    const [firstName, lastName, identifier] = NAMES[i % NAMES.length]
    const tier = TIERS[i % TIERS.length]
    const start = new Date(now)
    start.setDate(start.getDate() + dayOffsets[i])
    start.setHours(hours[i], 0, 0, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    const startLocal = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:00`
    const end = computeEnd(startLocal, tier)
    const base = tier === '5h' ? car.prices.p5 : tier === '10h' ? car.prices.p10 : car.prices.p24
    const antiradar = i % 3 === 0
    const returned = dayOffsets[i] < 0 && i % 3 !== 0

    rows.push({
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      number: `2026-${String(900 + i)}`,
      created_at: new Date(now - i * 3600_000).toISOString(),
      car_id: car.id,
      car_name: car.name,
      car_type: car.type,
      price: base + (antiradar ? 500 : 0),
      deposit: car.deposit,
      deposit_paid: true,
      antiradar,
      rental_start: startLocal,
      rental_end: end,
      customer: { firstName, lastName, identifier, email: `${lastName.toLowerCase()}@example.cz`, phone: '+420 777 000 000' },
      signature: '',
      returned,
      returned_at: returned ? new Date(now - i * 3600_000).toISOString() : null,
      photos: [],
    })
  }

  const { error } = await supabase.from('contracts').upsert(rows)
  if (error) throw error
  return rows.length
}
