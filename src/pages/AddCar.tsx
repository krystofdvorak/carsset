import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listUserCars, addUserCar, deleteUserCar } from '../lib/store'
import type { UserCar } from '../lib/types'
import type { CarType } from '../data/cars'
import { fmtCZK } from '../lib/format'
import { BackButton } from '../components/BackButton'

export function AddCar() {
  const nav = useNavigate()
  const [userCars, setUserCars] = useState<UserCar[]>([])
  const reload = () => listUserCars().then((r) => setUserCars(r.reverse())).catch(() => {})
  useEffect(() => { reload() }, [])
  const [name, setName] = useState('')
  const [type, setType] = useState<CarType>('osobni')
  const [p5, setP5] = useState<number | ''>('')
  const [p10, setP10] = useState<number | ''>('')
  const [p24, setP24] = useState<number | ''>('')
  const [p24w, setP24w] = useState<number | ''>('')
  const [p72, setP72] = useState<number | ''>('')
  const [deposit, setDeposit] = useState<number | ''>(5000)
  const [saving, setSaving] = useState(false)

  const num = (v: number | '') => (v === '' ? 0 : v)
  const canSave = name.trim() !== '' && num(p24) > 0

  async function save() {
    setSaving(true)
    try {
      await addUserCar({
        id: `user-${crypto.randomUUID().slice(0, 8)}`,
        name: name.trim(),
        type,
        deposit: num(deposit),
        prices: {
          p5: num(p5), p10: num(p10), p24: num(p24),
          p24w: num(p24w) || num(p24), p72: num(p72),
        },
      })
      setName(''); setP5(''); setP10(''); setP24(''); setP24w(''); setP72(''); setDeposit(5000)
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const priceField = (label: string, val: number | '', set: (n: number | '') => void) => (
    <div className="field">
      <label>{label}</label>
      <input type="number" inputMode="numeric" value={val}
        onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Kč" />
    </div>
  )

  return (
    <div className="app">
      <header className="topbar">
        <BackButton onClick={() => nav('/')} />
        <div style={{ flex: 1 }}><h1>Auta v nabídce</h1><div className="sub">Přidej vozidlo a jeho ceny</div></div>
      </header>

      <main className="content">
        <div className="card">
          <h2>Nové vozidlo</h2>
          <div className="field">
            <label>Kategorie</label>
            <div className="segment">
              <button className={type === 'osobni' ? 'active' : ''} onClick={() => setType('osobni')}>🏎️ Osobní</button>
              <button className={type === 'dodavka' ? 'active' : ''} onClick={() => setType('dodavka')}>🚐 Dodávka</button>
            </div>
          </div>
          <div className="field">
            <label>Název vozidla *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="např. Audi RS3" />
          </div>
          <div className="grid-2">
            {priceField('Cena 5 h (po–pá)', p5, setP5)}
            {priceField('Cena 10 h (po–pá)', p10, setP10)}
          </div>
          <div className="grid-2">
            {priceField('Cena 24 h (po–pá) *', p24, setP24)}
            {priceField('Cena 24 h (víkend)', p24w, setP24w)}
          </div>
          <div className="grid-2">
            {priceField('Cena 72 h (víkend)', p72, setP72)}
            {priceField('Kauce', deposit, setDeposit)}
          </div>
          <button className="btn primary" style={{ marginTop: 6 }} disabled={!canSave || saving} onClick={save}>
            {saving ? <span className="spin">⏳</span> : '＋'} Přidat do nabídky
          </button>
          <p className="note" style={{ marginTop: 10 }}>Víkendová 24h cena se použije při začátku pá–ne. Když ji nevyplníš, použije se běžná 24h.</p>
        </div>

        {userCars && userCars.length > 0 && (
          <div className="card">
            <h2>Přidaná vozidla ({userCars.length})</h2>
            {userCars.map((c) => (
              <div key={c.id} className="summary-row">
                <span className="k">{c.type === 'dodavka' ? '🚐' : '🏎️'} {c.name}</span>
                <span className="v" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {fmtCZK(c.prices.p24)}/24h
                  <button className="chip" onClick={async () => { await deleteUserCar(c.id); reload() }}>Smazat</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
