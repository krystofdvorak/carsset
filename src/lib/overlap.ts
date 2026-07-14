import { db, type Contract } from '../db/db'

function toMs(iso: string): number {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? NaN : d.getTime()
}

/** Dvě intervaly [s1,e1) a [s2,e2) se překrývají, pokud s1 < e2 && s2 < e1. */
export function intervalsOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  const a = toMs(s1), b = toMs(e1), c = toMs(s2), d = toMs(e2)
  if ([a, b, c, d].some((x) => isNaN(x))) return false
  return a < d && c < b
}

/**
 * Najde existující smlouvu na stejné auto, jejíž termín se překrývá.
 * `ignoreId` vynechá právě editovanou smlouvu.
 */
export async function findConflict(
  carId: string,
  start: string,
  end: string,
  ignoreId?: string,
): Promise<Contract | null> {
  const same = await db.contracts.where('carId').equals(carId).toArray()
  for (const c of same) {
    if (c.id === ignoreId) continue
    if (intervalsOverlap(start, end, c.rentalStart, c.rentalEnd)) return c
  }
  return null
}
