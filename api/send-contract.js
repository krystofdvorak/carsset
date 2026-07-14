// Vercel serverless funkce – reálné automatické odeslání smlouvy e-mailem přes Resend.
//
// Nasazení:
//   1) V Resend (https://resend.com) vytvoř API klíč a ověř doménu odesílatele.
//   2) Ve Vercel projektu nastav env proměnné:
//        RESEND_API_KEY = re_xxx
//        MAIL_FROM      = "Carsset <smlouvy@tvoje-domena.cz>"   (musí být na ověřené doméně)
//        OWNER_EMAIL    = dvorak@weblify.studio                 (nepovinné, výchozí je toto)
//   3) Frontend volá POST /api/send-contract automaticky po vytvoření smlouvy.
//
// Bez těchto proměnných funkce vrátí 501 a appka spadne do fallbacku (systémové sdílení).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.MAIL_FROM
  const owner = process.env.OWNER_EMAIL || 'dvorak@weblify.studio'

  if (!apiKey || !from) {
    res.status(501).json({ error: 'E-mail není nakonfigurován (chybí RESEND_API_KEY / MAIL_FROM).' })
    return
  }

  try {
    const { to, contractNumber, customerName, filename, pdfBase64 } = req.body || {}
    const recipients = Array.from(new Set([...(to || []), owner])).filter((e) => e && e.includes('@'))
    if (!recipients.length || !pdfBase64) {
      res.status(400).json({ error: 'Chybí příjemci nebo PDF.' })
      return
    }

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: `Nájemní smlouva Carsset č. ${contractNumber}`,
        html: `<p>Dobrý den,</p>
               <p>v příloze zasíláme nájemní smlouvu č. <strong>${contractNumber}</strong>${
                 customerName ? ` pro <strong>${customerName}</strong>` : ''
               }.</p>
               <p>S pozdravem,<br/>Carsset – půjčovna aut Brno</p>`,
        attachments: [{ filename: filename || `smlouva-${contractNumber}.pdf`, content: pdfBase64 }],
      }),
    })

    if (!resp.ok) {
      const detail = await resp.text()
      res.status(502).json({ error: 'Resend odmítl odeslání.', detail })
      return
    }

    res.status(200).json({ ok: true, recipients })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
}
