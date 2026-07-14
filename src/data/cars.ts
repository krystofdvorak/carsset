export type CarType = 'osobni' | 'dodavka'
export type PriceTier = '5h' | '10h' | '24h' | '72h'

export interface Prices {
  p5: number // 5 h (po–pá)
  p10: number // 10 h (po–pá)
  p24: number // 24 h (po–pá)
  p24w: number // 24 h (pá–po + svátky)
  p72: number // 72 h (pouze víkend pá–po)
}

export interface Car {
  id: string
  name: string
  type: CarType
  prices: Prices
  deposit: number
  /** true = přednastavené vozidlo z kódu; false/undefined = přidané uživatelem (v DB) */
  seeded?: boolean
}

export const TIERS: { key: PriceTier; label: string; hours: number; weekendOnly?: boolean }[] = [
  { key: '5h', label: '5 hodin', hours: 5 },
  { key: '10h', label: '10 hodin', hours: 10 },
  { key: '24h', label: '24 hodin', hours: 24 },
  { key: '72h', label: '72 h (jen víkend)', hours: 72, weekendOnly: true },
]

// Reálná vozidla a ceny z carsset.cz (staženo 07/2026)
export const CARS: Car[] = [
  { id: 'lexus-lc500', name: 'Lexus LC 500 Cabrio', type: 'osobni', deposit: 10000, seeded: true,
    prices: { p5: 6000, p10: 9000, p24: 12000, p24w: 13000, p72: 32000 } },
  { id: 'bmw-m4-comp', name: 'BMW M4 Competition 600 HP', type: 'osobni', deposit: 5000, seeded: true,
    prices: { p5: 5500, p10: 7500, p24: 10000, p24w: 11000, p72: 27000 } },
  { id: 'bmw-m2', name: 'BMW M2 M-Performance', type: 'osobni', deposit: 5000, seeded: true,
    prices: { p5: 3500, p10: 5500, p24: 7000, p24w: 7500, p72: 21000 } },
  { id: 'audi-s6', name: 'Audi S6 600 HP', type: 'osobni', deposit: 5000, seeded: true,
    prices: { p5: 3500, p10: 5500, p24: 6000, p24w: 7000, p72: 17000 } },
  { id: 'audi-s3', name: 'Audi S3', type: 'osobni', deposit: 5000, seeded: true,
    prices: { p5: 3000, p10: 4000, p24: 5000, p24w: 6000, p72: 14500 } },
  { id: 'mercedes-a45', name: 'Mercedes A45 AMG', type: 'osobni', deposit: 5000, seeded: true,
    prices: { p5: 3000, p10: 4000, p24: 5000, p24w: 6000, p72: 14500 } },
  { id: 'audi-s5', name: 'Audi S5 4.2 FSI V8', type: 'osobni', deposit: 5000, seeded: true,
    prices: { p5: 2000, p10: 3000, p24: 4000, p24w: 5000, p72: 12000 } },
  { id: 'bmw-x5', name: 'BMW X5 F15 xDrive25d', type: 'osobni', deposit: 5000, seeded: true,
    prices: { p5: 2000, p10: 3000, p24: 4000, p24w: 5000, p72: 12000 } },
  { id: 'tesla-s-p85', name: 'Tesla S Performance P85', type: 'osobni', deposit: 5000, seeded: true,
    prices: { p5: 1500, p10: 2000, p24: 3000, p24w: 4000, p72: 9000 } },

  // Dodávky (z carsset.cz – ceny orientační, uprav přes „Přidat auto" nebo dej vědět reálné)
  { id: 'peugeot-boxer', name: 'Peugeot Boxer', type: 'dodavka', deposit: 5000, seeded: true,
    prices: { p5: 800, p10: 1200, p24: 1500, p24w: 1800, p72: 3900 } },
  { id: 'fiat-ducato', name: 'Fiat Ducato', type: 'dodavka', deposit: 5000, seeded: true,
    prices: { p5: 800, p10: 1200, p24: 1500, p24w: 1800, p72: 3900 } },
  { id: 'citroen-jumper', name: 'Citroën Jumper', type: 'dodavka', deposit: 5000, seeded: true,
    prices: { p5: 800, p10: 1200, p24: 1500, p24w: 1800, p72: 3900 } },
  { id: 'renault-kangoo', name: 'Renault Kangoo', type: 'dodavka', deposit: 5000, seeded: true,
    prices: { p5: 500, p10: 700, p24: 900, p24w: 1100, p72: 2400 } },
]
