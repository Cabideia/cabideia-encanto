import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Confirmar } from '../components/Confirmar'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useClientes, linkWhatsApp } from '../hooks/useClientes'
import { useAcervo } from '../hooks/useAcervo'
import { useInspiracoes, dominioDe } from '../hooks/useInspiracoes'
import { usePedidoReferencias } from '../hooks/usePedidoReferencias'
import { PilhaReferencias, resolverReferencias } from '../components/GradeReferencias'
import {
  usePedidos,
  STATUS_INFO,
  PAGAMENTO_CURTO,
  tituloPedido,
  type StatusPedido,
  type StatusPagamento,
} from '../hooks/usePedidos'
import { formatarReal } from '../hooks/useCardapio'
import { compartilharImagens } from '../lib/compartilhar'
import { diasAte, formatarDataLonga, formatarDataNumerica, rotuloEntrega } from '../lib/datas'

// UX-030 (D1/P0) · os chips mostram so o CAMINHO NORMAL do pedido. "Cancelado"
// e uma acao destrutiva de excecao: saiu dos chips e virou item do menu (✎),
// atras de confirmacao — a doceira nao cancela um pedido por engano num toque.
const ORDEM_STATUS: StatusPedido[] = ['a_fazer', 'em_producao', 'entregue']
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

  const { carregando, buscarPorId, mudarStatus, mudarStatusPagamento, garantirToken, urlReferencia, baixarReferencia } =
    usePedidos(sessao?.user.id)
  const { buscarPorId: buscarCliente } = useClientes(sessao?.user.id)
  const { trabalhos, criarTrabalhoDeBlob } = useAcervo(sessao?.user.id)
  const { inspiracoes, buscarPorId: buscarInspiracao } = useInspiracoes(sessao?.user.id)
  const { referencias, garantirFotosPublicas } = usePedidoReferencias(sessao?.user.id, id)

  const pedido = id ? buscarPorId(id) : undefined
  const cliente = pedido?.cliente_id ? buscarCliente(pedido.cliente_id) : undefined
  const inspiracao = pedido?.inspiracao_id ? buscarInspiracao(pedido.inspiracao_id) : undefined

  // M-028 · trabalhos ligados a este pedido (1 pedido → N trabalhos).
  const vinculados = pedido ? trabalhos.filter((t) => t.pedido_id === pedido.id) : []

  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [modalAcervo, setModalAcervo] = useState(false)
  const [enviandoAcervo, setEnviandoAcervo] = useState(false)
  const [compartilhandoFotos, setCompartilhandoFotos] = useState(false)
  const [compartilhandoLink, setCompartilhandoLink] = useState(false)
  // UX-030 · menu do ✎ (editar / cancelar) + confirmacao do cancelamento.
  const [menuAberto, setMenuAberto] = useState(false)
  const [aCancelar, setACancelar] = useState(false)

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

  // UX-030 (mockup 1a) · linha única do card: "Ana Paula · entrega sáb, 8 de
  // agosto". `rotuloEntrega` devolve a data curta quando falta mais de 1 dia —
  // nesse caso repetiria a data longa, então só entra quando é urgência real.
  const diasParaEntrega = pedido.data_entrega ? diasAte(pedido.data_entrega) : null
  const urgenciaUtil =
    diasParaEntrega != null && diasParaEntrega <= 1
      ? rotuloEntrega(pedido.data_entrega!)
      : null
  const linhaResumo = [
    cliente?.nome,
    pedido.data_entrega ? `entrega ${formatarDataLonga(pedido.data_entrega)}` : null,
    urgenciaUtil,
  ]
    .filter(Boolean)
    .join(' · ')

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

  // UX-030 · cancelar o pedido (acao de excecao, fora dos chips). O link da
  // cliente para de abrir (a RPC publica filtra cancelado) e o pedido sai da
  // agenda — por isso passa por confirmacao. Reabrir e so escolher um chip.
  async function confirmarCancelar() {
    const erro = await mudarStatus(pedido!.id, 'cancelado')
    setACancelar(false)
    if (erro) {
      avisar(erro)
      return
    }
    avisar('Pedido cancelado')
  }

  // R2b · modelos visuais das referências (grade compartilhada — UX-029).
  const refsVisuais = resolverReferencias(referencias, trabalhos, inspiracoes)

  // M-047 · URL da página pública do pedido (mesmo domínio da proposta F2b).
  function linkPedido(token: string): string {
    return `https://cabideia.com.br/encanto/pedido/${token}`
  }

  /** M-047 · Texto do WhatsApp (a usuária pode editar antes de enviar). */
  function mensagemPedido(link: string): string {
    const nome = cliente?.nome?.split(' ')[0]
    const saudacao = nome ? `Oi ${nome}!` : 'Oi!'
    const titulo = tituloPedido(pedido!)
    const entrega = pedido!.data_entrega
      ? `, com entrega em ${formatarDataNumerica(pedido!.data_entrega)}`
      : ''
    return (
      `${saudacao} Aqui está o resumo do seu pedido '${titulo}'${entrega}: ${link}\n` +
      'Qualquer ajuste é só me chamar por aqui 😊'
    )
  }

  /**
   * M-047 · Compartilhar com a cliente — gera/reusa o token, garante as cópias
   * públicas das fotos de referência e abre o WhatsApp da cliente com o texto
   * pronto + o link. Cliente sem telefone → share sheet padrão.
   */
  async function compartilharLink() {
    if (compartilhandoLink) return
    setCompartilhandoLink(true)
    try {
      const token = await garantirToken(pedido!.id)
      if (!token) {
        avisar('Não consegui gerar o link. Tente de novo.')
        return
      }
      // BUG-011 · cópias públicas das fotos de referência (idempotente). Se
      // alguma falhar, aborta o envio — não manda um link com fotos quebradas.
      const falhaFotos = await garantirFotosPublicas(pedido!.id)
      if (falhaFotos) {
        avisar(falhaFotos.erro)
        return
      }
      const texto = mensagemPedido(linkPedido(token))
      const numero = (cliente?.whatsapp ?? '').replace(/\D/g, '')
      if (numero) {
        window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
      } else if (navigator.share) {
        // Cliente sem WhatsApp: menu nativo de compartilhamento.
        try {
          await navigator.share({ text: texto })
        } catch {
          /* usuária cancelou o menu nativo */
        }
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
      }
    } finally {
      setCompartilhandoLink(false)
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
          <button className="btn-icone" onClick={() => setMenuAberto(true)} aria-label="Mais opções do pedido">
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
              {/* UX-030 (mockup 1a) · cliente e entrega na MESMA linha
                  ("Ana Paula · entrega sáb, 8 de agosto"), como no mockup — antes
                  eram duas linhas de apoio empilhadas. A urgência (Hoje/Amanhã/
                  Atrasado) só entra quando diz algo que a data longa não diz. */}
              {linhaResumo && (
                <div className="apoio" style={{ marginTop: 4 }}>{linhaResumo}</div>
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

          {/* UX-030 · o valor combinado ganha linha propria dentro do card
              (antes era mais uma linha de apoio, perdida entre data e tema). */}
          {pedido.valor != null && (
            <div
              style={{
                marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--linha)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              }}
            >
              <span className="apoio">Valor combinado</span>
              <b style={{ fontSize: 'var(--t-card)', color: 'var(--framboesa)' }}>
                {formatarReal(pedido.valor)}
              </b>
            </div>
          )}
        </div>

        {/* UX-030 (mockup 1a) · Status e Pagamento sobem para LOGO ABAIXO do
            card — é o que a doceira mexe todo dia. Antes ficavam depois das
            referências e do legado, obrigando a rolar a tela inteira para
            marcar "Em produção". Ordem do mockup: card → Status → Pagamento →
            Referências → Mais ações → CTA. */}
        <div className="secao"><span className="confeito" /><h2>Status</h2></div>
        <div className="escolha">
          {ORDEM_STATUS.map((s) => (
            <button
              key={s}
              type="button"
              className={`filtro${pedido.status === s ? ' ativo' : ''}`}
              aria-pressed={pedido.status === s}
              onClick={() => aoMudarStatus(s)}
            >
              {STATUS_INFO[s].rotulo}
            </button>
          ))}
        </div>

        {/* Pagamento — sempre visível, com ou sem valor no pedido */}
        <div className="secao"><span className="confeito" /><h2>Pagamento</h2></div>
        <div className="escolha">
          {ORDEM_PAGAMENTO.map((s) => (
            <button
              key={s}
              type="button"
              className={`filtro${
                pedido.status_pagamento === s ? (s === 'nao_pago' ? ' ativo' : ' ativo sucesso') : ''
              }`}
              aria-pressed={pedido.status_pagamento === s}
              onClick={() => aoMudarPagamento(s)}
            >
              {PAGAMENTO_CURTO[s]}
            </button>
          ))}
        </div>

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

        {/* M-042/M-048/R2b · Referências do pedido (trabalhos/inspirações).
            UX-029 (Decisão #72) · o detalhe mostra só uma PRÉVIA de 4; a grade
            completa (2 colunas + zoom) vive em "Ver referências". Tocar abre a
            origem; o × tira só a referência — nunca apaga o item. */}
        <div className="secao"><span className="confeito" /><h2>Referências</h2></div>
        {refsVisuais.length > 0 ? (
          <PilhaReferencias
            itens={refsVisuais}
            onClick={() => navegar(`/pedidos/${pedido.id}/galeria`)}
          />
        ) : (
          <button
            className="btn-secundario"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => navegar(`/pedidos/${pedido.id}/referencias`)}
          >
            <Icone nome="imagem" size={16} /> Selecionar referências
          </button>
        )}

        {/* UX-028 · legado só-leitura: pedidos antigos com inspiração 1:1 (M-007)
            ou link da cliente (M-040) seguem exibidos aqui, agora sob "Referências"
            (sem título "Inspirações" nem botão de escrita). A tag-ponte
            (pedidos.tag_id) segue gravada pelo picker por baixo, sem atalho
            próprio no detalhe. */}
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
          </>
        )}

        {/* UX-030 (D1/P0) · "Mais ações" — as acoes secundarias que antes eram
            5 a 7 botoes full-width identicos viram uma LISTA (padrao .lista
            .item), sobrando uma unica acao primaria na tela (o CTA fixo). */}
        {(pedido.proposta_id ||
          vinculados.length > 0 ||
          pedido.status === 'em_producao' ||
          pedido.status === 'entregue' ||
          (linkZap && cliente)) && (
        <>
        <div className="secao"><span className="confeito" /><h2>Mais ações</h2></div>
        <div className="card" style={{ padding: '2px 14px' }}>
          <div className="lista">
            {pedido.proposta_id && (
              <div
                className="item"
                role="button"
                tabIndex={0}
                onClick={() => navegar(`/propostas/${pedido.proposta_id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navegar(`/propostas/${pedido.proposta_id}`)}
              >
                <div className="bola" style={{ width: 36, height: 36 }}><Icone nome="precos" size={17} /></div>
                <div className="card-info">
                  <div className="card-nome" style={{ fontSize: 'var(--t-base)' }}>Ver proposta original</div>
                </div>
                <span aria-hidden>›</span>
              </div>
            )}

            {vinculados.length > 0 && (
              <div
                className="item"
                role="button"
                tabIndex={0}
                onClick={compartilharFotos}
                onKeyDown={(e) => e.key === 'Enter' && compartilharFotos()}
                aria-disabled={compartilhandoFotos}
              >
                <div className="bola" style={{ width: 36, height: 36 }}><Icone nome="compartilhar" size={17} /></div>
                <div className="card-info">
                  <div className="card-nome" style={{ fontSize: 'var(--t-base)' }}>
                    {compartilhandoFotos
                      ? 'Abrindo…'
                      : `Baixar ou compartilhar ${vinculados.length === 1 ? 'foto' : 'fotos'}`}
                  </div>
                </div>
                <span aria-hidden>›</span>
              </div>
            )}

            {/* I7 · fotos prontas do trabalho (≠ referencias) — em producao e entregue */}
            {(pedido.status === 'em_producao' || pedido.status === 'entregue') && (
              <div
                className="item"
                role="button"
                tabIndex={0}
                onClick={() => navegar(`/pedidos/${pedido.id}/fotos`)}
                onKeyDown={(e) => e.key === 'Enter' && navegar(`/pedidos/${pedido.id}/fotos`)}
              >
                <div className="bola" style={{ width: 36, height: 36 }}><Icone nome="trabalhos" size={17} /></div>
                <div className="card-info">
                  <div className="card-nome" style={{ fontSize: 'var(--t-base)' }}>Guardar fotos do trabalho</div>
                </div>
                <span aria-hidden>›</span>
              </div>
            )}

            {linkZap && cliente && (
              <div
                className="item"
                role="button"
                tabIndex={0}
                onClick={() => window.open(linkZap, '_blank', 'noopener')}
                onKeyDown={(e) => e.key === 'Enter' && window.open(linkZap, '_blank', 'noopener')}
              >
                <div
                  className="bola"
                  style={{ width: 36, height: 36, background: 'var(--cor-sucesso-fundo)', color: 'var(--cor-whatsapp)' }}
                >
                  <Icone nome="whatsapp" size={17} />
                </div>
                <div className="card-info">
                  <div className="card-nome" style={{ fontSize: 'var(--t-base)' }}>
                    Abrir conversa da {cliente.nome.split(' ')[0]}
                  </div>
                </div>
                <span aria-hidden>›</span>
              </div>
            )}
          </div>
        </div>
        </>
        )}
      </div>

      {/* UX-030 · a UNICA acao primaria da tela */}
      <div className="cta-area">
        <button className="cta" onClick={compartilharLink} disabled={compartilhandoLink}>
          <Icone nome="compartilhar" size={16} />{' '}
          {compartilhandoLink ? 'Preparando o link…' : 'Compartilhar com a cliente'}
        </button>
      </div>

      {/* UX-030 · menu do ✎ — editar (comum) e cancelar (excecao, destrutivo). */}
      {menuAberto && (
        <div className="painel-overlay" onClick={() => setMenuAberto(false)}>
          <div className="painel" onClick={(e) => e.stopPropagation()}>
            <div className="painel-puxador" />
            <div className="form-acervo-titulo">Este pedido</div>
            <div className="lista">
              <div
                className="item"
                role="button"
                tabIndex={0}
                onClick={() => { setMenuAberto(false); navegar(`/pedidos/${pedido.id}/editar`) }}
                onKeyDown={(e) => e.key === 'Enter' && navegar(`/pedidos/${pedido.id}/editar`)}
              >
                <div className="bola" style={{ width: 36, height: 36 }}><Icone nome="editar" size={17} /></div>
                <div className="card-info">
                  <div className="card-nome" style={{ fontSize: 'var(--t-base)' }}>Editar pedido</div>
                </div>
                <span aria-hidden>›</span>
              </div>
              {pedido.status !== 'cancelado' && (
                <div
                  className="item"
                  role="button"
                  tabIndex={0}
                  onClick={() => { setMenuAberto(false); setACancelar(true) }}
                  onKeyDown={(e) => e.key === 'Enter' && (setMenuAberto(false), setACancelar(true))}
                >
                  <div
                    className="bola"
                    style={{ width: 36, height: 36, background: 'var(--cor-erro-fundo)', color: 'var(--cor-erro)' }}
                  >
                    <Icone nome="fechar" size={17} />
                  </div>
                  <div className="card-info">
                    <div className="card-nome" style={{ fontSize: 'var(--t-base)', color: 'var(--cor-erro)' }}>
                      Cancelar pedido
                    </div>
                  </div>
                  <span aria-hidden style={{ color: 'var(--cor-erro)' }}>›</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* UX-030 (com a confirmacao do item 2b) · o texto conta a VERDADE:
          o que sai da agenda, o que acontece com o link e como desfazer. */}
      {aCancelar && (
        <Confirmar
          titulo="Cancelar este pedido?"
          descricao="O pedido sai da agenda e o link da cliente deixa de abrir. Dá para reabrir depois, escolhendo outro status."
          rotuloConfirmar="Cancelar pedido"
          onConfirmar={confirmarCancelar}
          onCancelar={() => setACancelar(false)}
        />
      )}

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
