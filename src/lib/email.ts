// Owner appky – sem chodí kopie každé smlouvy automaticky.
export const OWNER_EMAIL = 'dvorak@weblify.studio'

export interface SendResult {
  ok: boolean
  mode: 'api' | 'share' | 'download' | 'failed'
  recipients: string[]
  detail?: string
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buf)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/**
 * Odešle smlouvu e-mailem zákazníkovi + ownerovi.
 * 1) Zkusí serverless endpoint /api/send-contract (Resend) – reálné automatické odeslání.
 * 2) Když endpoint není (dev / bez klíče), fallback na systémové sdílení (Mail/WhatsApp).
 */
export async function sendContractEmail(
  pdf: Blob,
  opts: { contractNumber: string; customerEmail: string; customerName: string },
): Promise<SendResult> {
  const recipients = [opts.customerEmail, OWNER_EMAIL].filter((e) => !!e && e.includes('@'))
  const filename = `smlouva-${opts.contractNumber}.pdf`

  // 1) serverless odeslání
  try {
    const pdfBase64 = await blobToBase64(pdf)
    const res = await fetch('/api/send-contract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: recipients,
        owner: OWNER_EMAIL,
        contractNumber: opts.contractNumber,
        customerName: opts.customerName,
        filename,
        pdfBase64,
      }),
    })
    if (res.ok) return { ok: true, mode: 'api', recipients }
    // 404 = endpoint neexistuje (dev) → fallback
  } catch {
    // síť/endpoint nedostupný → fallback
  }

  // 2) fallback: systémové sdílení s přílohou PDF (jen na reálně dotykových zařízeních – mobil/tablet)
  const isTouch =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(pointer: coarse)').matches &&
    (navigator.maxTouchPoints ?? 0) > 0
  try {
    const file = new File([pdf], filename, { type: 'application/pdf' })
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean }
    if (isTouch && nav.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({
        files: [file],
        title: `Smlouva ${opts.contractNumber}`,
        text: `Nájemní smlouva Carsset č. ${opts.contractNumber} pro ${opts.customerName}. Odeslat na: ${recipients.join(', ')}`,
      })
      return { ok: true, mode: 'share', recipients }
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return { ok: false, mode: 'share', recipients, detail: 'zrušeno' }
  }

  // 3) poslední záchrana: stáhnout PDF
  try {
    const url = URL.createObjectURL(pdf)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    return { ok: true, mode: 'download', recipients }
  } catch {
    return { ok: false, mode: 'failed', recipients }
  }
}
