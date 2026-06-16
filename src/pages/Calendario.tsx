import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { useSessao } from '../hooks/useSessao'
import { usePedidos, STATUS_INFO, tituloPedido } from '../hooks/usePedidos'
import { formatarDataLonga, isoDeData } from '../lib/datas'

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

/** M-006 · Calendário — visão mensal das entregas por data_entrega. */
export function Calendario() {
  const { sessao } = useSessao()
  const navegar = useNavigate()
  const { carregando, pedidosPorMes, pedidosPorDia } = usePedidos(sessao?.user.id)

  const hojeIso = isoDeData(new Date())
  // Mês de referência (dia 1) e dia selecionado (começa em hoje).
  const [ref, setRef] = useState(() => {
    const h = new Date()
    return new Date(h.getFullYear(), h.getMonth(), 1)
  })
  const [selecionado, setSelecionado] = useState<string>(hojeIso)

  const ano = ref.getFullYear()
  const mes = ref.getMonth() // 0–11

  // Contagem de entregas por dia do mês (para os marcadores na grade).
  const contagem = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of pedidosPorMes(ano, mes + 1)) {
      if (p.data_entrega) m.set(p.data_entrega, (m.get(p.data_entrega) ?? 0) + 1)
    }
    return m
  }, [pedidosPorMes, ano, mes])

  const doDia = pedidosPorDia(selecionado)

  // Estrutura da grade: brancos antes do dia 1 + dias do mês.
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay() // 0 = domingo
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const celulas: (number | null)[] = [
    ...Array<null>(primeiroDiaSemana).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ]

  const rotuloMes = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(ref)

  function irMes(delta: number) {
    setRef(new Date(ano, mes + delta, 1))
  }

  if (carregando) return null

  return (
    <div className="tela">
      <BarraTopo titulo="Calendário" />
      <div className="conteudo">
        {/* Navegação do mês */}
        <div className="cal-cabecalho">
          <button className="btn-icone" onClick={() => irMes(-1)} aria-label="Mês anterior">
            ‹
          </button>
          <div className="cal-mes">{rotuloMes}</div>
          <button className="btn-icone" onClick={() => irMes(1)} aria-label="Próximo mês">
            ›
          </button>
        </div>

        {/* Cabeçalho dos dias da semana */}
        <div className="cal-grade cal-semana">
          {SEMANA.map((d, i) => (
            <div key={i} className="cal-semana-dia">{d}</div>
          ))}
        </div>

        {/* Grade do mês */}
        <div className="cal-grade">
          {celulas.map((dia, i) => {
            if (dia === null) return <div key={`v${i}`} className="cal-dia vazia" />
            const iso = isoDeData(new Date(ano, mes, dia))
            const qtd = contagem.get(iso) ?? 0
            const classes = [
              'cal-dia',
              iso === hojeIso ? 'hoje' : '',
              iso === selecionado ? 'selecionado' : '',
              qtd > 0 ? 'tem' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button
                key={iso}
                className={classes}
                onClick={() => setSelecionado(iso)}
                aria-label={`Dia ${dia}${qtd > 0 ? `, ${qtd} entrega${qtd > 1 ? 's' : ''}` : ''}`}
              >
                <span className="cal-num">{dia}</span>
                {qtd > 0 && <span className="cal-marca">{qtd}</span>}
              </button>
            )
          })}
        </div>

        {/* Entregas do dia selecionado */}
        <div className="secao" style={{ marginTop: 22 }}>
          <span className="confeito" />
          <h2 style={{ textTransform: 'capitalize' }}>{formatarDataLonga(selecionado)}</h2>
        </div>

        {doDia.length === 0 ? (
          <p className="apoio">
            Nenhuma entrega neste dia.
          </p>
        ) : (
          <div style={{ marginTop: 4 }}>
            {doDia.map((p) => {
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
                      <div className="card-nome" style={{ whiteSpace: 'normal' }}>
                        {tituloPedido(p)}
                      </div>
                      <div className="apoio">{p.cliente_nome ?? 'sem cliente'}</div>
                    </div>
                    <span className={`chip ${info.chip}`}>{info.rotulo}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* CTA primário: novo pedido já com a data do dia selecionado */}
      <div className="cta-area">
        <button
          className="cta"
          onClick={() => navegar(`/pedidos/novo?data=${selecionado}`)}
        >
          ＋ Novo pedido nesta data
        </button>
      </div>
    </div>
  )
}
