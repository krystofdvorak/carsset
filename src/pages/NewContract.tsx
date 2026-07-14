import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TIERS, type CarType, type PriceTier } from '../data/cars'
import { db, emptyCustomer, upsertClient, type Client, type Customer, type Contract } from '../db/db'
import { useCars, carById } from '../hooks/useCars'
import { SignaturePad, type SignaturePadHandle } from '../components/SignaturePad'
import { Switch } from '../components/Switch'
import { BackButton } from '../components/BackButton'
import { DateTimeField } from '../components/DateTimeField'
import { isValidEmail, isValidPhone, isValidIdentifier } from '../lib/validate'
import { generatePdfBlob } from '../lib/pdf'
import { sendContractEmail } from '../lib/email'
import { priceFor, computeEnd, isWeekendStart, is72Allowed, nowLocal, ANTIRADAR_PRICE } from '../lib/pricing'
import { findConflict } from '../lib/overlap'
import { fmtCZK, fmtDateTime, contractNumber } from '../lib/format'

const STEPS = ['Vozidlo', 'Termín a doplňky', 'Nájemce', 'Podpis'] as const

export function NewContract() {
  const nav = useNavigate()
  const cars = useCars()
  const [step, setStep] = useState(0)
  const [type, setType] = useState<CarType>('osobni')
  const [carId, setCarId] = useState('')
  const [tier, setTier] = useState<PriceTier | ''>('')
  const [rentalStart, setRentalStart] = useState(nowLocal())
  const [antiradar, setAntiradar] = useState(false)
  const [depositPaid, setDepositPaid] = useState(false)
  const [customer, setCustomer] = useState<Customer>(emptyCustomer())
  const [suggestions, setSuggestions] = useState<Client[]>([])
  const [showSuggest, setShowSuggest] = useState(false)
  const [conflict, setConflict] = useState<Contract | null>(null)
  const [sigEmpty, setSigEmpty] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string>()
  const sigRef = useRef<SignaturePadHandle>(null)

  const minPrice = (c: (typeof cars)[number]) =>
    Math.min(c.prices.p5, c.prices.p10, c.prices.p24, c.prices.p24w, c.prices.p72)
  const filtered = cars.filter((c) => c.type === type).sort((a, b) => minPrice(a) - minPrice(b))
  const car = carById(cars, carId)
  const weekend = isWeekendStart(rentalStart)
  const allow72 = is72Allowed(rentalStart)
  const tier72Invalid = tier === '72h' && !allow72
  const basePrice = car && tier ? priceFor(car, tier, rentalStart) : 0
  const antiradarFee = antiradar ? ANTIRADAR_PRICE : 0
  const price = basePrice + antiradarFee
  const deposit = car?.deposit ?? 0
  const rentalEnd = useMemo(() => (tier ? computeEnd(rentalStart, tier) : ''), [rentalStart, tier])

  const upd = (patch: Partial<Customer>) => setCustomer((c) => ({ ...c, ...patch }))

  // hlídání překrytí rezervací
  useEffect(() => {
    let alive = true
    if (!carId || !tier || !rentalStart || !rentalEnd) { setConflict(null); return }
    findConflict(carId, rentalStart, rentalEnd).then((c) => { if (alive) setConflict(c) })
    return () => { alive = false }
  }, [carId, tier, rentalStart, rentalEnd])

  // náhled smlouvy na kroku Podpis – klient si ji přečte ještě před podepsáním
  useEffect(() => {
    if (step !== 3 || !car || !tier) return
    let url: string | undefined
    let cancelled = false
    const t = setTimeout(async () => {
      const draft: Contract = {
        id: 'draft', number: 'náhled', createdAt: Date.now(),
        carId, carName: car.name, carType: car.type, tier, price, deposit,
        depositPaid, antiradar, rentalStart, rentalEnd, customer, signature: '', returned: false,
      }
      const pdf = await generatePdfBlob(draft)
      if (cancelled) return
      url = URL.createObjectURL(pdf)
      setPreviewUrl(url)
    }, 350)
    return () => { cancelled = true; clearTimeout(t); if (url) URL.revokeObjectURL(url) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, carId, tier, rentalStart, rentalEnd, price, deposit, depositPaid, antiradar, customer])

  // našeptávání klientů podle příjmení / identifikátoru
  async function refreshSuggestions(q: string) {
    const query = q.trim().toLowerCase()
    if (query.length < 2) { setSuggestions([]); return }
    const all = await db.clients.toArray()
    const match = all
      .filter((c) =>
        c.lastName.toLowerCase().includes(query) ||
        c.firstName.toLowerCase().includes(query) ||
        c.identifier.toLowerCase().includes(query),
      )
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, 6)
    setSuggestions(match)
  }

  function pickClient(c: Client) {
    setCustomer({ firstName: c.firstName, lastName: c.lastName, identifier: c.identifier, email: c.email, phone: c.phone })
    setShowSuggest(false)
    setSuggestions([])
  }

  const emailValid = isValidEmail(customer.email)
  const phoneValid = customer.phone.trim() === '' || isValidPhone(customer.phone)
  const idValid = isValidIdentifier(customer.identifier)
  const nameValid = customer.firstName.trim() !== '' && customer.lastName.trim() !== ''

  const canNext = [
    !!carId,
    !!tier && !!rentalStart && !conflict && !tier72Invalid,
    nameValid && idValid && emailValid && phoneValid,
    !sigEmpty && depositPaid,
  ][step]

  async function handleSave() {
    if (!car || !tier) return
    setSaving(true)
    setStatus('Generuji PDF…')
    try {
      const signature = sigRef.current?.toDataURL() ?? ''
      const year = new Date().getFullYear()
      const countThisYear = await db.contracts.filter((c) => new Date(c.createdAt).getFullYear() === year).count()
      const id = crypto.randomUUID()
      const now = Date.now()
      const contract: Contract = {
        id,
        number: contractNumber(countThisYear, year),
        createdAt: now,
        carId,
        carName: car.name,
        carType: car.type,
        tier,
        price,
        deposit,
        depositPaid,
        antiradar,
        rentalStart,
        rentalEnd,
        customer,
        signature,
        returned: false,
      }
      const pdf = await generatePdfBlob(contract)
      contract.pdf = pdf
      await db.contracts.add(contract)
      await upsertClient(customer, now)

      // automatické odeslání e-mailem (zákazník + owner)
      setStatus('Odesílám e-mail…')
      const sent = await sendContractEmail(pdf, {
        contractNumber: contract.number,
        customerEmail: customer.email,
        customerName: `${customer.firstName} ${customer.lastName}`.trim(),
      })
      // „Odesláno" evidujeme jen při reálném odeslání přes API; share/download je jen příprava
      if (sent.ok && sent.mode === 'api') {
        await db.contracts.update(id, { emailSentTo: sent.recipients })
      }
      nav(`/smlouva/${id}`, { replace: true, state: { emailMode: sent.mode, recipients: sent.recipients } })
    } catch (e) {
      console.error(e)
      alert('Uložení selhalo: ' + (e as Error).message)
      setSaving(false)
    }
  }

  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1)
    else handleSave()
  }
  function back() {
    if (step === 0) nav('/')
    else setStep((s) => s - 1)
  }

  return (
    <div className="app">
      <header className="topbar">
        <BackButton onClick={back} />
        <div style={{ flex: 1 }}><h1>Nová smlouva</h1><div className="sub">Krok {step + 1} z {STEPS.length}</div></div>
      </header>

      <div className="steps">{STEPS.map((_, i) => <div key={i} className={`dot ${i <= step ? 'done' : ''}`} />)}</div>
      <div className="step-title"><div className="kicker">KROK {step + 1}</div><h2>{STEPS[step]}</h2></div>

      <main className="content">
        {step === 0 && (
          <div>
            <div className="card">
              <h2>Kategorie vozidla</h2>
              <div className="segment">
                <button className={type === 'osobni' ? 'active' : ''} onClick={() => { setType('osobni'); setCarId('') }}>🏎️ Osobní</button>
                <button className={type === 'dodavka' ? 'active' : ''} onClick={() => { setType('dodavka'); setCarId('') }}>🚐 Dodávka</button>
              </div>
            </div>
            <div className="car-grid">
            {filtered.map((c) => (
              <button key={c.id} className={`car ${carId === c.id ? 'selected' : ''}`} onClick={() => setCarId(c.id)}>
                <span className="emoji">{c.type === 'dodavka' ? '🚐' : '🏎️'}</span>
                <span className="info">
                  <div className="name">{c.name}</div>
                  <div className="meta">kauce {fmtCZK(c.deposit)}</div>
                </span>
                <span className="price"><small>od</small>{fmtCZK(minPrice(c))}</span>
              </button>
            ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="card">
              <h2>Termín</h2>
              <DateTimeField label="Začátek nájmu" value={rentalStart} onChange={setRentalStart} />
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Konec nájmu (dopočítáno)</label>
                <input type="text" value={fmtDateTime(rentalEnd)} disabled />
              </div>
            </div>

            <div className="card">
              <h2>Tarif</h2>
              <div className="tiers">
                {TIERS.map((t) => {
                  const disabled = t.weekendOnly && !allow72
                  const p = car ? priceFor(car, t.key, rentalStart) : 0
                  return (
                    <button key={t.key} className={`tier ${tier === t.key ? 'selected' : ''}`}
                      disabled={disabled} onClick={() => setTier(t.key)}>
                      {t.weekendOnly && <span className="t-badge">jen pá</span>}
                      {t.key === '24h' && weekend && <span className="t-badge">víkend</span>}
                      <div className="t-label">{t.label}</div>
                      <div className="t-price">{car ? fmtCZK(p) : '—'}</div>
                    </button>
                  )
                })}
              </div>
              {!allow72 && <p className="note" style={{ marginTop: 10 }}>72h balíček (pá–po) lze zvolit jen když je začátek v pátek.</p>}
              {tier === '24h' && weekend && <p className="note" style={{ marginTop: 10 }}>Použita víkendová 24h sazba (pá–po + svátky).</p>}
            </div>

            {conflict && (
              <div className="banner err">
                ⚠ Toto auto je v daném termínu obsazené smlouvou č. {conflict.number}
                ({fmtDateTime(conflict.rentalStart)} – {fmtDateTime(conflict.rentalEnd)}, {conflict.customer.lastName}).
              </div>
            )}

            <div className="card">
              <h2>Doplňky</h2>
              <Switch checked={antiradar} onChange={setAntiradar} label="Půjčuje si antiradar" sub={`Příplatek + ${fmtCZK(ANTIRADAR_PRICE)}`} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="card">
              <h2>Nájemce</h2>
              <div className="field">
                <label>Příjmení *</label>
                <input value={customer.lastName}
                  onChange={(e) => { upd({ lastName: e.target.value }); refreshSuggestions(e.target.value); setShowSuggest(true) }}
                  onFocus={() => customer.lastName.length >= 2 && setShowSuggest(true)}
                  placeholder="začni psát – našeptá dřívějšího klienta" autoComplete="off" />
                {showSuggest && suggestions.length > 0 && (
                  <div className="suggest">
                    {suggestions.map((s) => (
                      <button key={s.identifier} onClick={() => pickClient(s)}>
                        <div className="s-name">{s.firstName} {s.lastName}</div>
                        <div className="s-meta">{s.identifier} · {s.count}× · {s.email || 'bez e-mailu'}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="field">
                <label>Jméno *</label>
                <input value={customer.firstName} onChange={(e) => upd({ firstName: e.target.value })} />
              </div>
              <div className={`field ${customer.identifier && !idValid ? 'err' : ''}`}>
                <label>Identifikátor (RČ / číslo OP) *</label>
                <input value={customer.identifier}
                  onChange={(e) => { upd({ identifier: e.target.value }); refreshSuggestions(e.target.value); setShowSuggest(true) }}
                  placeholder="např. 900101/1234" autoComplete="off" />
                {customer.identifier && !idValid && <div className="field-err">Zadej platný identifikátor (min. 6 znaků, číslice).</div>}
              </div>
              <div className={`field ${customer.email && !emailValid ? 'err' : ''}`}>
                <label>E-mail zákazníka * (kam přijde PDF)</label>
                <input type="email" inputMode="email" value={customer.email}
                  onChange={(e) => upd({ email: e.target.value })} placeholder="klient@email.cz" />
                {customer.email && !emailValid && <div className="field-err">Neplatný e-mail.</div>}
              </div>
              <div className={`field ${!phoneValid ? 'err' : ''}`} style={{ marginBottom: 0 }}>
                <label>Telefon</label>
                <input type="tel" inputMode="tel" value={customer.phone} onChange={(e) => upd({ phone: e.target.value })} placeholder="+420 777 123 456" />
                {!phoneValid && <div className="field-err">Neplatné telefonní číslo.</div>}
              </div>
              <p className="note" style={{ marginTop: 10 }}>PDF se po podpisu automaticky odešle zákazníkovi i majiteli půjčovny.</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="card">
              <h2>Rekapitulace</h2>
              <div className="summary-row"><span className="k">Vozidlo</span><span className="v">{car?.name}</span></div>
              <div className="summary-row"><span className="k">Nájemce</span><span className="v">{customer.firstName} {customer.lastName}</span></div>
              <div className="summary-row"><span className="k">Termín</span><span className="v">{fmtDateTime(rentalStart)} → {fmtDateTime(rentalEnd)}</span></div>
              <div className="summary-row"><span className="k">Nájem</span><span className="v">{fmtCZK(basePrice)}</span></div>
              <div className="summary-row"><span className="k">Antiradar</span><span className="v">{antiradar ? `Ano · +${fmtCZK(ANTIRADAR_PRICE)}` : 'Ne'}</span></div>
              <div className="summary-row"><span className="k">Kauce</span><span className="v">{fmtCZK(deposit)} · {depositPaid ? 'uhrazena' : 'neuhrazena'}</span></div>
              <div className="summary-total"><span className="k">Cena celkem</span><span className="amount">{fmtCZK(price)}</span></div>
            </div>
            <div className="card">
              <h2>Kauce</h2>
              <Switch checked={depositPaid} onChange={setDepositPaid} label="Kauce uhrazena" sub={`Vratná kauce ${fmtCZK(deposit)}`} />
              {!depositPaid && <div className="banner warn" style={{ marginTop: 10, marginBottom: 0 }}>⚠ Bez potvrzení úhrady kauce nelze smlouvu vytvořit a odeslat.</div>}
            </div>
            <div className="card">
              <h2>Náhled smlouvy</h2>
              <p className="note" style={{ margin: '0 0 10px' }}>Nech klienta smlouvu přečíst před podpisem.</p>
              {previewUrl ? (
                <iframe className="pdf-frame" src={previewUrl} title="Náhled smlouvy" />
              ) : (
                <div className="pdf-loading"><span className="spin">⏳</span></div>
              )}
            </div>
            <div className="card">
              <h2>Podpis nájemce</h2>
              <SignaturePad ref={sigRef} onChange={setSigEmpty} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button className="chip" onClick={() => sigRef.current?.clear()}>Vymazat podpis</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <div className="bottombar stack">
        <button className="btn primary" onClick={next} disabled={!canNext || saving}>
          {saving ? <><span className="spin">⏳</span> {status}</> : step === STEPS.length - 1 ? 'Vytvořit a odeslat' : 'Pokračovat'}
        </button>
        {step > 0 && <button className="btn ghost small" onClick={back} disabled={saving}>Zpět</button>}
      </div>
    </div>
  )
}
