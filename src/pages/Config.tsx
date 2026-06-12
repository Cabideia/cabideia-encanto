import { Link } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { supabase } from '../lib/supabase'

export function Config() {
  return (
    <div className="tela">
      <BarraTopo titulo="Configurações" />
      <div className="conteudo">
        <div className="lista card" style={{ padding: '4px 16px' }}>
          <Link to="/planos" className="item" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div className="bola">🎀</div>
            <div className="card-info">
              <div className="card-nome" style={{ fontSize: 'var(--t-base)' }}>Meu plano</div>
              <div className="apoio">Grátis · teste do Plano Vitrine disponível</div>
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
      </div>
    </div>
  )
}
