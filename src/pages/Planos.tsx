import { useState } from 'react'
import { BarraTopo } from '../components/BarraTopo'
import { useAviso } from '../components/Toast'

/**
 * M-011 + M-018: paywall do dia 1 (Decisões #3 e #11).
 * Trilho: Play Billing via Digital Goods API (TWA). A integração entra no M-018;
 * o esqueleto já apresenta o modelo Grátis × Plano Vitrine com trial de 30 dias.
 */
export function Planos() {
  const [periodo, setPeriodo] = useState<'anual' | 'mensal'>('anual')
  const avisar = useAviso()

  return (
    <div className="tela">
      <BarraTopo titulo="Planos" />
      <div className="conteudo">
        <p className="apoio" style={{ textAlign: 'center', marginTop: 4 }}>
          Experimente o Plano Vitrine grátis por 30 dias.
        </p>

        <div className="troca-periodo" role="tablist">
          <button className={periodo === 'anual' ? 'ativo' : ''} onClick={() => setPeriodo('anual')}>
            Anual · 2 meses grátis
          </button>
          <button className={periodo === 'mensal' ? 'ativo' : ''} onClick={() => setPeriodo('mensal')}>
            Mensal
          </button>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <span className="selo-fundadora">⭐ Oferta Fundadora — primeiras 30</span>
          <div className="card-nome">Plano Vitrine</div>
          <div className="plano-preco">
            {periodo === 'anual' ? (
              <>R$ 119<small>/ano</small></>
            ) : (
              <>R$ 14,90<small>/mês</small></>
            )}
          </div>
          <div style={{ textAlign: 'left', marginTop: 8 }}>
            <div className="beneficio"><span className="ok">✓</span>Meus Trabalhos sem limite na nuvem (5.000+ fotos)</div>
            <div className="beneficio"><span className="ok">✓</span>Vitrine com a SUA logo e link personalizado</div>
            <div className="beneficio"><span className="ok">✓</span>Exportações com a sua marca</div>
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <div className="card-nome">Grátis</div>
          <div className="plano-preco">R$ 0</div>
          <div style={{ textAlign: 'left', marginTop: 8 }}>
            <div className="beneficio"><span className="ok">✓</span>Até 150 fotos na nuvem</div>
            <div className="beneficio"><span className="ok">✓</span>Vitrine com selo "feito com Cabideia Encanto"</div>
            <div className="beneficio"><span className="ok">✓</span>Pedidos, clientes e anotações sem limite</div>
          </div>
        </div>

        <p className="apoio" style={{ textAlign: 'center' }}>
          🔒 Suas fotos nunca ficam presas: mesmo sem plano, você continua vendo e baixando tudo.
        </p>
      </div>
      <div className="cta-area">
        <button className="cta" onClick={() => avisar('Pagamento pelo Google Play entra no M-018')}>
          Assinar o Plano Vitrine
        </button>
      </div>
    </div>
  )
}
