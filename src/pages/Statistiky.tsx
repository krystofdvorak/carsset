import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Contract } from '../lib/types'
import { listContracts } from '../lib/store'
import { contractStatus } from '../lib/status'
import { fmtCZK } from '../lib/format'
import { BackButton } from '../components/BackButton'

function durationBucket(c: Contract): string {
  const h = (new Date(c.rentalEnd).getTime() - new Date(c.rentalStart).getTime()) / 3600_000
  if (isNaN(h)) return '—'
  if (h <= 7) return '≈ 5 h'
  if (h <= 17) return '≈ 10 h'
  if (h <= 36) return '≈ 24 h'
  if (h <= 96) return '2–4 dny'
  return '5+ dní'
}

export function Statistiky() {
  const nav = useNavigate()
  const [contracts, setContracts] = useState<Contract[] | undefined>(undefined)
  useEffect(() => { listContracts().then(setContracts).catch(() => setContracts([])) }, [])

  const s = useMemo(() => {
    const all = contracts ?? []
    const now = new Date()
    const revenue = all.reduce((a, c) => a + (c.price || 0), 0)
    const clients = new Set(all.map((c) => c.customer.identifier).filter(Boolean)).size
    const monthRevenue = all
      .filter((c) => { const d = new Date(c.createdAt); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() })
      .reduce((a, c) => a + (c.price || 0), 0)

    let active = 0, overdue = 0, returned = 0
    for (const c of all) {
      const k = contractStatus(c).kind
      if (k === 'returned') returned++
      else if (k === 'red') overdue++
      else active++
    }

    const byCar = new Map<string, { count: number; revenue: number }>()
    for (const c of all) {
      const cur = byCar.get(c.carName) ?? { count: 0, revenue: 0 }
      cur.count++; cur.revenue += c.price || 0
      byCar.set(c.carName, cur)
    }
    const topCars = [...byCar.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue)
    const maxCarRev = topCars[0]?.revenue || 1

    const byDur = new Map<string, number>()
    for (const c of all) byDur.set(durationBucket(c), (byDur.get(durationBucket(c)) ?? 0) + 1)
    const durations = [...byDur.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
    const maxDur = durations[0]?.count || 1

    const topClients = (() => {
      const m = new Map<string, { name: string; count: number; revenue: number }>()
      for (const c of all) {
        const key = c.customer.identifier || `${c.customer.firstName} ${c.customer.lastName}`
        const cur = m.get(key) ?? { name: `${c.customer.firstName} ${c.customer.lastName}`.trim(), count: 0, revenue: 0 }
        cur.count++; cur.revenue += c.price || 0
        m.set(key, cur)
      }
      return [...m.values()].filter((x) => x.count > 1).sort((a, b) => b.count - a.count).slice(0, 5)
    })()

    return { total: all.length, revenue, clients, monthRevenue, active, overdue, returned, avg: all.length ? Math.round(revenue / all.length) : 0, topCars, maxCarRev, durations, maxDur, topClients }
  }, [contracts])

  return (
    <div className="app">
      <header className="topbar">
        <BackButton onClick={() => nav('/')} />
        <div style={{ flex: 1 }}><h1>Statistiky</h1><div className="sub">Přehled půjčovny</div></div>
      </header>

      <main className="content">
        {contracts === undefined ? (
          <div className="empty"><span className="spin big">⏳</span></div>
        ) : contracts.length === 0 ? (
          <div className="empty"><div className="big">📊</div><p>Zatím žádná data.</p></div>
        ) : (
          <>
            <div className="kpi-grid">
              <div className="kpi"><div className="kpi-val">{fmtCZK(s.revenue)}</div><div className="kpi-lbl">Obrat celkem</div></div>
              <div className="kpi"><div className="kpi-val">{fmtCZK(s.monthRevenue)}</div><div className="kpi-lbl">Obrat tento měsíc</div></div>
              <div className="kpi"><div className="kpi-val">{s.total}</div><div className="kpi-lbl">Smluv celkem</div></div>
              <div className="kpi"><div className="kpi-val">{s.clients}</div><div className="kpi-lbl">Klientů</div></div>
              <div className="kpi"><div className="kpi-val">{fmtCZK(s.avg)}</div><div className="kpi-lbl">Průměr / smlouva</div></div>
              <div className="kpi"><div className="kpi-val">{s.active}<span style={{ color: 'var(--muted)', fontSize: 15 }}> / {s.overdue}</span></div><div className="kpi-lbl">Aktivní / po termínu</div></div>
            </div>

            <div className="card">
              <h2>Výdělek podle vozidla</h2>
              {s.topCars.map((c) => (
                <div key={c.name} className="carstat">
                  <div className="carstat-top">
                    <span className="carstat-name">{c.name}</span>
                    <span className="carstat-rev">{fmtCZK(c.revenue)}</span>
                  </div>
                  <span className="bar-track"><span className="bar-fill" style={{ width: `${Math.round((c.revenue / s.maxCarRev) * 100)}%` }} /></span>
                  <div className="carstat-sub">{c.count}× pronájem · ø {fmtCZK(Math.round(c.revenue / c.count))} / smlouva</div>
                </div>
              ))}
            </div>

            <div className="card">
              <h2>Nejčastější délka pronájmu</h2>
              {s.durations.map((d) => (
                <div key={d.label} className="bar-row">
                  <span className="bar-lbl">{d.label}</span>
                  <span className="bar-track"><span className="bar-fill" style={{ width: `${Math.round((d.count / s.maxDur) * 100)}%` }} /></span>
                  <span className="bar-num">{d.count}×</span>
                </div>
              ))}
            </div>

            {s.topClients.length > 0 && (
              <div className="card">
                <h2>Vracející se klienti</h2>
                {s.topClients.map((c) => (
                  <div key={c.name} className="summary-row">
                    <span className="k">{c.name}</span>
                    <span className="v">{c.count}× · {fmtCZK(c.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
