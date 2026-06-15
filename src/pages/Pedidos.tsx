import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { useSessao } from '../hooks/useSessao'
import { usePedidos, STATUS_INFO, tituloPedido, type StatusPedido } from '../hooks/usePedidos'
import { rotuloEntrega } from '../lib/datas'

type Filtro = 'todos' | StatusPedido

const FILTROS: { chave: Filtro; rotulo: string }[] = [
  { chave: 'todos', rotulo: 'Todos' },
  { chave: 'a_fazer', rotulo: 'A fazer' },
  { chave: 'em_producao', rotulo: 'Em produção' },
  { chave: 'entregue', rotulo: 'Entregue' },
  { chave: 'cancelado', rotulo: 'Cancelado' },
]

/** M-002 · Pedidos — lista leve com filtro por status. */
export function Pedidos() {
  const { sessao } = useSessao()
  const navegar = useNavigate()
  const { pedidos, carregando } = usePedidos(sessao?.user.id)

  const [filtro, setFiltro] = useState<Filtro>('todos')

  const filtrados = pedidos.filter((p) => filtro === 'todos' || p.status === filtro)

  if (carregando) return null

  return (
    <div className="tela">
      <BarraTopo titulo="Pedidos" />
      <div className="conteudo">
        <div className="filtros">
          {FILTROS.map((f) => (
            <button
              key={f.chave}
              className={`filtro${filtro === f.chave ? ' ativo' : ''}`}
              onClick={() => setFiltro(f.chave)}
            >
              {f.rotulo}
            </button>
          ))}
        </div>

        {filtrados.length === 0 ? (
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone">🧁</div>
            <p>
              {filtro === 'todos'
                ? 'Anote um pedido em segundos: cliente, tema e data. Sem burocracia.'
                : 'Nenhum pedido com esse status.'}
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
          ＋ Novo pedido
        </button>
      </div>
    </div>
  )
}
