import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addUserCar, deleteUserCar, setCarHidden } from '../lib/store'
import { useCars } from '../hooks/useCars'
import type { CarType } from '../data/cars'
import { fmtCZK } from '../lib/format'
import { BackButton } from '../components/BackButton'

export function AddCar() {
  const nav = useNavigate()
  const [reloadKey, setReloadKey] = useState(0)
  const cars = useCars(reloadKey)
  const reload = () => setReloadKey((k) => k + 1)

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
      reload()
    } finally {
      setSaving(false)
    }
  }

  async function toggleHidden(id: string, hidden: boolean) {
    await setCarHidden(id, hidden)
    reload()
  }
  async function remove(id: string) {
    if (!confirm('Smazat toto vozidlo z nabídky?')) return
    await deleteUserCar(id)
    reload()
  }

  const osobni = cars.filter((c) => c.type === 'osobni')
  const dodavky = cars.filter((c) => c.type === 'dodavka')

  const carRow = (c: (typeof cars)[number]) => (
    <div key={c.id} className={`offer-row ${c.hidden ? 'off' : ''}`}>
      <span className="offer-emoji">{c.type === 'dodavka' ? '🚐' : '🏎️'}</span>
      <span className="offer-main">
        <div className="offer-name">{c.name}</div>
        <div className="offer-meta">kauce {fmtCZK(c.deposit)}{c.hidden ? ' · neaktivní' : ''}</div>
      </span>
      <button className="chip" onClick={() => toggleHidden(c.id, !c.hidden)}>{c.hidden ? 'Zobrazit' : 'Skrýt'}</button>
      {!c.seeded && <button className="chip danger" onClick={() => remove(c.id)}>Smazat</button>}
    </div>
  )

  return (
    <div className="app">
      <header className="topbar">
        <BackButton onClick={() => nav('/')} />
        <div style={{ flex: 1 }}><h1>Nabídka vozidel</h1><div className="sub">Přidej, skryj nebo uprav</div></div>
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

        <div className="card">
          <h2>Osobní ({osobni.length})</h2>
          {osobni.map(carRow)}
        </div>
        <div className="card">
          <h2>Dodávky ({dodavky.length})</h2>
          {dodavky.length ? dodavky.map(carRow) : <p className="note">Zatím žádné dodávky.</p>}
        </div>
      </main>
    </div>
  )
}
