import { HashRouter, Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { NewContract } from './pages/NewContract'
import { ContractDetail } from './pages/ContractDetail'
import { AddCar } from './pages/AddCar'

export default function App() {
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
