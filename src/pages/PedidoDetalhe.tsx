import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useClientes, linkWhatsApp } from '../hooks/useClientes'
import { useAcervo } from '../hooks/useAcervo'
import { useInspiracoes, dominioDe } from '../hooks/useInspiracoes'
import {
  usePedidos,
  STATUS_INFO,
  PAGAMENTO_INFO,
  PAGAMENTO_CURTO,
  tituloPedido,
  type StatusPedido,
  type StatusPagamento,
} from '../hooks/usePedidos'
import { formatarReal } from '../hooks/useCardapio'
import { compartilharImagens } from '../lib/compartilhar'
import { formatarDataLonga, rotuloEntrega } from '../lib/datas'

const ORDEM_STATUS: StatusPedido[] = ['a_fazer', 'em_producao', 'entregue', 'cancelado']
const ORDEM_PAGAMENTO: StatusPagamento[] = ['nao_pago', 'sinal', 'pago']

/** URLs coladas pela cliente costumam vir sem https:// — garante o esquema. */
function comEsquema(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

/** M-002 · Detalhe do pedido — status, foto, cliente, excluir, "mandar ao acervo". */
export function PedidoDetalhe() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { sessao } = useSessao()
  const avisar = useAviso()

  const { carregando, buscarPorId, mudarStatus, mudarStatusPagamento, urlReferencia, baixarReferencia } =
    usePedidos(sessao?.user.id)
  const { buscarPorId: buscarCliente } = useClientes(sessao?.user.id)
  const { trabalhos, criarTrabalhoDeBlob } = useAcervo(sessao?.user.id)
  const { buscarPorId: buscarInspiracao } = useInspiracoes(sessao?.user.id)

  const pedido = id ? buscarPorId(id) : undefined
  const cliente = pedido?.cliente_id ? buscarCliente(pedido.cliente_id) : undefined
  const inspiracao = pedido?.inspiracao_id ? buscarInspiracao(pedido.inspiracao_id) : undefined

  // M-028 · trabalhos ligados a este pedido (1 pedido → N trabalhos).
  const vinculados = pedido ? trabalhos.filter((t) => t.pedido_id === pedido.id) : []

  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [modalAcervo, setModalAcervo] = useState(false)
  const [enviandoAcervo, setEnviandoAcervo] = useState(false)
  const [compartilhandoFotos, setCompartilhandoFotos] = useState(false)

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
            <div className="icone"><Icone nome="busca" size={44} /></div>
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
    // Ao entregar, oferece levar as fotos a Meus Trabalhos (se ainda não houver).
    if (s === 'entregue' && vinculados.length === 0) setModalAcervo(true)
    else avisar('Status atualizado ✓')
  }

  async function aoMudarPagamento(s: StatusPagamento) {
    if (s === pedido!.status_pagamento) return
    const erro = await mudarStatusPagamento(pedido!.id, s)
    if (erro) {
      avisar(erro)
      return
    }
    avisar('Pagamento atualizado ✓')
  }

  // Atalho: usar a própria foto de referência como 1 trabalho deste pedido.
  async function usarReferencia() {
    if (!pedido!.foto_referencia_path) return
    setEnviandoAcervo(true)
    try {
      const blob = await baixarReferencia(pedido!.foto_referencia_path)
      if (!blob) {
        avisar('Não consegui baixar a foto de referência.')
        return
      }
      // descrição = nome curto do pedido; vincula via pedido_id (M-028).
      const res = await criarTrabalhoDeBlob(blob, tituloPedido(pedido!), [], pedido!.id)
      if ('erro' in res) {
        avisar(res.erro)
        return
      }
      avisar('Foto adicionada ao pedido ✓')
      setModalAcervo(false)
    } finally {
      setEnviandoAcervo(false)
    }
  }

  // M-035 · baixar/compartilhar o conjunto de fotos do pedido (Web Share).
  async function compartilharFotos() {
    if (compartilhandoFotos || vinculados.length === 0) return
    setCompartilhandoFotos(true)
    try {
      const itens = vinculados.map((t) => ({
        url: t.url,
        nome: t.codigo_num != null ? `cabideia-A${t.codigo_num}.jpg` : 'cabideia-trabalho.jpg',
      }))
      const res = await compartilharImagens(itens, { title: tituloPedido(pedido!) })
      if (res === 'baixado') avisar(itens.length > 1 ? 'Fotos baixadas ✓' : 'Imagem baixada ✓')
      else if (res === 'falhou') avisar('Não consegui baixar as fotos. Tente de novo.')
    } finally {
      setCompartilhandoFotos(false)
    }
  }

  return (
    <div className="tela">
      <BarraTopo
        titulo="Pedido"
        acao={
          <button className="btn-icone" onClick={() => navegar(`/pedidos/${pedido.id}/editar`)} aria-label="Editar pedido">
            <Icone nome="editar" />
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
                <div className="apoio" style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icone nome="calendario" size={14} /> {formatarDataLonga(pedido.data_entrega)} · {rotuloEntrega(pedido.data_entrega)}
                </div>
              )}
              {/* M-039 · valor junto ao status de pagamento (só exibição) */}
              {pedido.valor != null && (
                <div className="apoio" style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icone nome="precos" size={14} /> {formatarReal(pedido.valor)} · {PAGAMENTO_INFO[pedido.status_pagamento]}
                </div>
              )}
            </div>
            <span className={`chip ${info.chip}`}>{info.rotulo}</span>
          </div>

          {pedido.tema && (
            <p style={{ marginTop: 10, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{pedido.tema}</p>
          )}

          {vinculados.length > 0 && (
            <div className="apoio" style={{ marginTop: 10, color: 'var(--pistache)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icone nome="trabalhos" size={15} /> {vinculados.length} trabalho{vinculados.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Cliente */}
        {cliente && (
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
            {linkZap && (
              <button
                className="btn-secundario"
                style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}
                onClick={() => window.open(linkZap, '_blank', 'noopener')}
              >
                <Icone nome="whatsapp" size={16} /> Abrir conversa no WhatsApp
              </button>
            )}
          </div>
        )}

        {/* M-042 · atalho para a proposta que originou este pedido (M-039) */}
        {pedido.proposta_id && (
          <button
            className="btn-secundario"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => navegar(`/propostas/${pedido.proposta_id}`)}
          >
            <Icone nome="precos" size={16} /> Ver proposta
          </button>
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

        {/* Inspirações do pedido: anexo 1:1 (M-007), link da cliente e
            tag-ponte com a galeria (M-040) */}
        <div className="secao"><span className="confeito" /><h2>Inspirações</h2></div>
        {inspiracao && (
          <>
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
                  <div className="bola" aria-hidden><Icone nome="link" size={18} /></div>
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

        {/* Link que a cliente mandou (M-040) */}
        {pedido.link_inspiracao && (
          <button
            type="button"
            className="card card-toque card-linha"
            style={{ width: '100%', textAlign: 'left', gap: 10 }}
            onClick={() => window.open(comEsquema(pedido.link_inspiracao!), '_blank', 'noopener')}
          >
            <div className="bola" aria-hidden><Icone nome="link" size={18} /></div>
            <div className="card-info">
              <div className="card-nome">Link da cliente</div>
              <div className="apoio">{dominioDe(pedido.link_inspiracao)} · toque para abrir</div>
            </div>
            <span aria-hidden>›</span>
          </button>
        )}

        {/* Tag-ponte (M-040): guardar prints em lote e rever a galeria filtrada */}
        {pedido.tag_id && (
          <button
            className="btn-secundario"
            style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }}
            onClick={() => navegar(`/inspiracoes?tag=${pedido.tag_id}`)}
          >
            <Icone nome="inspiracoes" size={16} /> Ver inspirações do pedido
          </button>
        )}
        <button
          className="btn-secundario"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => navegar(`/inspiracoes/lote?pedido=${pedido.id}`)}
        >
          <Icone nome="mais" size={16} /> Guardar inspirações deste pedido
        </button>

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

        {/* Mudar status de pagamento — sempre visível, com ou sem valor no pedido */}
        <div className="secao"><span className="confeito" /><h2>Pagamento</h2></div>
        <div className="escolha">
          {ORDEM_PAGAMENTO.map((s) => (
            <button
              key={s}
              type="button"
              className={`filtro${pedido.status_pagamento === s ? ' ativo' : ''}`}
              onClick={() => aoMudarPagamento(s)}
            >
              {PAGAMENTO_CURTO[s]}
            </button>
          ))}
        </div>

        {/* Galeria dos trabalhos ligados a este pedido (M-028) */}
        {vinculados.length > 0 && (
          <>
            <div className="secao">
              <span className="confeito" />
              <h2>Fotos do pedido · {vinculados.length} trabalho{vinculados.length !== 1 ? 's' : ''}</h2>
            </div>
            <div className="grade-fotos" style={{ alignItems: 'start' }}>
              {vinculados.map((t) => (
                <div className="foto-item" key={t.id}>
                  <div
                    className="acervo-img-wrap"
                    role="button"
                    tabIndex={0}
                    onClick={() => navegar(`/acervo?t=${t.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navegar(`/acervo?t=${t.id}`)}
                  >
                    <img src={t.url} alt={t.descricao ?? ''} loading="lazy" />
                    {t.codigo_num != null && (
                      <span className="cod-selo" aria-label={`Código A-${t.codigo_num}`}>A-{t.codigo_num}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              className="btn-secundario"
              style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
              onClick={compartilharFotos}
              disabled={compartilhandoFotos}
            >
              <Icone nome="compartilhar" size={16} />{' '}
              {compartilhandoFotos
                ? 'Abrindo…'
                : `Baixar / compartilhar ${vinculados.length === 1 ? 'foto' : 'fotos'}`}
            </button>
          </>
        )}

        {/* Adicionar fotos a Meus Trabalhos (quando entregue) */}
        {pedido.status === 'entregue' && (
          <button
            className="btn-secundario"
            style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
            onClick={() => navegar(`/pedidos/${pedido.id}/fotos`)}
          >
            <Icone nome="mais" size={16} /> Adicionar fotos ao pedido
          </button>
        )}
      </div>

      {/* Modal: adicionar ao acervo */}
      {modalAcervo && (
        <div className="painel-overlay" onClick={() => !enviandoAcervo && setModalAcervo(false)}>
          <div className="painel" onClick={(e) => e.stopPropagation()}>
            <div className="painel-puxador" />
            <div className="form-acervo-titulo">Guardar as fotos deste pedido?</div>
            <p className="apoio" style={{ marginBottom: 14 }}>
              As fotos ficam no pedido e também em Meus Trabalhos, na nuvem. Você decide
              depois quais vão para a vitrine.
            </p>

            {pedido.foto_referencia_path && (
              <button
                className="cta"
                style={{ marginBottom: 10 }}
                onClick={usarReferencia}
                disabled={enviandoAcervo}
              >
                {enviandoAcervo ? 'Enviando…' : <><Icone nome="ok" size={16} strokeWidth={3} /> Usar a foto de referência</>}
              </button>
            )}
            <button
              className={pedido.foto_referencia_path ? 'btn-secundario' : 'cta'}
              style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }}
              onClick={() => { setModalAcervo(false); navegar(`/pedidos/${pedido.id}/fotos`) }}
              disabled={enviandoAcervo}
            >
              <Icone nome="imagem" size={16} /> Escolher fotos da galeria
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
