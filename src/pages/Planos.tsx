import { useState } from 'react'
import { BarraTopo } from '../components/BarraTopo'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useAssinatura } from '../hooks/useAssinatura'

/**
 * M-011 · Planos (Grátis × Vitrine).
 * Sem trial: a conta nasce no Grátis (150 imagens). Fundadora e Vitrine = ilimitado.
 * A cobrança real (Play Billing) entra no M-018 — aqui o botão é só um stub.
 */
export function Planos() {
  const [periodo, setPeriodo] = useState<'anual' | 'mensal'>('anual')
  const avisar = useAviso()
  const { sessao } = useSessao()
  const { plano, fundadora, total, limite, ilimitado, emExcedente } =
    useAssinatura(sessao?.user.id)

  const pct = Math.min(100, Math.round((total / limite) * 100))
  const corBarra = emExcedente || pct >= 90 ? 'var(--caramelo)' : 'var(--framboesa)'

  return (
    <div className="tela">
      <BarraTopo titulo="Planos" />
      <div className="conteudo">
        {/* Selo Fundadora (quando aplicável) */}
        {fundadora && (
          <div
            className="selo-fundadora"
            style={{ display: 'inline-flex', textAlign: 'center', margin: '4px auto 0' }}
          >
            <Icone nome="estrela" size={15} /> Você é Fundadora — acervo e vitrine ilimitados
          </div>
        )}

        {/* Contador de uso X/150 */}
        <div className="contador-acervo" style={{ marginTop: 12 }}>
          {ilimitado ? (
            <div className="contador-texto">
              <span className="contador-num">{total}</span>
              <span className="contador-desc"> imagens · seu plano é sem limite</span>
            </div>
          ) : (
            <>
              <div className="contador-texto">
                <span className="contador-num">{total}</span>
                <span className="contador-desc"> de {limite} imagens do plano Grátis</span>
              </div>
              <div className="contador-barra">
                <div className="contador-progresso" style={{ width: `${pct}%`, background: corBarra }} />
              </div>
            </>
          )}
        </div>

        <div className="troca-periodo" role="tablist" style={{ marginTop: 12 }}>
          <button className={periodo === 'anual' ? 'ativo' : ''} onClick={() => setPeriodo('anual')}>
            Anual · 2 meses grátis
          </button>
          <button className={periodo === 'mensal' ? 'ativo' : ''} onClick={() => setPeriodo('mensal')}>
            Mensal
          </button>
        </div>

        {/* Plano Vitrine */}
        <div className="card" style={{ textAlign: 'center' }}>
          {plano === 'vitrine' && (
            <span className="selo-fundadora"><Icone nome="ok" size={14} strokeWidth={3} /> Seu plano atual</span>
          )}
          <div className="card-nome">Plano Vitrine</div>
          <div className="plano-preco">
            {periodo === 'anual' ? (
              <>R$ 119<small>/ano</small></>
            ) : (
              <>R$ 14,90<small>/mês</small></>
            )}
          </div>
          <div style={{ textAlign: 'left', marginTop: 8 }}>
            <div className="beneficio"><span className="ok"><Icone nome="ok" size={16} strokeWidth={3} /></span>Imagens sem limite na nuvem (trabalhos, inspirações e referências)</div>
            <div className="beneficio"><span className="ok"><Icone nome="ok" size={16} strokeWidth={3} /></span>Vitrine sem corte: mostre todas as fotos que quiser</div>
            <div className="beneficio"><span className="ok"><Icone nome="ok" size={16} strokeWidth={3} /></span>Curadoria livre da vitrine, mesmo com muitas fotos</div>
          </div>
        </div>

        {/* Plano Grátis */}
        <div className="card" style={{ textAlign: 'center' }}>
          {plano !== 'vitrine' && !fundadora && (
            <span className="selo-fundadora" style={{ background: 'var(--neutro-suave)', color: 'var(--cacau)' }}>
              <Icone nome="ok" size={14} strokeWidth={3} /> Seu plano atual
            </span>
          )}
          <div className="card-nome">Grátis</div>
          <div className="plano-preco">R$ 0</div>
          <div style={{ textAlign: 'left', marginTop: 8 }}>
            <div className="beneficio"><span className="ok"><Icone nome="ok" size={16} strokeWidth={3} /></span>Até 150 imagens na nuvem</div>
            <div className="beneficio"><span className="ok"><Icone nome="ok" size={16} strokeWidth={3} /></span>Vitrine com selo "feito com Cabideia Encanto"</div>
            <div className="beneficio"><span className="ok"><Icone nome="ok" size={16} strokeWidth={3} /></span>Pedidos, clientes e anotações sem limite</div>
          </div>
        </div>

        <p className="apoio" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.5 }}>
          <Icone nome="cadeado" size={16} style={{ flex: 'none', marginTop: 2 }} />
          <span>
            Quando a quantidade de imagens exceder o plano escolhido, a vitrine pública
            mostra as mais recentes, dentro do limite. Mas você continuará tendo acesso
            a todas as suas imagens salvas.
          </span>
        </p>
      </div>
      <div className="cta-area">
        <button
          className="cta"
          onClick={() => avisar('Assinatura em breve — a cobrança pelo Google Play chega já já')}
        >
          {plano === 'vitrine' ? 'Plano Vitrine ativo' : 'Assinar o Plano Vitrine · Em breve'}
        </button>
      </div>
    </div>
  )
}
