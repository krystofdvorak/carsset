import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Contract } from '../db/db'
import { fmtCZK, fmtDateTime, carEmoji } from '../lib/format'
import { contractStatus } from '../lib/status'
import { seedDemoContracts } from '../lib/seed'

function dayKey(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 'x'
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const s = d.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function Home() {
  const nav = useNavigate()
  const [seeding, setSeeding] = useState(false)
  const contracts = useLiveQuery(() => db.contracts.orderBy('createdAt').reverse().toArray(), [])

  async function seed() {
    setSeeding(true)
    await seedDemoContracts(Date.now())
    setSeeding(false)
  }

  // seskupení podle dne začátku nájmu, dny od nejnovějšího
  const groups: { key: string; label: string; items: Contract[] }[] = []
  if (contracts) {
    const byDay = new Map<string, Contract[]>()
    for (const c of contracts) {
      const k = dayKey(c.rentalStart)
      if (!byDay.has(k)) byDay.set(k, [])
      byDay.get(k)!.push(c)
    }
    for (const [key, items] of byDay) {
      items.sort((a, b) => new Date(b.rentalStart).getTime() - new Date(a.rentalStart).getTime())
      groups.push({ key, label: dayLabel(items[0].rentalStart), items })
    }
    groups.sort((a, b) => new Date(b.items[0].rentalStart).getTime() - new Date(a.items[0].rentalStart).getTime())
  }

  return (
    <div className="app">
      <header className="topbar">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Carsset" className="brand-logo" />
        <div style={{ flex: 1 }} />
        <button className="icon-btn" onClick={() => nav('/auta')}>＋ Nový vůz do nabídky</button>
      </header>

      <main className="content">
        {contracts === undefined ? (
          <div className="empty"><span className="spin big">⏳</span></div>
        ) : contracts.length === 0 ? (
          <div className="empty">
            <div className="big">📄</div>
            <p>Zatím žádné smlouvy.<br />Vytvoř první tlačítkem dole.</p>
            <button className="btn ghost" style={{ maxWidth: 320, margin: '20px auto 0' }} onClick={seed} disabled={seeding}>
              {seeding ? <span className="spin">⏳</span> : '✨'} Vložit ukázkové smlouvy
            </button>
          </div>
        ) : (
          <>
            <button className="seed-link" onClick={seed} disabled={seeding}>
              {seeding ? 'Vkládám…' : '✨ Vložit ukázkové smlouvy (demo)'}
            </button>
            {groups.map((g) => (
              <section key={g.key} className="day-group">
                <div className="day-header">{g.label} <span className="day-count">{g.items.length}</span></div>
                <div className="list-grid">
                  {g.items.map((c) => {
                    const st = contractStatus(c)
                    return (
                      <button key={c.id} className={`list-item st-${st.kind}`} onClick={() => nav(`/smlouva/${c.id}`)}>
                        <span className="li-emoji">{carEmoji(c.carType)}</span>
                        <span className="li-main">
                          <div className="li-name">{c.customer.firstName} {c.customer.lastName || '(bez jména)'}</div>
                          <div className="li-meta">{c.carName} · {fmtDateTime(c.rentalStart)}</div>
                          <div className="li-meta">č. {c.number} · {fmtCZK(c.price)}</div>
                          <span className={`li-tag ${st.kind}`}>{st.label}</span>
                        </span>
                        <span style={{ color: 'var(--muted)', fontSize: 22 }}>›</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </>
        )}
      </main>

      <button className="fab" onClick={() => nav('/nova')}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>＋</span> Nová smlouva
      </button>
    </div>
  )
}
