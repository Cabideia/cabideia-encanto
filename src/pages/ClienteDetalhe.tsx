import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Confirmar } from '../components/Confirmar'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useClientes, linkWhatsApp, type CamposCliente } from '../hooks/useClientes'
import { usePedidos, STATUS_INFO, tituloPedido } from '../hooks/usePedidos'
import { usePropostas } from '../hooks/usePropostas'
import { formatarReal } from '../hooks/useCardapio'
import { rotuloEntrega, formatarDataNumerica } from '../lib/datas'

/** M-003 · Detalhe da cliente — ver, editar, excluir + pedidos da cliente (M-002). */
export function ClienteDetalhe() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { sessao } = useSessao()
  const avisar = useAviso()
  const { carregando, salvando, buscarPorId, atualizar, excluir } = useClientes(sessao?.user.id)
  const { porCliente, pedidoDaProposta } = usePedidos(sessao?.user.id)
  const { porCliente: propostasPorCliente } = usePropostas(sessao?.user.id)

  const cliente = id ? buscarPorId(id) : undefined
  const pedidosCliente = id ? porCliente(id) : []
  const propostasCliente = id ? propostasPorCliente(id) : []

  // D5 · Ficha enxuta: por padrão só o que está "vivo" — pedidos em andamento
  // (a_fazer/em_producao) e propostas ativas (resolvida=false). O restante
  // (entregues/cancelados · propostas resolvidas) fica atrás de "Ver histórico".
  const pedidosAtivos = pedidosCliente.filter(
    (p) => p.status === 'a_fazer' || p.status === 'em_producao'
  )
  const pedidosHistorico = pedidosCliente.filter(
    (p) => p.status === 'entregue' || p.status === 'cancelado'
  )
  const propostasAtivas = propostasCliente.filter((p) => !p.resolvida)
  const propostasHistorico = propostasCliente.filter((p) => p.resolvida)

  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState<CamposCliente>({ nome: '', whatsapp: '', nota: '' })
  const [aExcluir, setAExcluir] = useState(false)
  const [verHistPedidos, setVerHistPedidos] = useState(false)
  const [verHistPropostas, setVerHistPropostas] = useState(false)

  // Preenche o formulário quando a cliente carrega/muda.
  useEffect(() => {
    if (cliente) {
      setForm({
        nome: cliente.nome,
        whatsapp: cliente.whatsapp ?? '',
        nota: cliente.nota ?? '',
      })
    }
  }, [cliente])

  if (carregando) return null

  // Carregou mas não achou (link antigo ou cliente já excluída).
  if (!cliente) {
    return (
      <div className="tela">
        <BarraTopo titulo="Cliente" />
        <div className="conteudo">
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="busca" size={44} /></div>
            <p>Esta cliente não foi encontrada.</p>
          </div>
        </div>
      </div>
    )
  }

  function abrirWhatsApp() {
    const link = linkWhatsApp(cliente!)
    if (!link) {
      avisar('Esta cliente não tem WhatsApp cadastrado')
      return
    }
    window.open(link, '_blank', 'noopener')
  }

  async function salvar() {
    const erro = await atualizar(cliente!.id, form)
    if (erro) {
      avisar(erro)
      return
    }
    avisar('Cliente atualizada ✓')
    setEditando(false)
  }

  async function confirmarExcluir() {
    const erro = await excluir(cliente!.id)
    if (erro) {
      avisar(erro)
      setAExcluir(false)
      return
    }
    avisar('Cliente excluída')
    navegar('/clientes', { replace: true })
  }

  function cartaoPedido(p: (typeof pedidosCliente)[number]) {
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
            {p.data_entrega && <div className="apoio">{rotuloEntrega(p.data_entrega)}</div>}
          </div>
          <span className={`chip ${info.chip}`}>{info.rotulo}</span>
        </div>
      </div>
    )
  }

  function cartaoProposta(p: (typeof propostasCliente)[number]) {
    const pedido = pedidoDaProposta(p.id) // M-039 · vínculo derivado, sem coluna nova
    return (
      <div
        key={p.id}
        className="card card-toque"
        onClick={() => navegar(`/propostas/${p.id}`)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navegar(`/propostas/${p.id}`)}
      >
        <div className="card-linha" style={{ alignItems: 'flex-start' }}>
          <div className="card-info">
            <div className="card-nome" style={{ whiteSpace: 'normal' }}>
              {p.titulo || 'Proposta'}
            </div>
            <div className="apoio">
              {p.valor != null ? formatarReal(p.valor) : 'Valor a combinar'}
              {p.validade ? ` · vale até ${formatarDataNumerica(p.validade)}` : ''}
            </div>
          </div>
          <span aria-hidden>›</span>
        </div>
        {pedido && (
          <button
            type="button"
            className="chip entregue"
            style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', gap: 4, marginTop: 10 }}
            onClick={(e) => {
              e.stopPropagation()
              navegar(`/pedidos/${pedido.id}`)
            }}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label="Virou pedido — abrir o pedido"
          >
            <Icone nome="ok" size={13} strokeWidth={3} /> Virou pedido
          </button>
        )}
        <button
          className="btn-secundario"
          style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
          onClick={(e) => {
            e.stopPropagation()
            navegar(pedido ? `/pedidos/${pedido.id}` : `/pedidos/novo?proposta=${p.id}`)
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Icone nome="pedidos" size={16} /> {pedido ? 'Ver pedido' : 'Virar pedido'}
        </button>
      </div>
    )
  }

  return (
    <div className="tela">
      <BarraTopo
        titulo={editando ? 'Editar cliente' : cliente.nome}
        acao={
          !editando ? (
            <button className="btn-icone" onClick={() => setEditando(true)} aria-label="Editar cliente">
              <Icone nome="editar" />
            </button>
          ) : undefined
        }
      />

      <div className="conteudo">
        {editando ? (
          <>
            <div className="campo">
              <label>Nome</label>
              <input
                autoFocus
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Maria Silva"
                maxLength={80}
              />
            </div>
            <div className="campo">
              <label>WhatsApp (opcional)</label>
              <input
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                placeholder="Ex.: +55 11 99999-9999"
                inputMode="tel"
              />
            </div>
            <div className="campo">
              <label>Nota (opcional)</label>
              <textarea
                value={form.nota}
                onChange={(e) => setForm({ ...form, nota: e.target.value })}
                placeholder="Ex.: prefere entregas pela manhã"
                maxLength={300}
              />
            </div>
          </>
        ) : (
          <>
            <div className="card">
              <div className="card-linha">
                <div className="bola" aria-hidden>
                  {cliente.nome.trim().charAt(0).toUpperCase() || <Icone nome="clientes" size={18} />}
                </div>
                <div className="card-info">
                  <div className="card-nome">{cliente.nome}</div>
                  <div className="apoio">{cliente.whatsapp ?? 'sem WhatsApp'}</div>
                </div>
              </div>
              {cliente.whatsapp && (
                <button
                  className="btn-secundario"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}
                  onClick={abrirWhatsApp}
                >
                  <Icone nome="whatsapp" size={16} /> Abrir conversa no WhatsApp
                </button>
              )}
            </div>

            {cliente.nota && (
              <>
                <div className="secao"><span className="confeito" /><h2>Nota</h2></div>
                <div className="card">
                  <p style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{cliente.nota}</p>
                </div>
              </>
            )}

            {/* Pedidos desta cliente (M-002) — só em andamento; resto no histórico */}
            <div className="secao" style={{ justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="confeito" /><h2>Pedidos</h2>
              </span>
              {pedidosAtivos.length > 0 && (
                <span className="apoio">
                  {pedidosAtivos.length} em andamento
                </span>
              )}
            </div>
            {pedidosAtivos.length === 0 ? (
              <div className="card">
                <p className="apoio" style={{ textAlign: 'center', padding: '8px 0' }}>
                  {pedidosHistorico.length > 0
                    ? 'Nenhum pedido em andamento.'
                    : 'Os pedidos desta cliente aparecerão aqui.'}
                </p>
              </div>
            ) : (
              pedidosAtivos.map(cartaoPedido)
            )}
            {pedidosHistorico.length > 0 && (
              <>
                {verHistPedidos && pedidosHistorico.map(cartaoPedido)}
                <button
                  type="button"
                  className="btn-secundario"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
                  onClick={() => setVerHistPedidos((v) => !v)}
                >
                  {verHistPedidos
                    ? 'Ocultar histórico'
                    : `Ver histórico (${pedidosHistorico.length})`}
                </button>
              </>
            )}

            {/* Propostas desta cliente (M-021 repensado) — só ativas; resto no histórico */}
            <div className="secao" style={{ justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="confeito" /><h2>Propostas</h2>
              </span>
              {propostasAtivas.length > 0 && (
                <span className="apoio">
                  {propostasAtivas.length} ativa{propostasAtivas.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {propostasAtivas.length === 0 ? (
              <div className="card">
                <p className="apoio" style={{ textAlign: 'center', padding: '8px 0' }}>
                  {propostasHistorico.length > 0
                    ? 'Nenhuma proposta ativa.'
                    : 'Crie uma proposta encantadora para enviar no WhatsApp.'}
                </p>
              </div>
            ) : (
              propostasAtivas.map(cartaoProposta)
            )}
            {propostasHistorico.length > 0 && (
              <>
                {verHistPropostas && propostasHistorico.map(cartaoProposta)}
                <button
                  type="button"
                  className="btn-secundario"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
                  onClick={() => setVerHistPropostas((v) => !v)}
                >
                  {verHistPropostas
                    ? 'Ocultar histórico'
                    : `Ver histórico (${propostasHistorico.length})`}
                </button>
              </>
            )}

            <button
              className="btn-secundario"
              style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
              onClick={() => setAExcluir(true)}
            >
              <Icone nome="lixo" size={16} /> Excluir cliente
            </button>
          </>
        )}
      </div>

      {/* CTA primário (modo leitura): criar uma proposta para esta cliente */}
      {!editando && (
        <div className="cta-area">
          <button className="cta" onClick={() => navegar(`/clientes/${cliente.id}/propostas/nova`)}>
            <Icone nome="mais" /> Nova proposta
          </button>
        </div>
      )}

      {/* CTA primário fixo só no modo edição (Salvar). */}
      {editando && (
        <div className="cta-area">
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn-secundario"
              style={{ flex: 1 }}
              onClick={() => setEditando(false)}
              disabled={salvando}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="cta"
              style={{ flex: 2 }}
              onClick={salvar}
              disabled={salvando || !form.nome.trim()}
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {aExcluir && (
        <Confirmar
          titulo={`Excluir “${cliente.nome}”?`}
          descricao="Os dados desta cliente serão removidos. Esta ação não pode ser desfeita."
          rotuloConfirmar="Excluir cliente"
          onConfirmar={confirmarExcluir}
          onCancelar={() => setAExcluir(false)}
        />
      )}
    </div>
  )
}
