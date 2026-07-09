import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../hooks/useSessao'
import { Icone } from '../components/Icone'
import { VersaoApp } from '../components/VersaoApp'

/**
 * Login com Google (M-001).
 *
 * Fluxo (PKCE, troca manual e controlada):
 *  1) O botão chama signInWithOAuth; o Google volta para /encanto/entrar?code=...
 *  2) Ao montar, esta página troca o ?code= por uma sessão
 *     (exchangeCodeForSession), esperando concluir antes de decidir a rota.
 *  3) Com a sessão criada, redireciona para a home (/).
 *
 * Volta para /entrar (rota pública) e não para "/" (privada) de propósito:
 * a guarda Privada mandaria para /entrar antes da troca, recriando o loop.
 */
export function Entrar() {
  const { sessao } = useSessao()
  const [trocando, setTrocando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const erroOAuth = params.get('error')

    // Provedor recusou/cancelou o login (?error=...): mostra mensagem amigável
    // e limpa a query da barra — sem ?code= não há troca a fazer.
    if (erroOAuth) {
      console.error(
        '[Cabideia Encanto] Login recusado pelo provedor:',
        erroOAuth,
        params.get('error_description') ?? ''
      )
      setErro(
        erroOAuth === 'access_denied'
          ? 'Login cancelado. Quando quiser, é só tentar de novo.'
          : 'Não consegui concluir o login. Tente novamente.'
      )
      window.history.replaceState({}, '', window.location.origin + window.location.pathname)
      return
    }

    if (!code) return

    setTrocando(true)
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) {
          console.error('[Cabideia Encanto] Falha ao trocar code por sessão:', error.message)
          setErro('Não consegui concluir o login. Tente novamente.')
        }
        // Limpa o ?code= da barra (uso único; evita reprocessar).
        const limpa = window.location.origin + window.location.pathname
        window.history.replaceState({}, '', limpa)
      })
      .finally(() => setTrocando(false))
  }, [])

  if (sessao) return <Navigate to="/" replace />

  async function entrarComGoogle() {
    setErro(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + import.meta.env.BASE_URL + 'entrar'
      }
    })
    if (error) {
      console.error('[Cabideia Encanto] Falha ao iniciar login Google:', error.message)
      setErro('Não consegui abrir o login do Google. Verifique a conexão e tente de novo.')
    }
  }

  return (
    <div className="tela">
      <div className="conteudo" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="vitrine-moldura">
          <div className="babado" />
          <div className="vitrine-corpo">
            <div className="logo-redonda" aria-hidden><Icone nome="brilho" size={26} /></div>
            <div className="nome-negocio">Cabideia Encanto</div>
            <p className="apoio" style={{ marginTop: 6 }}>
              Vitrine, Meus Trabalhos e inspirações de quem trabalha por encomenda.
            </p>
          </div>
        </div>
        <p className="apoio" style={{ textAlign: 'center', margin: '10px 0 18px' }}>
          Seus trabalhos guardados na nuvem, organizados e prontos para encantar clientes.
        </p>
        <button className="cta" onClick={entrarComGoogle} disabled={trocando}>
          {trocando ? 'Entrando…' : 'Entrar com Google'}
        </button>
        {erro && (
          <p className="apoio" style={{ textAlign: 'center', marginTop: 12, color: '#b00020' }}>
            {erro}
          </p>
        )}
        <p className="legal-consentimento">
          Ao entrar, você concorda com os <Link to="/termos">Termos de Uso</Link> e a{' '}
          <Link to="/privacidade">Política de Privacidade</Link>.
        </p>
        {/* Versão pública — dá para conferir o deploy sem nem entrar (item 4). */}
        <VersaoApp />
      </div>
    </div>
  )
}
