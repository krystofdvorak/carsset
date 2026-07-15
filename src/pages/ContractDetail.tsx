import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import type { Contract } from '../lib/types'
import { getContract, markReturned as apiMarkReturned, deleteContract, setEmailSentTo, signedUrl, downloadBlob, sendThankYou } from '../lib/store'
import { fmtCZK, fmtDateTime, carEmoji } from '../lib/format'
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
    setC((await getContract(id)) ?? null)
  }
  useEffect(() => { reload() }, [id])

  // náhled smlouvy (podepsané PDF ze Storage)
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!c || c === null) return
      if (!c.pdfPath) return
      const url = await signedUrl(c.pdfPath)
      if (alive) setPdfUrl(url)
    })()
    return () => { alive = false }
  }, [c])

  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 4500) }

  // po vytvoření smlouvy ukaž, co se s e-mailem reálně stalo
  useEffect(() => {
    const st = location.state as { emailMode?: string; recipients?: string[] } | null
    if (!st?.emailMode) return
    const msg: Record<string, string> = {
      api: `✓ Smlouva odeslána e-mailem: ${(st.recipients || []).join(', ')}`,
      failed: 'Smlouva uložena. E-mail se zatím neodeslal – zkontroluj nastavení Brevo (nebo pošli „Odeslat klientovi znovu").',
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

  async function openPdf() {
    if (!contract.pdfPath) { flash('PDF není k dispozici'); return }
    const url = await signedUrl(contract.pdfPath)
    if (url) window.open(url, '_blank')
  }

  async function resend() {
    if (!contract.pdfPath) { flash('PDF není k dispozici'); return }
    setBusy(true)
    try {
      const pdf = await downloadBlob(contract.pdfPath)
      if (!pdf) { flash('PDF se nepodařilo načíst'); return }
      const sent = await sendContractEmail(pdf, {
        contractNumber: contract.number,
        customerEmail: contract.customer.email,
        customerName: `${contract.customer.firstName} ${contract.customer.lastName}`.trim(),
        carName: contract.carName,
        rentalStart: contract.rentalStart,
        rentalEnd: contract.rentalEnd,
        price: contract.price,
      })
      const msg: Record<string, string> = {
        api: `Odesláno na ${sent.recipients.join(', ')}`,
        failed: 'Odeslání selhalo (zkontroluj nastavení Brevo).',
      }
      if (sent.ok && sent.mode === 'api') await setEmailSentTo(contract.id, sent.recipients)
      flash(msg[sent.mode] ?? '')
    } finally { setBusy(false) }
  }

  async function markReturned() {
    await apiMarkReturned(contract.id, true)
    flash('Označeno jako vrácené ✓')
    reload()
    // poděkování + prosba o recenzi klientovi (neblokující)
    if (contract.customer.email) {
      sendThankYou({
        contractNumber: contract.number,
        customerName: `${contract.customer.firstName} ${contract.customer.lastName}`.trim(),
        customerEmail: contract.customer.email,
      }).then((ok) => { if (ok) flash('✓ Poděkování s prosbou o recenzi odesláno klientovi') })
    }
  }
  async function undoReturned() {
    await apiMarkReturned(contract.id, false)
    reload()
  }

  async function remove() {
    if (!confirm('Opravdu smazat tuto smlouvu?')) return
    await deleteContract(contract)
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

        {contract.photos.some((p) => p.kind === 'car') && (
          <div className="card">
            <h2>Fotky vozidla ({contract.photos.filter((p) => p.kind === 'car').length})</h2>
            <div className="photo-grid">
              {contract.photos.filter((p) => p.kind === 'car').map((p, i) => <PhotoThumb key={i} path={p.path} />)}
            </div>
          </div>
        )}
        {contract.photos.some((p) => p.kind !== 'car') && (
          <div className="card">
            <h2>Fotky dokladů ({contract.photos.filter((p) => p.kind !== 'car').length})</h2>
            <div className="photo-grid">
              {contract.photos.filter((p) => p.kind !== 'car').map((p, i) => <PhotoThumb key={i} path={p.path} />)}
            </div>
          </div>
        )}

        {contract.emailSentTo && contract.emailSentTo.length > 0 && (
          <div className="banner ok">📧 Odesláno: {contract.emailSentTo.join(', ')}</div>
        )}

        {!contract.returned ? (
          <button className="btn ok" style={{ marginBottom: 10 }} onClick={markReturned}>✓ Auto vráceno v pořádku</button>
        ) : (
          <button className="btn ghost" style={{ marginBottom: 10 }} onClick={undoReturned}>Zrušit označení vrácení</button>
        )}
        <button className="btn block-danger" onClick={remove}>Smazat smlouvu</button>

        <div className="divider" />
        <button className="btn small" style={{ marginBottom: 8 }} onClick={openPdf} disabled={busy}>Otevřít PDF</button>
        <button className="btn small" onClick={resend} disabled={busy}>Odeslat klientovi znovu</button>
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

function PhotoThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    let alive = true
    signedUrl(path).then((u) => { if (alive) setUrl(u) })
    return () => { alive = false }
  }, [path])
  return <div className="photo-preview">{url && <img src={url} alt="příloha" />}</div>
}
