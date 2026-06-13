import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../hooks/useSessao'

/**
 * Login com Google (M-001) — versão com diagnóstico visível.
 * Mostra na tela o motivo técnico de qualquer falha, para depuração no celular.
 */
export function Entrar() {
  const { sessao } = useSessao()
  const [trocando, setTrocando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')

    // Captura erro vindo do próprio Google/Supabase no querystring, se houver.
    const erroUrl = params.get('error_description') || params.get('error')
    if (erroUrl) {
      setErro('Retorno do provedor: ' + erroUrl)
      return
    }

    if (!code) return

    setTrocando(true)
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) {
          // Mostra o motivo técnico COMPLETO na tela para diagnóstico.
          setErro('Falha na troca: ' + error.message + ' [' + (error.status ?? '?') + ']')
          console.error('[Cabideia Encanto] exchangeCodeForSession:', error)
        }
        const limpa = window.location.origin + window.location.pathname
        window.history.replaceState({}, '', limpa)
      })
      .catch((e) => {
        setErro('Exceção: ' + (e?.message || String(e)))
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
      setErro('Falha ao iniciar: ' + error.message)
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
        <button className="cta" onClick={entrarComGoogle} disabled={trocando}>
          {trocando ? 'Entrando…' : 'Entrar com Google'}
        </button>
        {erro && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 8,
              background: '#fff0f0',
              border: '1px solid #f5c2c2',
              color: '#b00020',
              fontSize: 13,
              wordBreak: 'break-word'
            }}
          >
            <strong>Diagnóstico:</strong>
            <br />
            {erro}
          </div>
        )}
      </div>
    </div>
  )
}
