import Dexie, { type EntityTable } from 'dexie'
import type { Car, CarType, PriceTier, Prices } from '../data/cars'

export interface Customer {
  firstName: string
  lastName: string
  identifier: string // rodné číslo / číslo OP
  email: string
  phone: string
}

export interface Contract {
  id: string
  number: string
  createdAt: number
  carId: string
  carName: string
  carType: CarType
  tier?: PriceTier // nepovinné – cena se zadává ručně
  price: number
  deposit: number
  depositPaid: boolean // switch „kauce uhrazena"
  antiradar: boolean // switch „půjčuje si antiradar"
  rentalStart: string // ISO datetime-local
  rentalEnd: string
  customer: Customer
  signature: string
  pdf?: Blob
  emailSentTo?: string[] // komu už bylo odesláno
  returned: boolean // „auto vráceno v pořádku"
  returnedAt?: number
}

// Auta přidaná uživatelem (přednastavená jsou v data/cars.ts)
export type UserCar = Omit<Car, 'seeded'> & { createdAt: number }

export interface Client {
  identifier: string // PK
  firstName: string
  lastName: string
  email: string
  phone: string
  lastUsed: number
  count: number
}

const db = new Dexie('carsset') as Dexie & {
  contracts: EntityTable<Contract, 'id'>
  cars: EntityTable<UserCar, 'id'>
  clients: EntityTable<Client, 'identifier'>
}

db.version(1).stores({
  contracts: 'id, createdAt, number, carId, returned, rentalEnd',
  cars: 'id, createdAt, type',
  clients: 'identifier, lastName, lastUsed',
})

export { db }

export function emptyCustomer(): Customer {
  return { firstName: '', lastName: '', identifier: '', email: '', phone: '' }
}

/** Ulož/aktualizuj klienta pro našeptávání */
export async function upsertClient(c: Customer, now: number) {
  if (!c.identifier.trim()) return
  const existing = await db.clients.get(c.identifier)
  await db.clients.put({
    identifier: c.identifier,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    lastUsed: now,
    count: (existing?.count ?? 0) + 1,
  })
}

export type { Prices }
