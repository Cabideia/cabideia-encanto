import { Link } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { supabase } from '../lib/supabase'
import { useSessao } from '../hooks/useSessao'
import { useAssinatura } from '../hooks/useAssinatura'

export function Config() {
  const { sessao } = useSessao()
  const { plano, fundadora, total, limite, ilimitado } = useAssinatura(sessao?.user.id)

  const resumoPlano = fundadora
    ? 'Fundadora · imagens sem limite ✨'
    : plano === 'vitrine'
      ? 'Plano Vitrine · imagens sem limite ✨'
      : `Grátis · ${total}/${limite} imagens`

  return (
    <div className="tela">
      <BarraTopo titulo="Configurações" />
      <div className="conteudo">
        <div className="lista card" style={{ padding: '4px 16px' }}>
          <Link to="/planos" className="item" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div className="bola">🎀</div>
            <div className="card-info">
              <div className="card-nome" style={{ fontSize: 'var(--t-base)' }}>Meu plano</div>
              <div className="apoio">{resumoPlano}</div>
            </div>
            <span aria-hidden>›</span>
          </Link>
          <div className="item" onClick={() => supabase.auth.signOut()} role="button" tabIndex={0}>
            <div className="bola">👋</div>
            <div className="card-info">
              <div className="card-nome" style={{ fontSize: 'var(--t-base)' }}>Sair</div>
              <div className="apoio">Suas fotos continuam guardadas na nuvem</div>
            </div>
          </div>
        </div>

        {!ilimitado && (
          <p className="apoio" style={{ textAlign: 'center', marginTop: 14 }}>
            Plano Grátis: até {limite} imagens (trabalhos, inspirações e referências).
          </p>
        )}
      </div>
    </div>
  )
}
