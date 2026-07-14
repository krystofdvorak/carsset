import { useState } from 'react'
import { signIn } from '../lib/store'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const { error } = await signIn(email.trim(), password)
    if (error) {
      setErr('Přihlášení se nezdařilo. Zkontroluj e-mail a heslo.')
      setBusy(false)
    }
    // při úspěchu přepne onAuthChange v App
  }

  return (
    <div className="app">
      <main className="content" style={{ display: 'grid', placeItems: 'center', minHeight: '80vh' }}>
        <form className="card" style={{ width: '100%', maxWidth: 380 }} onSubmit={submit}>
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Carsset" style={{ height: 26, display: 'block', margin: '4px auto 18px' }} />
          <h2 style={{ textAlign: 'center' }}>Přihlášení</h2>
          <div className="field">
            <label>E-mail</label>
            <input type="email" inputMode="email" autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="jmeno@firma.cz" />
          </div>
          <div className="field">
            <label>Heslo</label>
            <input type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {err && <div className="banner err" style={{ marginBottom: 12 }}>{err}</div>}
          <button className="btn primary" type="submit" disabled={busy || !email || !password}>
            {busy ? <span className="spin">⏳</span> : 'Přihlásit se'}
          </button>
        </form>
      </main>
    </div>
  )
}
