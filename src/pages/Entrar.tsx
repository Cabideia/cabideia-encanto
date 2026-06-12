import { supabase } from '../lib/supabase'

/** Login com Google (M-001). O redirect volta para a própria rota /encanto/. */
export function Entrar() {
  async function entrarComGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL }
    })
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
        <button className="cta" onClick={entrarComGoogle}>
          Entrar com Google
        </button>
      </div>
    </div>
  )
}
