import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { AvisoOffline } from './components/AvisoOffline'
import { useSessao } from './hooks/useSessao'
import { useTema } from './hooks/useTema'
import { Entrar } from './pages/Entrar'
import { Home } from './pages/Home'
import { Acervo } from './pages/Acervo'
import { GuardarTrabalho } from './pages/GuardarTrabalho'
import { GuardarLotePedido } from './pages/GuardarLotePedido'
import { MinhasTags } from './pages/MinhasTags'
import { Acompanhar } from './pages/Acompanhar'
import { SelecaoPublica } from './pages/SelecaoPublica'
import { PropostaPublica } from './pages/PropostaPublica'
import { PedidoPublico } from './pages/PedidoPublico'
import { Vitrine } from './pages/Vitrine'
import { VitrinePublica } from './pages/VitrinePublica'
import { Pedidos } from './pages/Pedidos'
import { PedidoForm } from './pages/PedidoForm'
import { PedidoDetalhe } from './pages/PedidoDetalhe'
import { PedidoReferencias } from './pages/PedidoReferencias'
import { PropostaForm } from './pages/PropostaForm'
import { PropostaReferencias } from './pages/PropostaReferencias'
import { PropostaItens } from './pages/PropostaItens'
import { Clientes } from './pages/Clientes'
import { ClienteDetalhe } from './pages/ClienteDetalhe'
import { Inspiracoes } from './pages/Inspiracoes'
import { InspiracaoForm } from './pages/InspiracaoForm'
import { GuardarLoteInspiracao } from './pages/GuardarLoteInspiracao'
import { InspiracaoDetalhe } from './pages/InspiracaoDetalhe'
import { Calendario } from './pages/Calendario'
import { Cardapio } from './pages/Cardapio'
import { Anotacoes } from './pages/Anotacoes'
import { Planos } from './pages/Planos'
import { Config } from './pages/Config'
import { Perfil } from './pages/Perfil'
import { Privacidade } from './pages/Privacidade'
import { Termos } from './pages/Termos'
import { ExcluirConta } from './pages/ExcluirConta'

/** Aplica o tema da dona em todo o app (as páginas públicas pintam o seu). */
function AplicadorTema() {
  const { sessao } = useSessao()
  useTema(sessao?.user.id)
  return null
}

/** Rotas privadas exigem sessão; sem sessão, vão para /entrar. */
function Privada({ children }: { children: React.ReactNode }) {
  const { sessao, carregando } = useSessao()
  const { search } = useLocation()
  if (carregando) return null
  if (!sessao) {
    // Blindagem: se o OAuth voltar numa rota privada, leva o ?code=/?error=
    // junto para /entrar — que conclui a troca (ou mostra o erro) em vez de
    // descartar o retorno do Google no redirect.
    const params = new URLSearchParams(search)
    const oauth = new URLSearchParams()
    for (const chave of ['code', 'error', 'error_code', 'error_description']) {
      const valor = params.get(chave)
      if (valor) oauth.set(chave, valor)
    }
    const query = oauth.toString()
    return <Navigate to={query ? `/entrar?${query}` : '/entrar'} replace />
  }
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
        <AvisoOffline />
        <Routes>
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/" element={<Privada><Home /></Privada>} />
          <Route path="/acervo" element={<Privada><Acervo /></Privada>} />
          <Route path="/acervo/novo" element={<Privada><GuardarTrabalho /></Privada>} />
          <Route path="/tags" element={<Privada><MinhasTags /></Privada>} />
          <Route path="/acompanhar" element={<Privada><Acompanhar /></Privada>} />
          <Route path="/vitrine" element={<Privada><Vitrine /></Privada>} />
          <Route path="/perfil" element={<Privada><Perfil /></Privada>} />
          <Route path="/pedidos" element={<Privada><Pedidos /></Privada>} />
          <Route path="/pedidos/novo" element={<Privada><PedidoForm /></Privada>} />
          <Route path="/pedidos/:id" element={<Privada><PedidoDetalhe /></Privada>} />
          <Route path="/pedidos/:id/editar" element={<Privada><PedidoForm /></Privada>} />
          <Route path="/pedidos/:id/fotos" element={<Privada><GuardarLotePedido /></Privada>} />
          <Route path="/pedidos/:id/referencias" element={<Privada><PedidoReferencias /></Privada>} />
          <Route path="/clientes" element={<Privada><Clientes /></Privada>} />
          <Route path="/clientes/:id" element={<Privada><ClienteDetalhe /></Privada>} />
          <Route path="/clientes/:clienteId/propostas/nova" element={<Privada><PropostaForm /></Privada>} />
          <Route path="/propostas/:id" element={<Privada><PropostaForm /></Privada>} />
          <Route path="/propostas/:id/referencias" element={<Privada><PropostaReferencias /></Privada>} />
          <Route path="/propostas/:id/itens" element={<Privada><PropostaItens /></Privada>} />
          <Route path="/inspiracoes" element={<Privada><Inspiracoes /></Privada>} />
          <Route path="/inspiracoes/nova" element={<Privada><InspiracaoForm /></Privada>} />
          <Route path="/inspiracoes/lote" element={<Privada><GuardarLoteInspiracao /></Privada>} />
          <Route path="/inspiracoes/:id" element={<Privada><InspiracaoDetalhe /></Privada>} />
          <Route path="/inspiracoes/:id/editar" element={<Privada><InspiracaoForm /></Privada>} />
          <Route path="/calendario" element={<Privada><Calendario /></Privada>} />
          <Route path="/cardapio" element={<Privada><Cardapio /></Privada>} />
          <Route path="/anotacoes" element={<Privada><Anotacoes /></Privada>} />
          <Route path="/planos" element={<Privada><Planos /></Privada>} />
          <Route path="/config" element={<Privada><Config /></Privada>} />
          {/* Páginas legais públicas (sem login) — URLs exigidas pelo Google Play */}
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/termos" element={<Termos />} />
          <Route path="/excluir-conta" element={<ExcluirConta />} />
          {/* Página pública de uma seleção (sem login) */}
          <Route path="/s/:token" element={<SelecaoPublica />} />
          {/* M-042 F2b · Página pública de uma proposta (sem login) */}
          <Route path="/proposta/:token" element={<PropostaPublica />} />
          {/* M-047 · Página pública de um pedido (sem login) */}
          <Route path="/pedido/:token" element={<PedidoPublico />} />
          <Route path="/:arroba" element={<Coringa />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}
