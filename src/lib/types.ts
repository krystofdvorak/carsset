import type { CarType, PriceTier, Prices } from '../data/cars'

export type { Prices }

export interface Customer {
  firstName: string
  lastName: string
  identifier: string // rodné číslo / číslo OP
  email: string
  phone: string
}

export type PhotoKind = 'idFront' | 'idBack' | 'licenseFront' | 'licenseBack' | 'car'

/** Fotka uložená ve Storage (cesta v bucketu). */
export interface StoredPhoto {
  kind: PhotoKind
  path: string
}

/** Fotka v paměti při tvorbě smlouvy (blob z fotoaparátu). */
export interface PhotoBlob {
  kind: PhotoKind
  blob: Blob
}

/** Smlouva načtená z DB. */
export interface Contract {
  id: string
  number: string
  createdAt: number
  carId: string
  carName: string
  carType: CarType
  tier?: PriceTier
  price: number
  deposit: number
  depositPaid: boolean
  antiradar: boolean
  rentalStart: string
  rentalEnd: string
  customer: Customer
  signature: string
  returned: boolean
  returnedAt?: number
  emailSentTo?: string[]
  pdfPath?: string
  photos: StoredPhoto[]
}

/** Data pro vytvoření smlouvy (s bloby fotek + PDF v paměti). */
export interface NewContractInput {
  number: string
  carId: string
  carName: string
  carType: CarType
  price: number
  deposit: number
  depositPaid: boolean
  antiradar: boolean
  rentalStart: string
  rentalEnd: string
  customer: Customer
  signature: string
  photos: PhotoBlob[]
  pdf: Blob
}

export interface UserCar {
  id: string
  name: string
  type: CarType
  prices: Prices
  deposit: number
  createdAt: number
}

export interface Client {
  identifier: string
  firstName: string
  lastName: string
  email: string
  phone: string
  lastUsed: number
  count: number
}

export function emptyCustomer(): Customer {
  return { firstName: '', lastName: '', identifier: '', email: '', phone: '' }
}
