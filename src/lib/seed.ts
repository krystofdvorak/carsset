import { db, type Contract } from '../db/db'
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
 * Vloží ~12 ukázkových smluv rozložených do několika dnů (pro náhled gridu).
 * Idempotentní – používá pevná id demo-*, takže opakované volání nic nezduplikuje.
 */
export async function seedDemoContracts(now: number): Promise<number> {
  const rows: Contract[] = []
  // rozložení začátků nájmu: dny -2 až +3 od teď, různé hodiny
  const dayOffsets = [-2, -2, -1, -1, 0, 0, 0, 1, 1, 2, 3, 3]
  const hours = [8, 14, 9, 17, 7, 12, 19, 10, 15, 9, 11, 16]

  for (let i = 0; i < 12; i++) {
    const car = CARS[i % CARS.length]
    const [firstName, lastName, identifier] = NAMES[i % NAMES.length]
    const tier = TIERS[i % TIERS.length]
    const start = new Date(now)
    start.setDate(start.getDate() + dayOffsets[i])
    start.setHours(hours[i], 0, 0, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    const startLocal = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:00`
    const end = computeEnd(startLocal, tier)
    const base =
      tier === '5h' ? car.prices.p5 : tier === '10h' ? car.prices.p10 : car.prices.p24
    const antiradar = i % 3 === 0
    // stav: část vrácená, část aktivní, jedna po termínu
    const returned = dayOffsets[i] < 0 && i % 2 === 0

    rows.push({
      id: `demo-${i + 1}`,
      number: `2026-${String(900 + i)}`,
      createdAt: now - i * 3600_000,
      carId: car.id,
      carName: car.name,
      carType: car.type,
      tier,
      price: base + (antiradar ? 500 : 0),
      deposit: car.deposit,
      depositPaid: true,
      antiradar,
      rentalStart: startLocal,
      rentalEnd: end,
      customer: { firstName, lastName, identifier, email: `${lastName.toLowerCase()}@example.cz`, phone: '+420 777 000 000' },
      signature: '',
      returned,
      returnedAt: returned ? now - i * 3600_000 : undefined,
    })
  }

  await db.contracts.bulkPut(rows)
  return rows.length
}
