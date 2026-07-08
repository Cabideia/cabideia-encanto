import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Icone } from '../components/Icone'
import { useSessao } from '../hooks/useSessao'
import { usePedidos, STATUS_INFO, PAGAMENTO_CURTO, tituloPedido, type StatusPedido } from '../hooks/usePedidos'
import { rotuloEntrega } from '../lib/datas'

const FILTROS: { chave: StatusPedido; rotulo: string }[] = [
  { chave: 'a_fazer', rotulo: 'A fazer' },
  { chave: 'em_producao', rotulo: 'Em produção' },
  { chave: 'entregue', rotulo: 'Entregue' },
  { chave: 'cancelado', rotulo: 'Cancelado' },
]

/** M-002 · Pedidos — lista leve com filtro por status.
 *  UX-006 · Filtro em multi-seleção: abre só com os ativos ("A fazer" +
 *  "Em produção") ligados; Entregue/Cancelado entram por toque. O padrão é
 *  fixo a cada abertura — sem persistência entre sessões. */
export function Pedidos() {
  const { sessao } = useSessao()
  const navegar = useNavigate()
  const { pedidos, carregando } = usePedidos(sessao?.user.id)

  const [statusLigados, setStatusLigados] = useState<Set<StatusPedido>>(
    () => new Set<StatusPedido>(['a_fazer', 'em_producao'])
  )

  function alternarStatus(s: StatusPedido) {
    setStatusLigados((prev) => {
      const novo = new Set(prev)
      if (novo.has(s)) novo.delete(s)
      else novo.add(s)
      return novo
    })
  }

  const filtrados = pedidos.filter((p) => statusLigados.has(p.status))

  if (carregando) return null

  return (
    <div className="tela">
      <BarraTopo titulo="Pedidos" />
      <div className="conteudo">
        <div className="filtros">
          {FILTROS.map((f) => {
            const ligado = statusLigados.has(f.chave)
            return (
              <button
                key={f.chave}
                className={`filtro${ligado ? ' ativo' : ''}`}
                onClick={() => alternarStatus(f.chave)}
                aria-pressed={ligado}
              >
                {ligado && <Icone nome="ok" size={13} strokeWidth={3} style={{ marginRight: 4 }} />}
                {f.rotulo}
              </button>
            )
          })}
        </div>

        {filtrados.length === 0 ? (
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="pedidos" size={44} /></div>
            <p>
              {pedidos.length === 0
                ? 'Anote um pedido em segundos: cliente, tema e data. Sem burocracia.'
                : statusLigados.size === 0
                  ? 'Nenhum status ligado — toque num filtro acima para ver seus pedidos.'
                  : 'Nenhum pedido com esses status.'}
            </p>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            {filtrados.map((p) => {
              const info = STATUS_INFO[p.status]
              return (
                <div
                  key={p.id}
                  className="card card-toque"
                  onClick={() => navegar(`/pedidos/${p.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navegar(`/pedidos/${p.id}`)}
                >
                  <div className="card-linha" style={{ alignItems: 'flex-start' }}>
                    <div className="card-info">
                      <div className="card-nome" style={{ whiteSpace: 'normal' }}>{tituloPedido(p)}</div>
                      <div className="apoio">
                        {p.cliente_nome ?? 'sem cliente'}
                        {p.data_entrega ? ` · ${rotuloEntrega(p.data_entrega)}` : ''}
                        {/* Indicador discreto de pagamento — só quando difere de "não pago" */}
                        {p.status_pagamento !== 'nao_pago' ? ` · ${PAGAMENTO_CURTO[p.status_pagamento]}` : ''}
                      </div>
                    </div>
                    <span className={`chip ${info.chip}`}>{info.rotulo}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="cta-area">
        <button className="cta" onClick={() => navegar('/pedidos/novo')}>
          <Icone nome="mais" /> Novo pedido
        </button>
      </div>
    </div>
  )
}
