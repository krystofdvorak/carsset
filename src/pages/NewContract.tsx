import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type CarType } from '../data/cars'
import { emptyCustomer, type Client, type Customer, type PhotoBlob, type PhotoKind, type Contract } from '../lib/types'
import { createContract, upsertClient, findConflict, searchClients, listContracts, setEmailSentTo, ocrDoklad } from '../lib/store'
import { useCars, carById } from '../hooks/useCars'
import { SignaturePad, type SignaturePadHandle } from '../components/SignaturePad'
import { Switch } from '../components/Switch'
import { PhotoInput } from '../components/PhotoInput'
import { compressPhoto } from '../lib/image'
import { BackButton } from '../components/BackButton'
import { DateTimeField } from '../components/DateTimeField'
import { isValidEmail, isValidPhone, isValidIdentifier } from '../lib/validate'
import { generatePdfBlob, type PdfData } from '../lib/pdf'
import { sendContractEmail } from '../lib/email'
import { nowLocal, ANTIRADAR_PRICE } from '../lib/pricing'
import { fmtCZK, fmtDateTime, contractNumber } from '../lib/format'

const STEPS = ['Vozidlo', 'Foto vozidla', 'Termín a cena', 'Nájemce', 'Podpis'] as const

function addHoursLocal(startLocal: string, hours: number): string {
  const d = new Date(startLocal)
  if (isNaN(d.getTime())) return ''
  d.setHours(d.getHours() + hours)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function NewContract() {
  const nav = useNavigate()
  const cars = useCars()
  const [step, setStep] = useState(0)
  const [type, setType] = useState<CarType>('osobni')
  const [carId, setCarId] = useState('')
  const [rentalStart, setRentalStart] = useState(nowLocal())
  const [rentalEnd, setRentalEnd] = useState(addHoursLocal(nowLocal(), 24))
  const [basePrice, setBasePrice] = useState<number | ''>('')
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
  const [docPhotos, setDocPhotos] = useState<Partial<Record<PhotoKind, Blob>>>({})
  const [carPhotos, setCarPhotos] = useState<Blob[]>([])
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrMsg, setOcrMsg] = useState('')
  const sigRef = useRef<SignaturePadHandle>(null)

  // OCR: načte údaje z fotky občanky (rodné číslo) / doplní z řidičáku
  async function runOcr() {
    const src: [Blob, 'op' | 'rp'] | undefined = docPhotos.idFront
      ? [docPhotos.idFront, 'op']
      : docPhotos.licenseFront
        ? [docPhotos.licenseFront, 'rp']
        : undefined
    if (!src) return
    setOcrBusy(true)
    setOcrMsg('')
    try {
      const r = await ocrDoklad(src[0], src[1])
      setCustomer((c) => ({
        ...c,
        firstName: r.firstName ?? c.firstName,
        lastName: r.lastName ?? c.lastName,
        identifier: r.rodneCislo ?? c.identifier,
      }))
      const filled = [r.firstName && 'jméno', r.lastName && 'příjmení', r.rodneCislo && 'rodné číslo'].filter(Boolean)
      setOcrMsg(
        filled.length
          ? `✓ Načteno: ${filled.join(', ')}. Zkontroluj a případně oprav.`
          : 'Nepodařilo se nic přečíst – zkus lepší/ostřejší fotku nebo vyplň ručně.',
      )
    } catch (e) {
      setOcrMsg('Načtení selhalo: ' + (e as Error).message)
    } finally {
      setOcrBusy(false)
    }
  }

  const DOC_FIELDS: { kind: PhotoKind; label: string }[] = [
    { kind: 'idFront', label: 'Občanka – přední' },
    { kind: 'idBack', label: 'Občanka – zadní' },
    { kind: 'licenseFront', label: 'Řidičák – přední' },
    { kind: 'licenseBack', label: 'Řidičák – zadní' },
  ]

  function collectPhotos(): PhotoBlob[] {
    const out: PhotoBlob[] = []
    for (const { kind } of DOC_FIELDS) {
      const b = docPhotos[kind]
      if (b) out.push({ kind, blob: b })
    }
    for (const b of carPhotos) out.push({ kind: 'car', blob: b })
    return out
  }

  const filtered = cars
    .filter((c) => c.type === type)
    .sort((a, b) => a.prices.p24 - b.prices.p24)
  const car = carById(cars, carId)
  const basePriceNum = basePrice === '' ? 0 : basePrice
  // cena v políčku už zahrnuje antiradar (přičítá se přímo do částky)
  const price = basePriceNum
  const deposit = car?.deposit ?? 0
  const endAfterStart = new Date(rentalEnd).getTime() > new Date(rentalStart).getTime()

  const upd = (patch: Partial<Customer>) => setCustomer((c) => ({ ...c, ...patch }))

  function selectCar(id: string) {
    setCarId(id)
  }

  // přepnutí antiradaru přičte/odečte 500 Kč přímo do částky za nájem
  function toggleAntiradar(v: boolean) {
    setAntiradar(v)
    setBasePrice((p) => {
      const n = p === '' ? 0 : p
      return Math.max(0, n + (v ? ANTIRADAR_PRICE : -ANTIRADAR_PRICE))
    })
  }

  // hlídání překrytí rezervací
  useEffect(() => {
    let alive = true
    if (!carId || !rentalStart || !rentalEnd || !endAfterStart) { setConflict(null); return }
    findConflict(carId, rentalStart, rentalEnd).then((c) => { if (alive) setConflict(c) })
    return () => { alive = false }
  }, [carId, rentalStart, rentalEnd, endAfterStart])

  // náhled smlouvy na kroku Podpis – klient si ji přečte ještě před podepsáním
  useEffect(() => {
    if (step !== 4 || !car) return
    let url: string | undefined
    let cancelled = false
    const t = setTimeout(async () => {
      const draft: PdfData = {
        number: 'náhled', createdAt: Date.now(),
        carName: car.name, carType: car.type, price, deposit,
        depositPaid, antiradar, rentalStart, rentalEnd, customer,
        photos: collectPhotos(), signature: '',
      }
      const pdf = await generatePdfBlob(draft)
      if (cancelled) return
      url = URL.createObjectURL(pdf)
      setPreviewUrl(url)
    }, 350)
    return () => { cancelled = true; clearTimeout(t); if (url) URL.revokeObjectURL(url) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, carId, rentalStart, rentalEnd, price, deposit, depositPaid, antiradar, customer, docPhotos, carPhotos])

  // našeptávání klientů podle příjmení / jména / identifikátoru
  async function refreshSuggestions(q: string) {
    setSuggestions(await searchClients(q))
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
    true, // foto vozidla – volitelné, lze přeskočit
    !!rentalStart && !!rentalEnd && endAfterStart && basePriceNum > 0 && !conflict,
    nameValid && idValid && emailValid && phoneValid,
    !sigEmpty && depositPaid,
  ][step]

  async function handleSave() {
    if (!car) return
    setSaving(true)
    setStatus('Generuji PDF…')
    try {
      const signature = sigRef.current?.toDataURL() ?? ''
      const year = new Date().getFullYear()
      const all = await listContracts()
      const countThisYear = all.filter((c) => new Date(c.createdAt).getFullYear() === year).length
      const number = contractNumber(countThisYear, year)
      const photos = collectPhotos()

      const pdfData: PdfData = {
        number, createdAt: Date.now(), carName: car.name, carType: car.type,
        price, deposit, depositPaid, antiradar, rentalStart, rentalEnd, customer, signature, photos,
      }
      const pdf = await generatePdfBlob(pdfData)

      setStatus('Ukládám…')
      const id = await createContract({
        number, carId, carName: car.name, carType: car.type,
        price, deposit, depositPaid, antiradar, rentalStart, rentalEnd, customer, signature, photos, pdf,
      })
      await upsertClient(customer)

      setStatus('Odesílám e-mail…')
      const sent = await sendContractEmail(pdf, {
        contractNumber: number,
        customerEmail: customer.email,
        customerName: `${customer.firstName} ${customer.lastName}`.trim(),
        carName: car.name,
        rentalStart,
        rentalEnd,
        price,
      })
      if (sent.ok && sent.mode === 'api') {
        await setEmailSentTo(id, sent.recipients)
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
              <button key={c.id} className={`car ${carId === c.id ? 'selected' : ''}`} onClick={() => selectCar(c.id)}>
                <span className="emoji">{c.type === 'dodavka' ? '🚐' : '🏎️'}</span>
                <span className="info">
                  <div className="name">{c.name}</div>
                  <div className="meta">kauce {fmtCZK(c.deposit)}</div>
                </span>
              </button>
            ))}
            </div>

          </div>
        )}

        {step === 1 && (
          <div>
            <div className="card">
              <h2>Foto vozidla (stav při předání)</h2>
              <div className="photo-grid">
                {carPhotos.map((b, i) => (
                  <PhotoInput key={i} kind="car" label="Foto vozidla" blob={b}
                    onCapture={(_, nb) => setCarPhotos((a) => a.map((x, j) => (j === i ? nb : x)))}
                    onRemove={() => setCarPhotos((a) => a.filter((_, j) => j !== i))} />
                ))}
                <AddCarPhoto onAdd={(b) => setCarPhotos((a) => [...a, b])} />
              </div>
              <p className="note" style={{ marginTop: 10 }}>Nepovinné, doporučené – přiloží se ke smlouvě jako důkaz stavu vozidla při předání.</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="card">
              <h2>Cena nájmu</h2>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Částka za nájem (Kč) *</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Kč"
                />
              </div>
            </div>

            <div className="card">
              <h2>Termín</h2>
              <DateTimeField label="Začátek nájmu" value={rentalStart} onChange={setRentalStart} />
              <DateTimeField label="Konec nájmu" value={rentalEnd} onChange={setRentalEnd} />
              {!endAfterStart && <div className="field-err" style={{ marginTop: -4 }}>Konec musí být po začátku.</div>}
            </div>

            {conflict && (
              <div className="banner err">
                ⚠ Toto auto je v daném termínu obsazené smlouvou č. {conflict.number}
                ({fmtDateTime(conflict.rentalStart)} – {fmtDateTime(conflict.rentalEnd)}, {conflict.customer.lastName}).
              </div>
            )}

            <div className="card">
              <h2>Doplňky</h2>
              <Switch checked={antiradar} onChange={toggleAntiradar} label="Půjčuje si antiradar" sub={`Přičte + ${fmtCZK(ANTIRADAR_PRICE)} do částky`} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="card">
              <h2>Foto dokladů</h2>
              <div className="photo-grid">
                {DOC_FIELDS.map((f) => (
                  <PhotoInput key={f.kind} kind={f.kind} label={f.label} blob={docPhotos[f.kind]}
                    onCapture={(k, b) => setDocPhotos((p) => ({ ...p, [k]: b }))}
                    onRemove={(k) => setDocPhotos((p) => { const n = { ...p }; delete n[k]; return n })} />
                ))}
              </div>
              <button
                type="button"
                className="btn ghost"
                style={{ marginTop: 12 }}
                disabled={ocrBusy || (!docPhotos.idFront && !docPhotos.licenseFront)}
                onClick={runOcr}
              >
                {ocrBusy ? <><span className="spin">⏳</span> Načítám z fotky…</> : '✨ Načíst údaje z fotky dokladu'}
              </button>
              {ocrMsg && <div className="note" style={{ marginTop: 8 }}>{ocrMsg}</div>}
              <p className="note" style={{ marginTop: 10 }}>Vyfoť občanku a klikni „Načíst z fotky" – doplní jméno, příjmení a rodné číslo (můžeš opravit). Foto se přiloží ke smlouvě.</p>
            </div>

            <div className="card">
              <h2>Nájemce</h2>
              <div className="field">
                <label>Jméno *</label>
                <input value={customer.firstName}
                  onChange={(e) => { upd({ firstName: e.target.value }); refreshSuggestions(e.target.value); setShowSuggest(true) }}
                  onFocus={() => customer.firstName.length >= 2 && setShowSuggest(true)}
                  autoComplete="off" />
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
                <label>Příjmení *</label>
                <input value={customer.lastName}
                  onChange={(e) => { upd({ lastName: e.target.value }); refreshSuggestions(e.target.value); setShowSuggest(true) }}
                  autoComplete="off" />
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

        {step === 4 && (
          <div>
            <div className="card">
              <h2>Rekapitulace</h2>
              <div className="summary-row"><span className="k">Vozidlo</span><span className="v">{car?.name}</span></div>
              <div className="summary-row"><span className="k">Nájemce</span><span className="v">{customer.firstName} {customer.lastName}</span></div>
              <div className="summary-row"><span className="k">Termín</span><span className="v">{fmtDateTime(rentalStart)} → {fmtDateTime(rentalEnd)}</span></div>
              <div className="summary-row"><span className="k">Nájem</span><span className="v">{fmtCZK(antiradar ? price - ANTIRADAR_PRICE : price)}</span></div>
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
          {saving
            ? <><span className="spin">⏳</span> {status}</>
            : step === STEPS.length - 1
              ? 'Vytvořit a odeslat'
              : step === 1 && carPhotos.length === 0
                ? 'Přeskočit'
                : 'Pokračovat'}
        </button>
        {step > 0 && <button className="btn ghost small" onClick={back} disabled={saving}>Zpět</button>}
      </div>
    </div>
  )
}

function AddCarPhoto({ onAdd }: { onAdd: (b: Blob) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  return (
    <>
      <input ref={ref} type="file" accept="image/*" capture="environment" hidden
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setBusy(true)
          onAdd(await compressPhoto(file, 'car'))
          setBusy(false)
        }} />
      <button type="button" className="photo-btn" onClick={() => ref.current?.click()} disabled={busy}>
        <span className="photo-icon">{busy ? '⏳' : '＋'}</span>
        <span>{busy ? 'Zpracovávám…' : 'Přidat fotku'}</span>
      </button>
    </>
  )
}
