import type { Contract } from './types'
import { fmtDateTime } from './format'

export type StatusKind = 'returned' | 'green' | 'orange' | 'red'

export interface Status {
  kind: StatusKind
  label: string
}

const H = 3600 * 1000

/**
 * Barevný stav smlouvy podle času vůči konci nájmu:
 *  - vráceno              → zelená „Vráceno"
 *  - více než 2 h do konce → zelená „Aktivní"
 *  - 2 h před koncem       → oranžová
 *  - do 1 h po konci       → oranžová (grace)
 *  - více než 1 h po konci a nevráceno → červená
 */
export function contractStatus(c: Contract, now: number = Date.now()): Status {
  if (c.returned) return { kind: 'returned', label: '✓ Vráceno' }
  const end = new Date(c.rentalEnd).getTime()
  if (isNaN(end)) return { kind: 'green', label: 'Aktivní' }

  if (now >= end + 1 * H) return { kind: 'red', label: '⚠ Po termínu – nevráceno' }
  if (now >= end) return { kind: 'orange', label: `Právě skončilo · vrať do ${fmtDateTime(c.rentalEnd)}` }
  if (now >= end - 2 * H) return { kind: 'orange', label: `Brzy konec · ${fmtDateTime(c.rentalEnd)}` }
  return { kind: 'green', label: `Aktivní · do ${fmtDateTime(c.rentalEnd)}` }
}
