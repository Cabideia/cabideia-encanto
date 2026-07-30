import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icone } from './Icone'
import { TelaCarregando } from './TelaCarregando'
import { useAviso } from './Toast'
import { useSessao } from '../hooks/useSessao'
import { useClientes, type CamposCliente } from '../hooks/useClientes'
import { usePedidos } from '../hooks/usePedidos'
import { usePropostas } from '../hooks/usePropostas'
import { dataLocal, formatarMes } from '../lib/datas'

/**
 * UX-022 (Decisão #57, mockup 2c) · Bottom sheet "Nova proposta — pra quem?".
 *
 * Substitui o desvio antigo do FAB (＋ Nova proposta → /clientes → tocar a
 * cliente → ClienteDetalhe → botão "Nova proposta" → PropostaForm) por UM
 * toque: busca + lista com contexto (propostas abertas / último pedido) +
 * "+ Criar cliente nova" inline. A rota final é a mesma de sempre
 * (`/clientes/:clienteId/propostas/nova`) — só a NAVEGAÇÃO até ela encurta;
 * PropostaForm não muda.
 *
 * Escopo desta rodada: só o fluxo de proposta (o mockup 2c só cobre esse). O
 * "Novo pedido" já não tinha o desvio — o PedidoForm sempre teve seleção de
 * cliente inline (dropdown + "+ Novo cliente").
 */
export function SeletorClienteProposta({ aoFechar }: { aoFechar: () => void }) {
  const navegar = useNavigate()
  const avisar = useAviso()
  const { sessao } = useSessao()
  const { clientes, carregando: carregandoClientes, criar: criarCliente, salvando: salvandoCliente } =
    useClientes(sessao?.user.id)
  const { pedidos, carregando: carregandoPedidos } = usePedidos(sessao?.user.id)
  const { propostas, carregando: carregandoPropostas } = usePropostas(sessao?.user.id)

  const [busca, setBusca] = useState('')
  const [novoAberto, setNovoAberto] = useState(false)
  const [novoCliente, setNovoCliente] = useState<CamposCliente>({ nome: '', whatsapp: '', nota: '' })

  const carregando = carregandoClientes || carregandoPedidos || carregandoPropostas

  function irParaProposta(clienteId: string) {
    aoFechar()
    navegar(`/clientes/${clienteId}/propostas/nova`)
  }

  /** "N propostas abertas" (prioridade — é o que mais pede atenção) ou
   *  "último pedido em {mês}", ou nada se a cliente ainda não tem histórico. */
  function contexto(clienteId: string): string | null {
    const abertas = propostas.filter((p) => p.cliente_id === clienteId && !p.resolvida).length
    if (abertas > 0) return `${abertas} proposta${abertas > 1 ? 's' : ''} aberta${abertas > 1 ? 's' : ''}`

    const doCliente = pedidos.filter((p) => p.cliente_id === clienteId)
    if (doCliente.length === 0) return null
    const maisRecente = doCliente.reduce((a, b) => {
      const da = a.data_entrega ? dataLocal(a.data_entrega) : new Date(a.criado_em)
      const db = b.data_entrega ? dataLocal(b.data_entrega) : new Date(b.criado_em)
      return db > da ? b : a
    })
    const dataRef = maisRecente.data_entrega ? dataLocal(maisRecente.data_entrega) : new Date(maisRecente.criado_em)
    return `último pedido em ${formatarMes(dataRef)}`
  }

  const filtrados = clientes.filter((c) => !busca || c.nome.toLowerCase().includes(busca.toLowerCase()))

  async function criarClienteRapido() {
    if (!novoCliente.nome.trim()) return
    const res = await criarCliente(novoCliente)
    if ('erro' in res) {
      avisar(res.erro)
      return
    }
    irParaProposta(res.cliente.id)
  }

  function fecharNovo() {
    if (salvandoCliente) return
    setNovoAberto(false)
    setNovoCliente({ nome: '', whatsapp: '', nota: '' })
  }

  return (
    <div className="painel-overlay" onClick={aoFechar}>
      <div className="painel" onClick={(e) => e.stopPropagation()}>
        <div className="painel-puxador" />
        <div className="folha-titulo">Nova proposta — pra quem?</div>

        {carregando ? <TelaCarregando variante="lista" /> : (
          <>
            {clientes.length > 0 && (
              <div className="busca" style={{ marginTop: 4 }}>
                <Icone nome="busca" size={18} />
                <input
                  autoFocus
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar cliente…"
                />
                {busca && (
                  <button
                    type="button"
                    onClick={() => setBusca('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cacau-claro)', lineHeight: 1, display: 'flex' }}
                    aria-label="Limpar busca"
                  >
                    <Icone nome="fechar" size={18} />
                  </button>
                )}
              </div>
            )}

            {filtrados.length === 0 && clientes.length > 0 && (
              <p className="apoio" style={{ margin: '16px 0', textAlign: 'center' }}>
                Nenhuma cliente encontrada com esse nome.
              </p>
            )}

            {filtrados.length > 0 && (
              <div className="lista" style={{ marginTop: clientes.length > 0 ? 8 : 0 }}>
                {filtrados.map((c) => {
                  const ctx = contexto(c.id)
                  return (
                    <div
                      key={c.id}
                      className="item"
                      role="button"
                      tabIndex={0}
                      onClick={() => irParaProposta(c.id)}
                      onKeyDown={(e) => e.key === 'Enter' && irParaProposta(c.id)}
                    >
                      <div className="bola" aria-hidden>
                        {c.nome.trim().charAt(0).toUpperCase() || <Icone nome="clientes" size={18} />}
                      </div>
                      <div className="card-info">
                        <div className="card-nome">{c.nome}</div>
                        {ctx && <div className="apoio">{ctx}</div>}
                      </div>
                      <span aria-hidden>›</span>
                    </div>
                  )
                })}
              </div>
            )}

            <button
              type="button"
              className="acao-folha"
              style={{ marginTop: clientes.length > 0 ? 6 : 0 }}
              onClick={() => setNovoAberto(true)}
            >
              <span className="acao-ico"><Icone nome="mais" /></span>
              <span>Criar cliente nova</span>
            </button>
          </>
        )}
      </div>

      {/* Sheet empilhado: cadastro rápido, mesmos campos do PedidoForm. */}
      {novoAberto && (
        <div className="painel-overlay" onClick={(e) => { e.stopPropagation(); fecharNovo() }}>
          <div className="painel" onClick={(e) => e.stopPropagation()}>
            <div className="painel-puxador" />
            <div className="form-acervo-titulo">Novo cliente</div>
            <div className="campo">
              <label>Nome</label>
              <input
                autoFocus
                value={novoCliente.nome}
                onChange={(e) => setNovoCliente({ ...novoCliente, nome: e.target.value })}
                placeholder="Ex.: Maria Silva"
                maxLength={80}
              />
            </div>
            <div className="campo">
              <label>WhatsApp (opcional)</label>
              <input
                value={novoCliente.whatsapp}
                onChange={(e) => setNovoCliente({ ...novoCliente, whatsapp: e.target.value })}
                placeholder="Ex.: +55 11 99999-9999"
                inputMode="tel"
                maxLength={20}
              />
            </div>
            <div className="campo">
              <label>Nota (opcional)</label>
              <textarea
                value={novoCliente.nota}
                onChange={(e) => setNovoCliente({ ...novoCliente, nota: e.target.value })}
                placeholder="Ex.: prefere entregas pela manhã"
                maxLength={300}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                className="btn-secundario"
                style={{ flex: 1 }}
                onClick={fecharNovo}
                disabled={salvandoCliente}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="cta"
                style={{ flex: 2, height: 48 }}
                onClick={criarClienteRapido}
                disabled={salvandoCliente || !novoCliente.nome.trim()}
              >
                {salvandoCliente ? 'Salvando…' : 'Salvar e continuar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
