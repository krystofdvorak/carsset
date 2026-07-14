import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { db, type Contract } from '../db/db'
import { fmtCZK, fmtDateTime, carEmoji } from '../lib/format'
import { generatePdfBlob } from '../lib/pdf'
import { sendContractEmail } from '../lib/email'
import { contractStatus } from '../lib/status'
import { ANTIRADAR_PRICE } from '../lib/pricing'
import { BackButton } from '../components/BackButton'

export function ContractDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const location = useLocation()
  const [c, setC] = useState<Contract | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [pdfUrl, setPdfUrl] = useState<string>()

  async function reload() {
    if (!id) return
    setC((await db.contracts.get(id)) ?? null)
  }
  useEffect(() => { reload() }, [id])

  // náhled smlouvy (PDF) do iframe
  useEffect(() => {
    let revoked = false
    let url: string | undefined
    ;(async () => {
      if (!id) return
      const rec = await db.contracts.get(id)
      if (!rec) return
      const pdf = rec.pdf ?? (await generatePdfBlob(rec))
      if (!rec.pdf) await db.contracts.update(id, { pdf })
      if (revoked) return
      url = URL.createObjectURL(pdf)
      setPdfUrl(url)
    })()
    return () => { revoked = true; if (url) URL.revokeObjectURL(url) }
  }, [id])

  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 4500) }

  // po vytvoření smlouvy ukaž, co se s e-mailem reálně stalo
  useEffect(() => {
    const st = location.state as { emailMode?: string; recipients?: string[] } | null
    if (!st?.emailMode) return
    const msg: Record<string, string> = {
      api: `✓ Smlouva odeslána e-mailem: ${(st.recipients || []).join(', ')}`,
      share: 'Smlouva připravena – vyber Mail/aplikaci a odešli zákazníkovi i majiteli',
      download: 'PDF staženo. Auto-odesílání e-mailem zapneš nasazením serverless funkce (viz README).',
      failed: 'E-mail se nepodařilo odeslat – zkus „Odeslat / sdílet znovu".',
    }
    if (msg[st.emailMode]) flash(msg[st.emailMode])
    nav(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (c === undefined) return <div className="app"><div className="empty"><span className="spin big">⏳</span></div></div>
  if (c === null) return (
    <div className="app">
      <header className="topbar"><BackButton onClick={() => nav('/')} /><h1>Smlouva</h1></header>
      <div className="empty"><div className="big">🔍</div><p>Smlouva nenalezena.</p></div>
    </div>
  )

  const contract = c
  const st = contractStatus(contract)
  const antiradarFee = contract.antiradar ? ANTIRADAR_PRICE : 0
  const base = contract.price - antiradarFee

  async function getPdf(): Promise<Blob> {
    if (contract.pdf) return contract.pdf
    const pdf = await generatePdfBlob(contract)
    await db.contracts.update(contract.id, { pdf })
    return pdf
  }

  async function openPdf() {
    setBusy(true)
    try {
      const url = URL.createObjectURL(await getPdf())
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } finally { setBusy(false) }
  }

  async function resend() {
    setBusy(true)
    try {
      const pdf = await getPdf()
      const sent = await sendContractEmail(pdf, {
        contractNumber: contract.number,
        customerEmail: contract.customer.email,
        customerName: `${contract.customer.firstName} ${contract.customer.lastName}`.trim(),
      })
      const msg = {
        api: `Odesláno na ${sent.recipients.join(', ')}`,
        share: 'Otevřeno sdílení – vyber Mail a odešli',
        download: 'PDF staženo (e-mail není nakonfigurován)',
        failed: 'Odeslání se nezdařilo',
      }[sent.mode]
      if (sent.ok && sent.mode === 'api') await db.contracts.update(contract.id, { emailSentTo: sent.recipients })
      flash(msg)
    } finally { setBusy(false) }
  }

  async function markReturned() {
    await db.contracts.update(contract.id, { returned: true, returnedAt: Date.now() })
    flash('Označeno jako vrácené ✓')
    reload()
  }
  async function undoReturned() {
    await db.contracts.update(contract.id, { returned: false, returnedAt: undefined })
    reload()
  }

  async function remove() {
    if (!confirm('Opravdu smazat tuto smlouvu?')) return
    await db.contracts.delete(contract.id)
    nav('/', { replace: true })
  }

  return (
    <div className="app">
      <header className="topbar">
        <BackButton onClick={() => nav('/')} />
        <div style={{ flex: 1 }}>
          <h1>Smlouva č. {contract.number}</h1>
          <div className="sub">{new Date(contract.createdAt).toLocaleString('cs-CZ')}</div>
        </div>
      </header>

      <main className="content">
        {st.kind === 'red' && <div className="banner err">⚠ Termín skončil {fmtDateTime(contract.rentalEnd)} a auto stále není označené jako vrácené.</div>}
        {st.kind === 'orange' && <div className="banner warn">⏳ Blíží se konec nájmu ({fmtDateTime(contract.rentalEnd)}). Nezapomeň po vrácení odkliknout.</div>}
        {contract.returned && <div className="banner ok">✓ Auto vráceno v pořádku{contract.returnedAt ? ` · ${new Date(contract.returnedAt).toLocaleString('cs-CZ')}` : ''}.</div>}

        <div className="detail-grid">
        <div className="detail-info">
        <div className="card">
          <h2>Vozidlo</h2>
          <div className="summary-row"><span className="k">{carEmoji(contract.carType)} Model</span><span className="v">{contract.carName}</span></div>
          <div className="summary-row"><span className="k">Kategorie</span><span className="v">{contract.carType === 'dodavka' ? 'Dodávka' : 'Osobní'}</span></div>
        </div>

        <div className="card">
          <h2>Nájemce</h2>
          <div className="summary-row"><span className="k">Jméno</span><span className="v">{contract.customer.firstName} {contract.customer.lastName}</span></div>
          <div className="summary-row"><span className="k">Identifikátor</span><span className="v">{contract.customer.identifier}</span></div>
          {contract.customer.email && <div className="summary-row"><span className="k">E-mail</span><span className="v">{contract.customer.email}</span></div>}
          {contract.customer.phone && <div className="summary-row"><span className="k">Telefon</span><span className="v">{contract.customer.phone}</span></div>}
        </div>

        <div className="card">
          <h2>Nájem</h2>
          <div className="summary-row"><span className="k">Od</span><span className="v">{fmtDateTime(contract.rentalStart)}</span></div>
          <div className="summary-row"><span className="k">Do</span><span className="v">{fmtDateTime(contract.rentalEnd)}</span></div>
          <div className="summary-row"><span className="k">Nájem</span><span className="v">{fmtCZK(base)}</span></div>
          <div className="summary-row"><span className="k">Antiradar</span><span className="v">{contract.antiradar ? `Ano · +${fmtCZK(ANTIRADAR_PRICE)}` : 'Ne'}</span></div>
          <div className="summary-row"><span className="k">Kauce</span><span className="v">{fmtCZK(contract.deposit)} · {contract.depositPaid ? 'uhrazena' : 'neuhrazena'}</span></div>
          <div className="summary-total"><span className="k">Cena celkem</span><span className="amount">{fmtCZK(contract.price)}</span></div>
        </div>

        {contract.emailSentTo && contract.emailSentTo.length > 0 && (
          <div className="banner ok">📧 Odesláno: {contract.emailSentTo.join(', ')}</div>
        )}

        {!contract.returned ? (
          <button className="btn ok" style={{ marginBottom: 10 }} onClick={markReturned}>✓ Auto vráceno v pořádku</button>
        ) : (
          <button className="btn ghost" style={{ marginBottom: 10 }} onClick={undoReturned}>Zrušit označení vrácení</button>
        )}
        <button className="btn primary" style={{ marginBottom: 10 }} onClick={openPdf} disabled={busy}>{busy ? <span className="spin">⏳</span> : '📄'} Otevřít PDF</button>
        <button className="btn ghost" style={{ marginBottom: 10 }} onClick={resend} disabled={busy}>📧 Odeslat / sdílet znovu</button>
        <button className="btn block-danger" onClick={remove}>Smazat smlouvu</button>
        </div>

        <div className="detail-preview">
          <div className="card" style={{ marginBottom: 0 }}>
            <h2>Náhled smlouvy</h2>
            {pdfUrl ? (
              <iframe className="pdf-frame" src={pdfUrl} title="Náhled smlouvy" />
            ) : (
              <div className="pdf-loading"><span className="spin">⏳</span></div>
            )}
            <p className="note" style={{ marginTop: 10 }}>Pokud se náhled nezobrazí (např. na iPhonu), otevři PDF tlačítkem výše.</p>
          </div>
        </div>
        </div>
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
