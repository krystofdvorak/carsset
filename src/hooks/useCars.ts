import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { CARS, type Car } from '../data/cars'

/** Spojí přednastavená vozidla (kód) s vozidly přidanými uživatelem (DB). */
export function useCars(): Car[] {
  const userCars = useLiveQuery(() => db.cars.orderBy('createdAt').toArray(), [])
  const added: Car[] = (userCars ?? []).map((c) => ({ ...c, seeded: false }))
  return [...added, ...CARS]
}

export function carById(list: Car[], id: string): Car | undefined {
  return list.find((c) => c.id === id)
}
