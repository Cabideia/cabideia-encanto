import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useClientes, linkWhatsApp } from '../hooks/useClientes'
import { useAcervo } from '../hooks/useAcervo'
import { useInspiracoes, dominioDe } from '../hooks/useInspiracoes'
import { usePedidos, STATUS_INFO, tituloPedido, type StatusPedido } from '../hooks/usePedidos'
import { comprimirImagem } from '../lib/imagem'
import { formatarDataLonga, rotuloEntrega } from '../lib/datas'

const ORDEM_STATUS: StatusPedido[] = ['a_fazer', 'em_producao', 'entregue', 'cancelado']

/** M-002 · Detalhe do pedido — status, foto, cliente, excluir, "mandar ao acervo". */
export function PedidoDetalhe() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { sessao } = useSessao()
  const avisar = useAviso()

  const { carregando, buscarPorId, mudarStatus, atualizar, urlReferencia, baixarReferencia } =
    usePedidos(sessao?.user.id)
  const { buscarPorId: buscarCliente } = useClientes(sessao?.user.id)
  const { criarTrabalhoDeBlob } = useAcervo(sessao?.user.id)
  const { buscarPorId: buscarInspiracao } = useInspiracoes(sessao?.user.id)

  const pedido = id ? buscarPorId(id) : undefined
  const cliente = pedido?.cliente_id ? buscarCliente(pedido.cliente_id) : undefined
  const inspiracao = pedido?.inspiracao_id ? buscarInspiracao(pedido.inspiracao_id) : undefined

  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [modalAcervo, setModalAcervo] = useState(false)
  const [enviandoAcervo, setEnviandoAcervo] = useState(false)
  const inputAcervo = useRef<HTMLInputElement>(null)

  // Busca URL assinada da foto de referência (bucket privado).
  useEffect(() => {
    let vivo = true
    if (pedido?.foto_referencia_path) {
      urlReferencia(pedido.foto_referencia_path).then((u) => {
        if (vivo && u) setFotoUrl(u)
      })
    } else {
      setFotoUrl(null)
    }
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.foto_referencia_path])

  if (carregando) return null

  if (!pedido) {
    return (
      <div className="tela">
        <BarraTopo titulo="Pedido" />
        <div className="conteudo">
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone">🔍</div>
            <p>Este pedido não foi encontrado.</p>
          </div>
        </div>
      </div>
    )
  }

  const info = STATUS_INFO[pedido.status]
  const linkZap = cliente ? linkWhatsApp(cliente) : null

  async function aoMudarStatus(s: StatusPedido) {
    if (s === pedido!.status) return
    const erro = await mudarStatus(pedido!.id, s)
    if (erro) {
      avisar(erro)
      return
    }
    // Ao entregar, oferece levar o trabalho ao acervo (uma vez).
    if (s === 'entregue' && !pedido!.trabalho_id) setModalAcervo(true)
    else avisar('Status atualizado ✓')
  }

  async function inserirNoAcervo(blob: Blob): Promise<string | null> {
    // descrição do trabalho = nome curto do pedido (não os detalhes longos)
    const res = await criarTrabalhoDeBlob(blob, tituloPedido(pedido!), [])
    if ('erro' in res) return res.erro
    return await atualizar(pedido!.id, { trabalho_id: res.id })
  }

  async function usarReferencia() {
    if (!pedido!.foto_referencia_path) return
    setEnviandoAcervo(true)
    try {
      const blob = await baixarReferencia(pedido!.foto_referencia_path)
      if (!blob) {
        avisar('Não consegui baixar a foto de referência.')
        return
      }
      const erro = await inserirNoAcervo(blob)
      if (erro) {
        avisar(erro)
        return
      }
      avisar('Foto adicionada a Meus Trabalhos ✓')
      setModalAcervo(false)
    } finally {
      setEnviandoAcervo(false)
    }
  }

  async function escolherNovaParaAcervo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setEnviandoAcervo(true)
    try {
      const { blob } = await comprimirImagem(f)
      const erro = await inserirNoAcervo(blob)
      if (erro) {
        avisar(erro)
        return
      }
      avisar('Foto adicionada a Meus Trabalhos ✓')
      setModalAcervo(false)
    } catch (err: unknown) {
      avisar((err as Error)?.message ?? 'Não consegui processar a foto.')
    } finally {
      setEnviandoAcervo(false)
    }
  }

  return (
    <div className="tela">
      <BarraTopo
        titulo="Pedido"
        acao={
          <button className="btn-icone" onClick={() => navegar(`/pedidos/${pedido.id}/editar`)} aria-label="Editar pedido">
            ✏️
          </button>
        }
      />

      <div className="conteudo">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div className="card-info">
              <div className="card-nome" style={{ whiteSpace: 'normal', fontSize: 'var(--t-card)' }}>
                {tituloPedido(pedido)}
              </div>
              {pedido.data_entrega && (
                <div className="apoio" style={{ marginTop: 4 }}>
                  📅 {formatarDataLonga(pedido.data_entrega)} · {rotuloEntrega(pedido.data_entrega)}
                </div>
              )}
            </div>
            <span className={`chip ${info.chip}`}>{info.rotulo}</span>
          </div>

          {pedido.tema && (
            <p style={{ marginTop: 10, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{pedido.tema}</p>
          )}

          {pedido.trabalho_id && (
            <div className="apoio" style={{ marginTop: 10, color: 'var(--pistache)', fontWeight: 700 }}>
              📸 Em Meus Trabalhos
            </div>
          )}
        </div>

        {/* Cliente */}
        {cliente && (
          <div className="card">
            <div className="card-linha">
              <div className="bola" aria-hidden>
                {cliente.nome.trim().charAt(0).toUpperCase() || '🩷'}
              </div>
              <div className="card-info">
                <div className="card-nome">{cliente.nome}</div>
                <div className="apoio">{cliente.whatsapp ?? 'sem WhatsApp'}</div>
              </div>
            </div>
            {linkZap && (
              <button
                className="btn-secundario"
                style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}
                onClick={() => window.open(linkZap, '_blank', 'noopener')}
              >
                💬 Abrir conversa no WhatsApp
              </button>
            )}
          </div>
        )}

        {/* Foto de referência */}
        {fotoUrl && (
          <>
            <div className="secao"><span className="confeito" /><h2>Foto de referência</h2></div>
            <img
              src={fotoUrl}
              alt="Foto de referência"
              style={{ width: '100%', borderRadius: 'var(--raio-card)', display: 'block', border: '1px solid var(--linha)' }}
            />
          </>
        )}

        {/* Inspiração vinculada */}
        {inspiracao && (
          <>
            <div className="secao"><span className="confeito" /><h2>Inspiração</h2></div>
            {inspiracao.fotoUrl ? (
              <button
                type="button"
                className="card card-toque card-linha"
                style={{ width: '100%', textAlign: 'left', gap: 10 }}
                onClick={() => navegar(`/inspiracoes/${inspiracao.id}`)}
              >
                <img
                  src={inspiracao.fotoUrl}
                  alt=""
                  style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flex: 'none' }}
                />
                <div className="card-info">
                  <div className="card-nome">
                    {inspiracao.tipo === 'link' && inspiracao.url
                      ? dominioDe(inspiracao.url)
                      : inspiracao.nota || 'Imagem'}
                  </div>
                  {inspiracao.nota && <div className="apoio">{inspiracao.nota}</div>}
                </div>
                <span aria-hidden>›</span>
              </button>
            ) : (
              inspiracao.url && (
                <button
                  type="button"
                  className="card card-toque card-linha"
                  style={{ width: '100%', textAlign: 'left', gap: 10 }}
                  onClick={() => window.open(inspiracao.url!, '_blank', 'noopener')}
                >
                  <div className="bola" aria-hidden>🔗</div>
                  <div className="card-info">
                    <div className="card-nome">{dominioDe(inspiracao.url)}</div>
                    <div className="apoio">{inspiracao.nota || 'Toque para abrir no navegador'}</div>
                  </div>
                  <span aria-hidden>›</span>
                </button>
              )
            )}
          </>
        )}

        {/* Mudar status */}
        <div className="secao"><span className="confeito" /><h2>Status</h2></div>
        <div className="escolha">
          {ORDEM_STATUS.map((s) => (
            <button
              key={s}
              type="button"
              className={`filtro${pedido.status === s ? ' ativo' : ''}`}
              onClick={() => aoMudarStatus(s)}
            >
              {STATUS_INFO[s].rotulo}
            </button>
          ))}
        </div>

        {/* Adicionar a Meus Trabalhos (se entregue e ainda não está) */}
        {pedido.status === 'entregue' && !pedido.trabalho_id && (
          <button
            className="btn-secundario"
            style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
            onClick={() => setModalAcervo(true)}
          >
            📸 Adicionar a Meus Trabalhos
          </button>
        )}
      </div>

      {/* CTA primário: gerar uma proposta encantadora a partir deste pedido */}
      <div className="cta-area">
        <button className="cta" onClick={() => navegar(`/pedidos/${pedido.id}/proposta`)}>
          ✨ Gerar proposta
        </button>
      </div>

      {/* Modal: adicionar ao acervo */}
      {modalAcervo && (
        <div className="painel-overlay" onClick={() => !enviandoAcervo && setModalAcervo(false)}>
          <div className="painel" onClick={(e) => e.stopPropagation()}>
            <div className="painel-puxador" />
            <div className="form-acervo-titulo">Adicionar a Meus Trabalhos?</div>
            <p className="apoio" style={{ marginBottom: 14 }}>
              Guarde a foto do trabalho entregue em Meus Trabalhos, na nuvem. Você decide
              depois se ela vai para a vitrine.
            </p>

            <input
              ref={inputAcervo}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={escolherNovaParaAcervo}
            />

            {pedido.foto_referencia_path && (
              <button
                className="cta"
                style={{ marginBottom: 10 }}
                onClick={usarReferencia}
                disabled={enviandoAcervo}
              >
                {enviandoAcervo ? 'Enviando…' : '✅ Usar a foto de referência'}
              </button>
            )}
            <button
              className={pedido.foto_referencia_path ? 'btn-secundario' : 'cta'}
              style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }}
              onClick={() => inputAcervo.current?.click()}
              disabled={enviandoAcervo}
            >
              🖼️ Escolher outra foto
            </button>
            <button
              className="btn-secundario"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setModalAcervo(false)}
              disabled={enviandoAcervo}
            >
              Agora não
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
