import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../hooks/useSessao'

/**
 * Login com Google (M-001).
 *
 * Fluxo:
 *  1) O botão chama signInWithOAuth e o Google redireciona de volta para
 *     /encanto/entrar?code=...  (redirectTo aponta para esta MESMA rota).
 *  2) Ao voltar, o cliente Supabase (detectSessionInUrl + PKCE) troca o
 *     ?code por uma sessão. O useSessao percebe a sessão via
 *     onAuthStateChange e esta tela redireciona para a home (/).
 *
 * Por que /entrar e não /: a rota raiz é privada; se o Google voltasse para
 * "/", a guarda Privada mandaria para /entrar ANTES de a sessão ser trocada,
 * criando o loop. Voltando para /entrar (rota pública), a troca acontece em paz.
 */
export function Entrar() {
  const { sessao, carregando } = useSessao()

  // Limpa o ?code=... da barra de endereço depois que a sessão foi criada,
  // para a URL não ficar suja e um recarregamento não reprocessar o código.
  useEffect(() => {
    if (sessao && window.location.search.includes('code=')) {
      const limpa = window.location.origin + window.location.pathname
      window.history.replaceState({}, '', limpa)
    }
  }, [sessao])

  // Já logado (ou acabou de logar): entra no app.
  if (!carregando && sessao) return <Navigate to="/" replace />

  async function entrarComGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Volta para esta própria rota /entrar dentro da base /encanto/.
        redirectTo: window.location.origin + import.meta.env.BASE_URL + 'entrar'
      }
    })
    if (error) {
      console.error('[Cabideia Encanto] Falha ao iniciar login Google:', error.message)
      alert('Não consegui abrir o login do Google. Verifique a conexão e tente de novo.')
    }
  }

  return (
    <div className="tela">
      <div className="conteudo" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="vitrine-moldura">
          <div className="babado" />
          <div className="vitrine-corpo">
            <div className="logo-redonda" aria-hidden>✨</div>
            <div className="nome-negocio">Cabideia Encanto</div>
            <p className="apoio" style={{ marginTop: 6 }}>
              Vitrine, acervo e inspirações de quem trabalha por encomenda.
            </p>
          </div>
        </div>
        <p className="apoio" style={{ textAlign: 'center', margin: '10px 0 18px' }}>
          Seus trabalhos guardados na nuvem, organizados e prontos para encantar clientes.
        </p>
        <button className="cta" onClick={entrarComGoogle} disabled={carregando}>
          Entrar com Google
        </button>
      </div>
    </div>
  )
}
