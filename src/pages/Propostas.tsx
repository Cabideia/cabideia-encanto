import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { usePropostas, type Proposta } from '../hooks/usePropostas'
import { usePedidos } from '../hooks/usePedidos'
import { useClientes } from '../hooks/useClientes'
import { formatarReal } from '../hooks/useCardapio'
import { formatarDataNumerica } from '../lib/datas'

/**
 * UX-018 · Propostas (Decisão #36) — substitui a tela Acompanhar.
 *
 * Fusão: a aba "Links" (seleções legadas do M-022) deixa de existir na gestão —
 * os /s/:token antigos continuam funcionando até expirarem sozinhos (30 dias),
 * só perdem a tela. Supersede M-037 e UX-008.
 *
 * Card da proposta (mockup v7.2): título, cliente, valor/validade, o termômetro
 * "Aberta pela cliente Nx" (contado na RPC, sem contar a própria dona) e as
 * ações "Lembrar no zap" (WhatsApp da cliente com lembrete + link) e
 * "Resolver". "Virar/Ver pedido" continuam como antes.
 */
export function Propostas() {
  const { sessao } = useSessao()
  const avisar = useAviso()
  const navegar = useNavigate()

  const { propostas, carregando, marcarResolvida, garantirToken } = usePropostas(sessao?.user.id)
  const { pedidoDaProposta } = usePedidos(sessao?.user.id)
  const { buscarPorId: buscarCliente } = useClientes(sessao?.user.id)

  const [verResolvidas, setVerResolvidas] = useState(false)
  const [lembrando, setLembrando] = useState<string | null>(null)

  const filtradas = propostas.filter((p) => p.resolvida === verResolvidas)

  async function alternarResolvida(p: Proposta) {
    const erro = await marcarResolvida(p.id, !p.resolvida)
    if (erro) avisar(erro)
    else avisar(p.resolvida ? 'Reaberta ✓' : 'Proposta resolvida ✓')
  }

  /** Lembrete no WhatsApp da cliente com o link público da proposta. */
  async function lembrarNoZap(p: Proposta) {
    if (lembrando) return
    setLembrando(p.id)
    try {
      const token = await garantirToken(p.id)
      if (!token) {
        avisar('Não consegui gerar o link. Tente de novo.')
        return
      }
      const cliente = p.cliente_id ? buscarCliente(p.cliente_id) : undefined
      const primeiro = cliente?.nome?.split(' ')[0]
      const link = `https://cabideia.com.br/encanto/proposta/${token}`
      const texto =
        `${primeiro ? `Oi, ${primeiro}! ` : 'Oi! '}Passando para lembrar da sua proposta` +
        `${p.titulo ? `: ${p.titulo}` : ''} 💌 ${link}`
      const numero = (cliente?.whatsapp ?? '').replace(/\D/g, '')
      const alvo = numero
        ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
        : `https://wa.me/?text=${encodeURIComponent(texto)}`
      window.open(alvo, '_blank', 'noopener')
    } finally {
      setLembrando(null)
    }
  }

  return (
    <div className="tela">
      <BarraTopo titulo="Propostas" />
      <div className="conteudo">
        <div className="escolha">
          <button
            type="button"
            className={`filtro${!verResolvidas ? ' ativo' : ''}`}
            onClick={() => setVerResolvidas(false)}
          >
            Ativas
          </button>
          <button
            type="button"
            className={`filtro${verResolvidas ? ' ativo' : ''}`}
            onClick={() => setVerResolvidas(true)}
          >
            Resolvidas
          </button>
        </div>

        <p className="apoio" style={{ margin: '12px 0' }}>
          {verResolvidas
            ? 'Propostas arquivadas. Reabra para voltar à lista de ativas.'
            : 'A proposta vira um link que a cliente abre sem instalar nada. Aqui você acompanha o que aconteceu com cada uma.'}
        </p>

        {carregando ? null : filtradas.length === 0 ? (
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="editar" size={34} /></div>
            <p>
              {verResolvidas
                ? 'Nenhuma proposta resolvida por aqui.'
                : 'Você ainda não criou propostas. Abra uma cliente para criar a primeira.'}
            </p>
          </div>
        ) : (
          filtradas.map((p) => {
            const cliente = p.cliente_id ? buscarCliente(p.cliente_id) : undefined
            const pedido = pedidoDaProposta(p.id) // M-039 · vínculo derivado
            return (
              <div className="card" key={p.id}>
                <div
                  className="card-toque"
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'none', border: 'none', padding: 0, margin: 0, boxShadow: 'none' }}
                  onClick={() => navegar(`/propostas/${p.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navegar(`/propostas/${p.id}`)}
                >
                  <div className="card-info">
                    <div className="card-nome" style={{ whiteSpace: 'normal' }}>
                      {p.titulo || 'Proposta'}
                    </div>
                    <div className="apoio">
                      {cliente?.nome ?? 'sem cliente'}
                      {' · '}
                      {p.valor != null ? formatarReal(p.valor) : 'Valor a combinar'}
                      {p.validade ? ` · vale até ${formatarDataNumerica(p.validade)}` : ''}
                    </div>
                    {p.token && p.aberturas > 0 && (
                      <div className="apoio" style={{ color: 'var(--cor-primaria)', fontWeight: 700, marginTop: 2 }}>
                        <Icone nome="olho" size={14} /> Aberta pela cliente{' '}
                        {p.aberturas === 1 ? '1 vez' : `${p.aberturas} vezes`}
                      </div>
                    )}
                  </div>
                  {pedido ? (
                    <span className="chip entregue">Aceita</span>
                  ) : !p.resolvida ? (
                    <span className="chip producao">Aguardando</span>
                  ) : null}
                </div>

                {pedido && (
                  <button
                    type="button"
                    className="btn-secundario"
                    style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                    onClick={() => navegar(`/pedidos/${pedido.id}`)}
                  >
                    <Icone nome="ok" size={16} /> Virou pedido — ver pedido
                  </button>
                )}

                {!verResolvidas && !pedido && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button
                      className="btn-secundario"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => lembrarNoZap(p)}
                      disabled={lembrando === p.id}
                    >
                      <Icone nome="whatsapp" size={16} /> Lembrar no zap
                    </button>
                    <button
                      className="btn-secundario"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => alternarResolvida(p)}
                    >
                      <Icone nome="ok" size={16} /> Resolver
                    </button>
                  </div>
                )}

                {!verResolvidas && !pedido && (
                  <button
                    className="btn-secundario"
                    style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
                    onClick={() => navegar(`/pedidos/novo?proposta=${p.id}`)}
                  >
                    <Icone nome="pedidos" size={16} /> Virar pedido
                  </button>
                )}

                {verResolvidas && (
                  <button
                    className="btn-secundario"
                    style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                    onClick={() => alternarResolvida(p)}
                  >
                    <Icone nome="recarregar" size={16} /> Reabrir
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
