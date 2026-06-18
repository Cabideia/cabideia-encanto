import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { useSessao } from './hooks/useSessao'
import { useTema } from './hooks/useTema'
import { Entrar } from './pages/Entrar'
import { Home } from './pages/Home'
import { Acervo } from './pages/Acervo'
import { GuardarTrabalho } from './pages/GuardarTrabalho'
import { MinhasTags } from './pages/MinhasTags'
import { MinhasSelecoes } from './pages/MinhasSelecoes'
import { SelecaoPublica } from './pages/SelecaoPublica'
import { Vitrine } from './pages/Vitrine'
import { VitrinePublica } from './pages/VitrinePublica'
import { Pedidos } from './pages/Pedidos'
import { PedidoForm } from './pages/PedidoForm'
import { PedidoDetalhe } from './pages/PedidoDetalhe'
import { PropostaForm } from './pages/PropostaForm'
import { Clientes } from './pages/Clientes'
import { ClienteDetalhe } from './pages/ClienteDetalhe'
import { Inspiracoes } from './pages/Inspiracoes'
import { InspiracaoForm } from './pages/InspiracaoForm'
import { InspiracaoDetalhe } from './pages/InspiracaoDetalhe'
import { Calendario } from './pages/Calendario'
import { Cardapio } from './pages/Cardapio'
import { Anotacoes } from './pages/Anotacoes'
import { Planos } from './pages/Planos'
import { Config } from './pages/Config'
import { Perfil } from './pages/Perfil'

/** Aplica o tema da dona em todo o app (as páginas públicas pintam o seu). */
function AplicadorTema() {
  const { sessao } = useSessao()
  useTema(sessao?.user.id)
  return null
}

/** Rotas privadas exigem sessão; sem sessão, vão para /entrar. */
function Privada({ children }: { children: React.ReactNode }) {
  const { sessao, carregando } = useSessao()
  if (carregando) return null
  if (!sessao) return <Navigate to="/entrar" replace />
  return <>{children}</>
}

/**
 * Rota coringa: /@usuaria abre a vitrine pública (sem login).
 * Qualquer outro caminho desconhecido volta para a home.
 */
function Coringa() {
  const { arroba } = useParams()
  if (arroba?.startsWith('@')) return <VitrinePublica />
  return <Navigate to="/" replace />
}

export function App() {
  return (
    // basename '/encanto': o app vive em cabideia.com.br/encanto/ (Decisão #5)
    <BrowserRouter basename="/encanto">
      <ToastProvider>
        <AplicadorTema />
        <Routes>
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/" element={<Privada><Home /></Privada>} />
          <Route path="/acervo" element={<Privada><Acervo /></Privada>} />
          <Route path="/acervo/novo" element={<Privada><GuardarTrabalho /></Privada>} />
          <Route path="/tags" element={<Privada><MinhasTags /></Privada>} />
          <Route path="/selecoes" element={<Privada><MinhasSelecoes /></Privada>} />
          <Route path="/vitrine" element={<Privada><Vitrine /></Privada>} />
          <Route path="/perfil" element={<Privada><Perfil /></Privada>} />
          <Route path="/pedidos" element={<Privada><Pedidos /></Privada>} />
          <Route path="/pedidos/novo" element={<Privada><PedidoForm /></Privada>} />
          <Route path="/pedidos/:id" element={<Privada><PedidoDetalhe /></Privada>} />
          <Route path="/pedidos/:id/editar" element={<Privada><PedidoForm /></Privada>} />
          <Route path="/clientes" element={<Privada><Clientes /></Privada>} />
          <Route path="/clientes/:id" element={<Privada><ClienteDetalhe /></Privada>} />
          <Route path="/clientes/:clienteId/propostas/nova" element={<Privada><PropostaForm /></Privada>} />
          <Route path="/propostas/:id" element={<Privada><PropostaForm /></Privada>} />
          <Route path="/inspiracoes" element={<Privada><Inspiracoes /></Privada>} />
          <Route path="/inspiracoes/nova" element={<Privada><InspiracaoForm /></Privada>} />
          <Route path="/inspiracoes/:id" element={<Privada><InspiracaoDetalhe /></Privada>} />
          <Route path="/inspiracoes/:id/editar" element={<Privada><InspiracaoForm /></Privada>} />
          <Route path="/calendario" element={<Privada><Calendario /></Privada>} />
          <Route path="/cardapio" element={<Privada><Cardapio /></Privada>} />
          <Route path="/anotacoes" element={<Privada><Anotacoes /></Privada>} />
          <Route path="/planos" element={<Privada><Planos /></Privada>} />
          <Route path="/config" element={<Privada><Config /></Privada>} />
          {/* Página pública de uma seleção (sem login) */}
          <Route path="/s/:token" element={<SelecaoPublica />} />
          <Route path="/:arroba" element={<Coringa />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}
