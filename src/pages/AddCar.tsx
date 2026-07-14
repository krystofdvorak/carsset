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
  const [deposit, setDeposit] = useState<number | ''>(5000)
  const [saving, setSaving] = useState(false)

  const num = (v: number | '') => (v === '' ? 0 : v)
  const canSave = name.trim() !== ''

  async function save() {
    setSaving(true)
    try {
      await addUserCar({
        id: `user-${crypto.randomUUID().slice(0, 8)}`,
        name: name.trim(),
        type,
        deposit: num(deposit),
        prices: { p5: 0, p10: 0, p24: 0, p24w: 0, p72: 0 },
      })
      setName(''); setDeposit(5000)
      await reload()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <BackButton onClick={() => nav('/')} />
        <div style={{ flex: 1 }}><h1>Auta v nabídce</h1><div className="sub">Přidej vozidlo do nabídky</div></div>
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
          <div className="field">
            <label>Kauce (Kč)</label>
            <input type="number" inputMode="numeric" value={deposit}
              onChange={(e) => setDeposit(e.target.value === '' ? '' : Number(e.target.value))} placeholder="např. 5000" />
          </div>
          <button className="btn primary" style={{ marginTop: 6 }} disabled={!canSave || saving} onClick={save}>
            {saving ? <span className="spin">⏳</span> : '＋'} Přidat do nabídky
          </button>
          <p className="note" style={{ marginTop: 10 }}>Cenu nájmu zadáváš u každé smlouvy zvlášť.</p>
        </div>

        {userCars.length > 0 && (
          <div className="card">
            <h2>Přidaná vozidla ({userCars.length})</h2>
            {userCars.map((c) => (
              <div key={c.id} className="summary-row">
                <span className="k">{c.type === 'dodavka' ? '🚐' : '🏎️'} {c.name}</span>
                <span className="v" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  kauce {fmtCZK(c.deposit)}
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
