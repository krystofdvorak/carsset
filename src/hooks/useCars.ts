import { useEffect, useState } from 'react'
import { listUserCars } from '../lib/store'
import { CARS, type Car } from '../data/cars'

/** Spojí přednastavená vozidla (kód) s vozidly přidanými uživatelem (DB). */
export function useCars(reloadKey = 0): Car[] {
  const [added, setAdded] = useState<Car[]>([])
  useEffect(() => {
    let alive = true
    listUserCars()
      .then((rows) => { if (alive) setAdded(rows.map((c) => ({ ...c, seeded: false }))) })
      .catch(() => {})
    return () => { alive = false }
  }, [reloadKey])
  return [...added, ...CARS]
}

export function carById(list: Car[], id: string): Car | undefined {
  return list.find((c) => c.id === id)
}
