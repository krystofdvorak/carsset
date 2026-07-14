import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { fmtCZK, fmtDateTime, carEmoji } from '../lib/format'
import { contractStatus } from '../lib/status'

export function Home() {
  const nav = useNavigate()
  const contracts = useLiveQuery(() => db.contracts.orderBy('createdAt').reverse().toArray(), [])

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
          </div>
        ) : (
          contracts.map((c) => {
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
          })
        )}
      </main>

      <button className="fab" onClick={() => nav('/nova')}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>＋</span> Nová smlouva
      </button>
    </div>
  )
}
