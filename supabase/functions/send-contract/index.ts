// Supabase Edge Function: odeslání nájemní smlouvy e-mailem přes Brevo.
// - klientovi (klientský wording)
// - ownerovi (e-mail z přihlášení, čte se z JWT) + vždy na info@carsset.cz (interní wording)
// - klientův e-mail přidá do Brevo kontaktů (newsletter)
//
// Nasazení:
//   supabase functions deploy send-contract
//   supabase secrets set BREVO_API_KEY=xkeysib-...
//   supabase secrets set MAIL_FROM="Carsset <info@carsset.cz>"   (ověřený odesílatel v Brevo)
//   (volitelně) supabase secrets set BREVO_LIST_ID=2   INFO_EMAIL=info@carsset.cz
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const esc = (s: string) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const apiKey = Deno.env.get('BREVO_API_KEY')
    const from = Deno.env.get('MAIL_FROM') // "Carsset <info@carsset.cz>"
    const infoEmail = Deno.env.get('INFO_EMAIL') || 'info@carsset.cz'
    const listId = Deno.env.get('BREVO_LIST_ID')
    if (!apiKey || !from) return json({ error: 'E-mail není nakonfigurován (BREVO_API_KEY / MAIL_FROM).' }, 501)

    const body = await req.json()
    const {
      pdfBase64, filename, contractNumber, customerName, customerEmail,
      carName, rentalStart, rentalEnd, price,
    } = body
    if (!pdfBase64 || !customerEmail) return json({ error: 'Chybí PDF nebo e-mail klienta.' }, 400)

    // owner = přihlášený uživatel (z JWT)
    let ownerEmail: string | undefined
    try {
      const sb = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
      )
      const { data } = await sb.auth.getUser()
      ownerEmail = data.user?.email ?? undefined
    } catch { /* bez ownera pošleme aspoň klientovi + info */ }

    const parseFrom = (f: string) => {
      const m = f.match(/^\s*(.*?)\s*<(.+)>\s*$/)
      return m ? { name: m[1] || 'Carsset', email: m[2] } : { name: 'Carsset', email: f.trim() }
    }
    const sender = parseFrom(from)
    const attachment = [{ name: filename || `smlouva-${contractNumber}.pdf`, content: pdfBase64 }]

    const term = rentalStart && rentalEnd ? `${fmt(rentalStart)} – ${fmt(rentalEnd)}` : '—'
    const priceStr = typeof price === 'number' ? `${price.toLocaleString('cs-CZ')} Kč` : '—'

    // 1) klientský e-mail
    const clientHtml = `
      <p>Dobrý den ${esc(customerName || '')},</p>
      <p>děkujeme, že jste využil/a služeb půjčovny <strong>Carsset</strong>. V příloze zasíláme
      nájemní smlouvu č. <strong>${esc(contractNumber)}</strong>.</p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:2px 12px 2px 0;color:#666">Vozidlo</td><td><strong>${esc(carName || '')}</strong></td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#666">Termín</td><td>${esc(term)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#666">Cena</td><td>${esc(priceStr)}</td></tr>
      </table>
      <p>Vozidlo prosím vraťte ve sjednaném termínu, čisté a s plnou nádrží.
      V případě dotazů nás kontaktujte na <a href="mailto:${infoEmail}">${infoEmail}</a> nebo na tel. +420 777 95 95 78.</p>
      <p>Přejeme šťastnou cestu!<br/><strong>Carsset – půjčovna aut Brno</strong></p>`

    // 2) interní e-mail (owner + info)
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
      <p style="color:#999;font-size:12px">Carsset – automatická kopie</p>`

    const send = (to: { email: string }[], subject: string, htmlContent: string) =>
      fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender, to, subject, htmlContent, attachment }),
      })

    const internalTo = [ownerEmail, infoEmail].filter((e): e is string => !!e).map((email) => ({ email }))
    const results = await Promise.all([
      send([{ email: customerEmail }], `Smlouva o nájmu vozidla – Carsset (č. ${contractNumber})`, clientHtml),
      internalTo.length ? send(internalTo, `Nová smlouva č. ${contractNumber} – ${customerName} / ${carName}`, internalHtml) : Promise.resolve(null),
    ])
    for (const r of results) {
      if (r && !r.ok) return json({ error: 'Brevo odmítl odeslání.', detail: await r.text() }, 502)
    }

    // 3) klient do Brevo kontaktů (newsletter) – neblokující
    try {
      await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customerEmail,
          attributes: { FIRSTNAME: (customerName || '').split(' ')[0], LASTNAME: (customerName || '').split(' ').slice(1).join(' ') },
          listIds: listId ? [Number(listId)] : undefined,
          updateEnabled: true,
        }),
      })
    } catch { /* kontakt není kritický */ }

    const recipients = [customerEmail, ...internalTo.map((t) => t.email)]
    return json({ ok: true, recipients })
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
