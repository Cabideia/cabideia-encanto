import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles/tokens.css'
import { aplicarTema, temaSalvo } from './lib/tema'

// Pinta a tela já no boot com o último tema conhecido (offline-first, M-023),
// antes do primeiro render — evita "piscar" do tema padrão.
aplicarTema(temaSalvo(), false)

ReactDOM.createRoot(document.getElementById('raiz')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
