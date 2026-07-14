import { supabase } from './supabase'

export interface SendResult {
  ok: boolean
  mode: 'api' | 'failed'
  recipients: string[]
  detail?: string
}

export interface SendOpts {
  contractNumber: string
  customerEmail: string
  customerName: string
  carName?: string
  rentalStart?: string
  rentalEnd?: string
  price?: number
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
 * Odešle smlouvu přes Supabase Edge Function `send-contract` (Brevo):
 * klientovi + ownerovi (z přihlášení) + info@carsset.cz.
 * Když backend/klíč není nakonfigurovaný, vrátí ok:false (smlouva je stejně uložená).
 */
export async function sendContractEmail(pdf: Blob, opts: SendOpts): Promise<SendResult> {
  try {
    const pdfBase64 = await blobToBase64(pdf)
    const { data, error } = await supabase.functions.invoke('send-contract', {
      body: {
        pdfBase64,
        filename: `smlouva-${opts.contractNumber}.pdf`,
        contractNumber: opts.contractNumber,
        customerName: opts.customerName,
        customerEmail: opts.customerEmail,
        carName: opts.carName,
        rentalStart: opts.rentalStart,
        rentalEnd: opts.rentalEnd,
        price: opts.price,
      },
    })
    if (error || data?.error) {
      return { ok: false, mode: 'failed', recipients: [], detail: data?.error ?? error?.message }
    }
    return { ok: true, mode: 'api', recipients: data?.recipients ?? [] }
  } catch (e) {
    return { ok: false, mode: 'failed', recipients: [], detail: (e as Error).message }
  }
}
