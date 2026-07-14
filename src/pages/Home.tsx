import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Contract } from '../lib/types'
import { listContracts, signOut } from '../lib/store'
import { fmtCZK, fmtDateTime, carEmoji } from '../lib/format'
import { contractStatus } from '../lib/status'

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
  const [query, setQuery] = useState('')
  const [contracts, setContracts] = useState<Contract[] | undefined>(undefined)

  async function reload() {
    try {
      setContracts(await listContracts())
    } catch {
      setContracts([])
    }
  }
  useEffect(() => { reload() }, [])

  const q = query.trim().toLowerCase()
  const filtered = (contracts ?? []).filter((c) => {
    if (!q) return true
    const d = new Date(c.rentalStart)
    const dateStr = isNaN(d.getTime())
      ? ''
      : [
          `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`,
          `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`,
          d.toLocaleDateString('cs-CZ'),
        ].join(' ')
    // hledání: datum / jméno / rodné číslo
    const hay = `${c.customer.firstName} ${c.customer.lastName} ${c.customer.identifier} ${dateStr}`.toLowerCase()
    return hay.includes(q)
  })

  // seskupení podle dne začátku nájmu, dny od nejnovějšího
  const groups: { key: string; label: string; items: Contract[] }[] = []
  if (contracts) {
    const byDay = new Map<string, Contract[]>()
    for (const c of filtered) {
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
        <button className="icon-btn" title="Odhlásit" onClick={() => signOut()} style={{ padding: '0 12px' }}>⎋</button>
      </header>

      <main className="content">
        {contracts === undefined ? (
          <div className="empty"><span className="spin big">⏳</span></div>
        ) : (
          <>
            <div className="search">
              <span className="search-icon">🔍</span>
              <input
                type="search"
                placeholder="Hledat podle data, jména nebo rodného čísla…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && <button className="search-clear" onClick={() => setQuery('')}>✕</button>}
            </div>
            {contracts.length === 0 && (
              <div className="empty">
                <div className="big">📄</div>
                <p>Zatím žádné smlouvy.<br />Vytvoř první tlačítkem dole.</p>
              </div>
            )}
            {contracts.length > 0 && groups.length === 0 && (
              <div className="empty" style={{ padding: '40px 20px' }}>
                <div className="big">🔍</div>
                <p>Nic nenalezeno pro „{query}".</p>
              </div>
            )}
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
