import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { NewContract } from './pages/NewContract'
import { ContractDetail } from './pages/ContractDetail'
import { AddCar } from './pages/AddCar'
import { Login } from './pages/Login'
import { getSession, onAuthChange } from './lib/store'

export default function App() {
  const [authed, setAuthed] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    getSession().then((s) => setAuthed(!!s))
    const { data } = onAuthChange((loggedIn) => setAuthed(loggedIn))
    return () => data.subscription.unsubscribe()
  }, [])

  if (authed === undefined) {
    return <div className="app"><div className="empty"><span className="spin big">⏳</span></div></div>
  }
  if (!authed) return <Login />

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/nova" element={<NewContract />} />
        <Route path="/smlouva/:id" element={<ContractDetail />} />
        <Route path="/auta" element={<AddCar />} />
      </Routes>
    </HashRouter>
  )
}
