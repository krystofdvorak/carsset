export function isValidEmail(email: string): boolean {
  const e = email.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)
}

/** Telefon: 9–15 číslic, volitelně s + a mezerami/pomlčkami. */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 9 && digits.length <= 15
}

/** Identifikátor (RČ / číslo OP): min. 6 znaků, obsahuje číslici. */
export function isValidIdentifier(id: string): boolean {
  const s = id.trim()
  return s.length >= 6 && /\d/.test(s)
}
