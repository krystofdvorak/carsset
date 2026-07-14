import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Contract } from '../db/db'
import { fmtCZK, fmtDateTime, carEmoji } from '../lib/format'

export function isOverdue(c: Contract): boolean {
  if (c.returned) return false
  const end = new Date(c.rentalEnd).getTime()
  return !isNaN(end) && Date.now() > end
}

export function Home() {
  const nav = useNavigate()
  const contracts = useLiveQuery(() => db.contracts.orderBy('createdAt').reverse().toArray(), [])

  return (
    <div className="app">
      <header className="topbar">
        <img src="/logo.svg" alt="Carsset" className="brand-logo" />
        <div style={{ flex: 1 }} />
        <button className="icon-btn" onClick={() => nav('/auta')}>＋ Auto</button>
      </header>

      <main className="content">
        {contracts === undefined ? (
          <div className="empty"><span className="spin big">⏳</span></div>
        ) : contracts.length === 0 ? (
          <div className="empty">
            <div className="big">📄</div>
            <p>Zatím žádné smlouvy.<br />Vytvoř první tlačítkem dole.</p>
          </div>
        ) : (
          contracts.map((c) => {
            const over = isOverdue(c)
            return (
              <button
                key={c.id}
                className={`list-item ${over ? 'overdue' : ''} ${c.returned ? 'returned' : ''}`}
                onClick={() => nav(`/smlouva/${c.id}`)}
              >
                <span className="li-emoji">{carEmoji(c.carType)}</span>
                <span className="li-main">
                  <div className="li-name">{c.customer.firstName} {c.customer.lastName || '(bez jména)'}</div>
                  <div className="li-meta">{c.carName} · {fmtDateTime(c.rentalStart)}</div>
                  <div className="li-meta">č. {c.number} · {fmtCZK(c.price)}</div>
                  {c.returned ? (
                    <span className="li-tag returned">✓ Vráceno</span>
                  ) : over ? (
                    <span className="li-tag overdue">⚠ Po termínu – nevráceno</span>
                  ) : (
                    <span className="li-tag active">Aktivní · do {fmtDateTime(c.rentalEnd)}</span>
                  )}
                </span>
                <span style={{ color: 'var(--muted)', fontSize: 22 }}>›</span>
              </button>
            )
          })
        )}
      </main>

      <button className="fab" onClick={() => nav('/nova')}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>＋</span> Nová smlouva
      </button>
    </div>
  )
}
