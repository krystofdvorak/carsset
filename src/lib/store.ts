import { supabase, STORAGE_BUCKET } from './supabase'
import type {
  Contract,
  NewContractInput,
  Customer,
  Client,
  UserCar,
  StoredPhoto,
} from './types'

// ---------- mapování řádku DB -> Contract ----------
type Row = Record<string, unknown>
function mapRow(r: Row): Contract {
  return {
    id: r.id as string,
    number: r.number as string,
    createdAt: new Date(r.created_at as string).getTime(),
    carId: (r.car_id as string) ?? '',
    carName: r.car_name as string,
    carType: r.car_type as Contract['carType'],
    price: r.price as number,
    deposit: r.deposit as number,
    depositPaid: r.deposit_paid as boolean,
    antiradar: r.antiradar as boolean,
    rentalStart: r.rental_start as string,
    rentalEnd: r.rental_end as string,
    customer: r.customer as Customer,
    signature: (r.signature as string) ?? '',
    returned: r.returned as boolean,
    returnedAt: r.returned_at ? new Date(r.returned_at as string).getTime() : undefined,
    emailSentTo: (r.email_sent_to as string[]) ?? undefined,
    pdfPath: (r.pdf_path as string) ?? undefined,
    photos: (r.photos as StoredPhoto[]) ?? [],
  }
}

// ---------- OCR dokladů (Edge Function) ----------
export interface OcrResult {
  firstName: string | null
  lastName: string | null
  rodneCislo: string | null
  documentNumber: string | null
}
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}
export async function ocrDoklad(blob: Blob, docType: 'op' | 'rp'): Promise<OcrResult> {
  const image = await blobToDataUrl(blob)
  const { data, error } = await supabase.functions.invoke('ocr-doklad', {
    body: { image, docType },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data as OcrResult
}

// ---------- Auth ----------
export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}
export async function signOut() {
  await supabase.auth.signOut()
}
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}
export function onAuthChange(cb: (loggedIn: boolean) => void) {
  return supabase.auth.onAuthStateChange((_e, session) => cb(!!session))
}

// ---------- Smlouvy ----------
export async function listContracts(): Promise<Contract[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function getContract(id: string): Promise<Contract | null> {
  const { data, error } = await supabase.from('contracts').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? mapRow(data) : null
}

export async function createContract(input: NewContractInput): Promise<string> {
  const id = crypto.randomUUID()

  // 1) nahraj PDF
  const pdfPath = `${id}/smlouva.pdf`
  const up1 = await supabase.storage.from(STORAGE_BUCKET).upload(pdfPath, input.pdf, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (up1.error) throw up1.error

  // 2) nahraj fotky
  const photos: StoredPhoto[] = []
  for (let i = 0; i < input.photos.length; i++) {
    const p = input.photos[i]
    const path = `${id}/${p.kind}-${i}.jpg`
    const up = await supabase.storage.from(STORAGE_BUCKET).upload(path, p.blob, {
      contentType: 'image/jpeg',
      upsert: true,
    })
    if (up.error) throw up.error
    photos.push({ kind: p.kind, path })
  }

  // 3) vlož řádek
  const { error } = await supabase.from('contracts').insert({
    id,
    number: input.number,
    car_id: input.carId,
    car_name: input.carName,
    car_type: input.carType,
    price: input.price,
    deposit: input.deposit,
    deposit_paid: input.depositPaid,
    antiradar: input.antiradar,
    rental_start: input.rentalStart,
    rental_end: input.rentalEnd,
    customer: input.customer,
    signature: input.signature,
    returned: false,
    pdf_path: pdfPath,
    photos,
  })
  if (error) throw error
  return id
}

export async function markReturned(id: string, returned: boolean) {
  const { error } = await supabase
    .from('contracts')
    .update({ returned, returned_at: returned ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw error
}

export async function setEmailSentTo(id: string, recipients: string[]) {
  await supabase.from('contracts').update({ email_sent_to: recipients }).eq('id', id)
}

export async function deleteContract(c: Contract) {
  const paths = [...(c.pdfPath ? [c.pdfPath] : []), ...c.photos.map((p) => p.path)]
  if (paths.length) await supabase.storage.from(STORAGE_BUCKET).remove(paths)
  const { error } = await supabase.from('contracts').delete().eq('id', c.id)
  if (error) throw error
}

// ---------- Storage helpers ----------
export async function signedUrl(path: string, seconds = 3600): Promise<string | undefined> {
  const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, seconds)
  return data?.signedUrl
}
export async function downloadBlob(path: string): Promise<Blob | undefined> {
  const { data } = await supabase.storage.from(STORAGE_BUCKET).download(path)
  return data ?? undefined
}

// ---------- Překrytí termínů ----------
function overlaps(s1: string, e1: string, s2: string, e2: string): boolean {
  const a = new Date(s1).getTime(), b = new Date(e1).getTime()
  const c = new Date(s2).getTime(), d = new Date(e2).getTime()
  if ([a, b, c, d].some((x) => isNaN(x))) return false
  return a < d && c < b
}
export async function findConflict(
  carId: string,
  start: string,
  end: string,
  ignoreId?: string,
): Promise<Contract | null> {
  const { data, error } = await supabase.from('contracts').select('*').eq('car_id', carId)
  if (error) throw error
  for (const row of data ?? []) {
    const c = mapRow(row)
    if (c.id === ignoreId) continue
    if (overlaps(start, end, c.rentalStart, c.rentalEnd)) return c
  }
  return null
}

// ---------- Auta přidaná uživatelem ----------
export async function listUserCars(): Promise<UserCar[]> {
  const { data, error } = await supabase.from('cars').select('*').order('created_at')
  if (error) throw error
  return (data ?? []).map((r: Row) => ({
    id: r.id as string,
    name: r.name as string,
    type: r.type as UserCar['type'],
    prices: r.prices as UserCar['prices'],
    deposit: r.deposit as number,
    createdAt: new Date(r.created_at as string).getTime(),
  }))
}
export async function addUserCar(c: Omit<UserCar, 'createdAt'>) {
  const { error } = await supabase.from('cars').insert({
    id: c.id, name: c.name, type: c.type, prices: c.prices, deposit: c.deposit,
  })
  if (error) throw error
}
export async function deleteUserCar(id: string) {
  await supabase.from('cars').delete().eq('id', id)
}

// ---------- Klienti (našeptávání) ----------
export async function searchClients(q: string): Promise<Client[]> {
  const query = q.trim()
  if (query.length < 2) return []
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .or(`last_name.ilike.%${query}%,first_name.ilike.%${query}%,identifier.ilike.%${query}%`)
    .order('last_used', { ascending: false })
    .limit(6)
  if (error) return []
  return (data ?? []).map((r: Row) => ({
    identifier: r.identifier as string,
    firstName: (r.first_name as string) ?? '',
    lastName: (r.last_name as string) ?? '',
    email: (r.email as string) ?? '',
    phone: (r.phone as string) ?? '',
    lastUsed: new Date(r.last_used as string).getTime(),
    count: r.count as number,
  }))
}
export async function upsertClient(c: Customer) {
  if (!c.identifier.trim()) return
  const { data } = await supabase.from('clients').select('count').eq('identifier', c.identifier).maybeSingle()
  const count = ((data?.count as number) ?? 0) + 1
  await supabase.from('clients').upsert({
    identifier: c.identifier,
    first_name: c.firstName,
    last_name: c.lastName,
    email: c.email,
    phone: c.phone,
    last_used: new Date().toISOString(),
    count,
  })
}
