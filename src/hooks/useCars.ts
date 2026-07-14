import { useEffect, useState } from 'react'
import { listUserCars, listHiddenCarIds } from '../lib/store'
import { CARS, type Car } from '../data/cars'

/** Spojí přednastavená vozidla (kód) s vozidly přidanými uživatelem (DB) a označí skrytá. */
export function useCars(reloadKey = 0): Car[] {
  const [added, setAdded] = useState<Car[]>([])
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  useEffect(() => {
    let alive = true
    Promise.all([listUserCars(), listHiddenCarIds()])
      .then(([rows, hid]) => {
        if (!alive) return
        setAdded(rows.map((c) => ({ ...c, seeded: false })))
        setHidden(new Set(hid))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [reloadKey])
  return [...added, ...CARS].map((c) => ({ ...c, hidden: hidden.has(c.id) }))
}

export function carById(list: Car[], id: string): Car | undefined {
  return list.find((c) => c.id === id)
}
