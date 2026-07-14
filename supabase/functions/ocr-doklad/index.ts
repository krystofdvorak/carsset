// Supabase Edge Function: OCR českého OP / ŘP přes vision model (Mistral – EU/GDPR).
// Vstup:  { image: "data:image/jpeg;base64,...", docType: "op" | "rp" }
// Výstup: { firstName, lastName, rodneCislo, documentNumber } (neznámé = null)
//
// Nasazení:
//   supabase functions deploy ocr-doklad
//   supabase secrets set MISTRAL_API_KEY=xxxxx
// Volat smí jen přihlášený uživatel (Edge Function ověřuje JWT).

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { image, docType } = await req.json()
    if (!image) return json({ error: 'Chybí obrázek.' }, 400)

    const apiKey = Deno.env.get('MISTRAL_API_KEY')
    if (!apiKey) return json({ error: 'OCR není nakonfigurováno (MISTRAL_API_KEY).' }, 501)

    const isRp = docType === 'rp'
    const prompt = `Z fotografie ${isRp ? 'českého řidičského průkazu' : 'českého občanského průkazu'} vytěž údaje.
Vrať POUZE JSON s klíči:
- "firstName": jméno (křestní)
- "lastName": příjmení
- "rodneCislo": rodné číslo ve formátu s lomítkem (např. 900101/1234); pokud na dokladu není, dej null
- "documentNumber": číslo dokladu (${isRp ? 'číslo řidičského průkazu' : 'číslo občanského průkazu'})
Neznámé hodnoty dej null. Nepřidávej žádný jiný text.`

    const resp = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'pixtral-12b-2409',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: image },
            ],
          },
        ],
      }),
    })

    if (!resp.ok) return json({ error: 'Vision API selhalo.', detail: await resp.text() }, 502)
    const data = await resp.json()
    const content = data?.choices?.[0]?.message?.content ?? '{}'
    let fields: Record<string, unknown> = {}
    try {
      fields = JSON.parse(content)
    } catch {
      /* model vrátil něco jiného */
    }
    return json({
      firstName: str(fields.firstName),
      lastName: str(fields.lastName),
      rodneCislo: str(fields.rodneCislo),
      documentNumber: str(fields.documentNumber),
    })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
