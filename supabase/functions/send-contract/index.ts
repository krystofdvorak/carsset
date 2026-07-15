// Supabase Edge Function: e-maily přes Brevo.
//  kind = "contract" (výchozí): smlouva klientovi + ownerovi (z JWT) + info@carsset.cz
//  kind = "thankyou": poděkování + prosba o Google recenzi (jen klientovi, při vrácení auta)
//
// Nasazení:
//   supabase functions deploy send-contract
//   supabase secrets set BREVO_API_KEY=xkeysib-...
//   supabase secrets set MAIL_FROM="CarsSet <info@carsset.cz>"   (ověřený odesílatel v Brevo)
//   (volitelně) BREVO_LIST_ID, INFO_EMAIL, REVIEW_URL
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const REVIEW_URL_DEFAULT = 'https://g.page/r/CZlz7wPCQepcEBM/review'

const esc = (s: string) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const firstName = (full: string) => (full || '').trim().split(/\s+/)[0] || ''

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const apiKey = Deno.env.get('BREVO_API_KEY')
    const from = Deno.env.get('MAIL_FROM')
    const infoEmail = Deno.env.get('INFO_EMAIL') || 'info@carsset.cz'
    const listId = Deno.env.get('BREVO_LIST_ID')
    const reviewUrl = Deno.env.get('REVIEW_URL') || REVIEW_URL_DEFAULT
    if (!apiKey || !from) return json({ error: 'E-mail není nakonfigurován (BREVO_API_KEY / MAIL_FROM).' }, 501)

    const body = await req.json()
    const { kind, contractNumber, customerName, customerEmail, carName, rentalStart, rentalEnd, price, pdfBase64, filename } = body
    if (!customerEmail) return json({ error: 'Chybí e-mail klienta.' }, 400)

    const parseFrom = (f: string) => {
      const m = f.match(/^\s*(.*?)\s*<(.+)>\s*$/)
      return m ? { name: m[1] || 'CarsSet', email: m[2] } : { name: 'CarsSet', email: f.trim() }
    }
    const sender = parseFrom(from)

    const send = (to: { email: string }[], subject: string, htmlContent: string, attachment?: unknown) =>
      fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender, to, subject, htmlContent, ...(attachment ? { attachment } : {}) }),
      })

    // ---------- Poděkování + recenze (při vrácení auta) ----------
    if (kind === 'thankyou') {
      const html = `
        <p>Ahoj ${esc(firstName(customerName))},</p>
        <p>díky, že sis vybral <strong>CarsSet</strong>! 😊 Doufám, že sis jízdu užil a že bylo všechno podle tvých představ.</p>
        <p>Pokud jsi byl spokojený, budu moc rád, když mi necháš krátkou recenzi na Google. Zabere to jen minutku a každá recenze mi opravdu pomáhá posouvat CarsSet dál. 🙏</p>
        <p style="margin:18px 0">
          <a href="${reviewUrl}" style="background:#ef0001;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold;display:inline-block">⭐ Napsat recenzi na Google</a>
        </p>
        <p>Díky moc a budu se těšit zase příště! 🏎️</p>
        <p><strong>CarsSet</strong></p>`
      const r = await send([{ email: customerEmail }], 'Díky, že sis vybral CarsSet! 🏎️', html)
      if (!r.ok) return json({ error: 'Brevo odmítl odeslání.', detail: await r.text() }, 502)
      return json({ ok: true, recipients: [customerEmail] })
    }

    // ---------- Smlouva (výchozí) ----------
    if (!pdfBase64) return json({ error: 'Chybí PDF smlouvy.' }, 400)

    // owner = přihlášený uživatel (z JWT)
    let ownerEmail: string | undefined
    try {
      const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      })
      const { data } = await sb.auth.getUser()
      ownerEmail = data.user?.email ?? undefined
    } catch { /* pošleme aspoň klientovi + info */ }

    const attachment = [{ name: filename || `smlouva-${contractNumber}.pdf`, content: pdfBase64 }]
    const term = rentalStart && rentalEnd ? `${fmt(rentalStart)} – ${fmt(rentalEnd)}` : '—'
    const priceStr = typeof price === 'number' ? `${price.toLocaleString('cs-CZ')} Kč` : '—'

    const clientHtml = `
      <p>Ahoj ${esc(firstName(customerName))},</p>
      <p>díky, že sis půjčil auto u <strong>CarsSet</strong>! V příloze najdeš nájemní smlouvu č. <strong>${esc(contractNumber)}</strong>.</p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:2px 12px 2px 0;color:#666">Vozidlo</td><td><strong>${esc(carName || '')}</strong></td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#666">Termín</td><td>${esc(term)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#666">Cena</td><td>${esc(priceStr)}</td></tr>
      </table>
      <p>Auto prosím vrať ve sjednaném termínu, čisté a s plnou nádrží. Kdyby cokoliv, ozvi se na
      <a href="mailto:${infoEmail}">${infoEmail}</a> nebo na tel. +420 777 95 95 78.</p>
      <p>Šťastnou cestu! 🏎️<br/><strong>CarsSet</strong></p>`

    const internalHtml = `
      <p>Byla vytvořena nová nájemní smlouva.</p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:2px 12px 2px 0;color:#666">Smlouva</td><td><strong>č. ${esc(contractNumber)}</strong></td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#666">Klient</td><td>${esc(customerName || '')} &lt;${esc(customerEmail)}&gt;</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#666">Vozidlo</td><td>${esc(carName || '')}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#666">Termín</td><td>${esc(term)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#666">Cena</td><td>${esc(priceStr)}</td></tr>
      </table>
      <p>Smlouva je v příloze.</p>
      <p style="color:#999;font-size:12px">CarsSet – automatická kopie</p>`

    const internalTo = [ownerEmail, infoEmail].filter((e): e is string => !!e).map((email) => ({ email }))
    const results = await Promise.all([
      send([{ email: customerEmail }], `Smlouva o nájmu vozidla – CarsSet (č. ${contractNumber})`, clientHtml, attachment),
      internalTo.length ? send(internalTo, `Nová smlouva č. ${contractNumber} – ${customerName} / ${carName}`, internalHtml, attachment) : Promise.resolve(null),
    ])
    for (const r of results) if (r && !r.ok) return json({ error: 'Brevo odmítl odeslání.', detail: await r.text() }, 502)

    // klient do Brevo kontaktů (newsletter) – neblokující
    try {
      await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customerEmail,
          attributes: { FIRSTNAME: firstName(customerName), LASTNAME: (customerName || '').split(' ').slice(1).join(' ') },
          listIds: listId ? [Number(listId)] : undefined,
          updateEnabled: true,
        }),
      })
    } catch { /* kontakt není kritický */ }

    return json({ ok: true, recipients: [customerEmail, ...internalTo.map((t) => t.email)] })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function fmt(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
