import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { TelaCarregando } from '../components/TelaCarregando'
import { LimiteModal } from '../components/LimiteModal'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useAcervo } from '../hooks/useAcervo'
import { useInspiracoes, dominioDe } from '../hooks/useInspiracoes'
import { useAssinatura } from '../hooks/useAssinatura'
import { extrairCodigos } from '../lib/codigos'
import { comprimirImagem } from '../lib/imagem'
import { usePedidos, tituloPedido } from '../hooks/usePedidos'
import { usePedidoReferencias, type NovaReferencia } from '../hooks/usePedidoReferencias'

/**
 * M-042 · Picker de referências de um pedido AVULSO (rota /pedidos/:id/referencias).
 *
 * Escolhe itens de Meus Trabalhos e/ou Inspirações e grava em `pedido_referencias`
 * (NÃO cria seleção pública). Volta ao detalhe ao salvar/cancelar (retorno-ao-pedido
 * do I6).
 *
 * DÍVIDA TÉCNICA (registrada por decisão da gestão): a grade/abas/checkbox de
 * seleção é REPLICADA aqui em vez de reusar os componentes inline do Acervo.tsx —
 * o Acervo é tela verificada e central (M-009) e não vale risco de regressão na
 * janela de teste. Extrair `CartaoSelecao`/`GradeSelecao` compartilhados quando
 * houver folga e então trocar as duas telas para o componente único.
 */
export function PedidoReferencias() {
  const { id } = useParams()
  const { sessao } = useSessao()
  const avisar = useAviso()
  const navegar = useNavigate()

  const { buscarPorId, carregando: carregandoPedidos, atualizar: atualizarPedido } =
    usePedidos(sessao?.user.id)
  const { trabalhos, carregando: carregandoAcervo } = useAcervo(sessao?.user.id)
  const { inspiracoes, subirImagem, criar: criarInspiracao, criarTag } = useInspiracoes(sessao?.user.id)
  const { total, limite, ilimitado, recarregar } = useAssinatura(sessao?.user.id)
  const { referencias, carregando: carregandoRefs, salvando, adicionar } =
    usePedidoReferencias(sessao?.user.id, id)

  const pedido = id ? buscarPorId(id) : undefined

  const [aba, setAba] = useState<'trabalhos' | 'inspiracoes' | 'codigos'>('trabalhos')
  const [textoCodigos, setTextoCodigos] = useState('') // M-050
  // Chaves prefixadas 't:<id>' / 'i:<id>' — mesmo padrão do Acervo.
  const [marcados, setMarcados] = useState<Set<string>>(new Set())

  // R2a · adicionar referência do zero, sem sair do picker: sobe uma foto para
  // Inspirações (ou cria um link) e já anexa como referência do pedido.
  const inputNovaFoto = useRef<HTMLInputElement>(null)
  const [subindo, setSubindo] = useState(false)
  const [limiteAberto, setLimiteAberto] = useState(false)
  const [mostrarLink, setMostrarLink] = useState(false)
  const [urlLink, setUrlLink] = useState('')
  const [salvandoLink, setSalvandoLink] = useState(false)

  // Itens que já são referência deste pedido saem da grade (só dá p/ adicionar
  // novos aqui; a remoção fica no detalhe). O hook ainda deduplica por garantia.
  const jaRef = useMemo(() => {
    const s = new Set<string>()
    for (const r of referencias)
      s.add(r.trabalho_id ? `t:${r.trabalho_id}` : `i:${r.inspiracao_id}`)
    return s
  }, [referencias])

  const trabalhosDisponiveis = trabalhos.filter((t) => !jaRef.has(`t:${t.id}`))
  const inspDisponiveis = inspiracoes.filter((i) => !jaRef.has(`i:${i.id}`))

  // M-050 · Códigos da cliente: resolve o que ela mandou no zap (M-049) contra
  // os acervos e marca como referência — fecha o ciclo favoritas → proposta.
  const resolvidos = useMemo(() => {
    const mapaT = new Map(
      trabalhos.filter((t) => t.codigo_num != null).map((t) => [t.codigo_num as number, t.id])
    )
    const mapaI = new Map(
      inspiracoes.filter((i) => i.codigo_num != null).map((i) => [i.codigo_num as number, i.id])
    )
    return extrairCodigos(textoCodigos).map((c) => {
      const idItem = c.tipo === 'i' ? mapaI.get(c.num) : mapaT.get(c.num)
      const rotulo = `${c.tipo === 'i' ? 'I' : 'A'}-${c.num}`
      if (!idItem) return { rotulo, chave: null as string | null, status: 'nao' as const }
      const chave = `${c.tipo}:${idItem}`
      if (jaRef.has(chave)) return { rotulo, chave, status: 'ja' as const }
      return { rotulo, chave, status: 'ok' as const }
    })
  }, [textoCodigos, trabalhos, inspiracoes, jaRef])
  const paraMarcar = resolvidos.filter((r) => r.status === 'ok' && r.chave && !marcados.has(r.chave))

  function marcarEncontrados() {
    if (paraMarcar.length === 0) return
    setMarcados((prev) => {
      const n = new Set(prev)
      for (const r of paraMarcar) if (r.chave) n.add(r.chave)
      return n
    })
    avisar(
      paraMarcar.length === 1 ? '1 foto marcada ✓' : `${paraMarcar.length} fotos marcadas ✓`
    )
  }

  function alternar(chave: string) {
    setMarcados((prev) => {
      const n = new Set(prev)
      if (n.has(chave)) n.delete(chave)
      else n.add(chave)
      return n
    })
  }

  // R2a · tag-ponte do pedido (pedidos.tag_id): mesma mecânica do lote M-040 —
  // garante/gera a tag a partir do título do pedido e a grava no pedido, para o
  // "Ver inspirações do pedido" seguir funcionando. Devolve o id da tag (ou null).
  async function garantirTagPonte(): Promise<string | null> {
    if (!pedido) return null
    if (pedido.tag_id) return pedido.tag_id
    const nome = tituloPedido(pedido).trim()
    if (!nome) return null
    const tag = await criarTag(nome)
    if (!tag) return null
    await atualizarPedido(pedido.id, { tag_id: tag.id })
    return tag.id
  }

  // R2a · ＋ Nova foto — sobe a(s) imagem(ns) para Inspirações (mesmo par
  // subirImagem+criar do lote M-040), respeitando o teto de 150, com a tag-ponte
  // gravada por baixo, e anexa cada uma como referência do pedido. Volta ao
  // detalhe, onde a grade já as mostra.
  async function aoEscolherNovaFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (arquivos.length === 0 || !id) return
    const restante = ilimitado ? Infinity : Math.max(0, limite - total)
    if (restante <= 0) {
      setLimiteAberto(true)
      return
    }
    setSubindo(true)
    try {
      // Tag-ponte gravada por baixo (M-040), como o lote do pedido faz.
      const tagId = await garantirTagPonte()
      const tagIds = tagId ? [tagId] : []
      // Pré-checa o saldo: sobe só até o teto do plano (não falha o lote inteiro).
      const aSubir = ilimitado ? arquivos : arquivos.slice(0, restante)
      const criadas: string[] = []
      let erroCompressao: string | null = null
      for (const arq of aSubir) {
        try {
          const { blob } = await comprimirImagem(arq)
          const up = await subirImagem(blob)
          if ('erro' in up) continue
          const res = await criarInspiracao({
            tipo: 'imagem',
            foto_path: up.path,
            url: null,
            nota: null,
            tagIds,
          })
          if (!('erro' in res)) criadas.push(res.id)
        } catch (err: unknown) {
          // HEIC/formatos exóticos: propaga a mensagem acionável (orienta a
          // "Mais compatível") em vez de engolir; só cai no genérico se não houver.
          erroCompressao = (err as Error)?.message ?? erroCompressao
        }
      }
      await recarregar()
      if (criadas.length === 0)
        return avisar(erroCompressao ?? 'Não consegui adicionar a foto. Tente de novo.')
      const erro = await adicionar(
        id,
        criadas.map((cid) => ({ origem: 'inspiracao' as const, id: cid }))
      )
      if (erro) return avisar(erro)
      const sobraram = arquivos.length - aSubir.length
      if (sobraram > 0)
        avisar(`Adicionei ${criadas.length}. As outras ${sobraram} passaram do limite de ${limite} imagens.`)
      else avisar(criadas.length === 1 ? 'Foto adicionada ✓' : `${criadas.length} fotos adicionadas ✓`)
      navegar(`/pedidos/${id}`, { replace: true })
    } finally {
      setSubindo(false)
    }
  }

  // R2a · ＋ Colar link — cria uma inspiração-link (não conta no limite de fotos),
  // com a mesma tag-ponte, e a anexa como referência na grade das fotos.
  async function aoColarLink() {
    if (!id) return
    const url = urlLink.trim()
    if (!url) return
    setSalvandoLink(true)
    try {
      const tagId = await garantirTagPonte()
      const tagIds = tagId ? [tagId] : []
      const res = await criarInspiracao({ tipo: 'link', foto_path: null, url, nota: null, tagIds })
      if ('erro' in res) return avisar(res.erro)
      const erro = await adicionar(id, [{ origem: 'inspiracao', id: res.id }])
      if (erro) return avisar(erro)
      avisar('Link adicionado ✓')
      setMostrarLink(false)
      setUrlLink('')
      navegar(`/pedidos/${id}`, { replace: true })
    } finally {
      setSalvandoLink(false)
    }
  }

  async function aoAdicionar() {
    if (!id) return
    if (marcados.size === 0) return avisar('Escolha ao menos uma referência.')
    const itens: NovaReferencia[] = Array.from(marcados).map((chave) =>
      chave.startsWith('i:')
        ? { origem: 'inspiracao', id: chave.slice(2) }
        : { origem: 'trabalho', id: chave.slice(2) }
    )
    const erro = await adicionar(id, itens)
    if (erro) return avisar(erro)
    avisar(
      itens.length === 1 ? 'Referência adicionada ✓' : `${itens.length} referências adicionadas ✓`
    )
    navegar(`/pedidos/${id}`, { replace: true })
  }

  if (carregandoPedidos || carregandoAcervo || carregandoRefs)
    return <TelaCarregando titulo="Selecionar referências" variante="grade" />

  if (!id || !pedido) {
    return (
      <div className="tela">
        <BarraTopo titulo="Referências" />
        <div className="conteudo">
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="busca" size={44} /></div>
            <p>Este pedido não foi encontrado.</p>
          </div>
        </div>
      </div>
    )
  }

  const qtd = marcados.size

  return (
    <div className="tela">
      <BarraTopo titulo="Selecionar referências" />

      <div className="conteudo" style={{ paddingBottom: 96 }}>
        <p className="apoio" style={{ marginBottom: 8 }}>
          Escolha fotos de Meus Trabalhos e/ou Inspirações como referência de
          “{tituloPedido(pedido)}”. Elas ficam guardadas no pedido — sem criar link.
        </p>

        {/* R2a · duas origens novas: subir do aparelho ou colar um link — ambas
            entram como referência do pedido na mesma grade das fotos. */}
        <input
          ref={inputNovaFoto}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          style={{ display: 'none' }}
          onChange={aoEscolherNovaFoto}
        />
        <div className="escolha" style={{ marginBottom: mostrarLink ? 4 : 10 }}>
          <button
            type="button"
            className="btn-secundario"
            onClick={() => inputNovaFoto.current?.click()}
            disabled={subindo || salvando}
          >
            <Icone nome="camera" size={15} /> {subindo ? 'Enviando…' : '＋ Nova foto'}
          </button>
          <button
            type="button"
            className="btn-secundario"
            onClick={() => setMostrarLink((v) => !v)}
            disabled={subindo}
          >
            <Icone nome="link" size={15} /> ＋ Colar link
          </button>
        </div>

        {mostrarLink && (
          <div className="campo" style={{ marginBottom: 10 }}>
            <input
              value={urlLink}
              onChange={(e) => setUrlLink(e.target.value)}
              placeholder="Cole o link (Pinterest, Instagram…)"
              inputMode="url"
              autoCapitalize="none"
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="btn-secundario"
                style={{ flex: 1 }}
                onClick={() => {
                  setMostrarLink(false)
                  setUrlLink('')
                }}
                disabled={salvandoLink}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="cta"
                style={{ flex: 2 }}
                onClick={aoColarLink}
                disabled={salvandoLink || !urlLink.trim()}
              >
                {salvandoLink ? 'Salvando…' : 'Adicionar link'}
              </button>
            </div>
          </div>
        )}

        <div className="escolha" style={{ marginBottom: 4 }}>
          <button
            type="button"
            className={`filtro${aba === 'trabalhos' ? ' ativo' : ''}`}
            onClick={() => setAba('trabalhos')}
          >
            <Icone nome="trabalhos" size={15} /> Meus Trabalhos
          </button>
          <button
            type="button"
            className={`filtro${aba === 'inspiracoes' ? ' ativo' : ''}`}
            onClick={() => setAba('inspiracoes')}
          >
            <Icone nome="inspiracoes" size={15} /> Inspirações
          </button>
          <button
            type="button"
            className={`filtro${aba === 'codigos' ? ' ativo' : ''}`}
            onClick={() => setAba('codigos')}
          >
            <Icone nome="whatsapp" size={15} /> Códigos da cliente
          </button>
        </div>

        {aba === 'codigos' ? (
          <div style={{ marginTop: 12 }}>
            <p className="apoio">
              Cole aqui os códigos que a cliente mandou no WhatsApp — as fotos
              entram como referência. Vale A-37, I-12 e também #37.
            </p>
            <div className="campo" style={{ marginTop: 10, marginBottom: 8 }}>
              <textarea
                value={textoCodigos}
                onChange={(e) => setTextoCodigos(e.target.value)}
                placeholder="Ex.: A-37, I-12, #35"
                rows={2}
                autoFocus
              />
            </div>
            {resolvidos.length > 0 && (
              <div className="escolha" style={{ marginBottom: 10 }}>
                {resolvidos.map((r) => (
                  <span
                    key={r.rotulo}
                    className={`chip${r.status === 'ok' ? ' entregue' : r.status === 'ja' ? ' afazer' : ''}`}
                    style={r.status === 'nao' ? { background: 'var(--cor-erro-fundo)', color: 'var(--cor-erro)' } : undefined}
                  >
                    {r.rotulo}
                    {r.status === 'ja' ? ' · já é referência' : r.status === 'nao' ? ' · não achei' : ''}
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              className="btn-secundario"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={marcarEncontrados}
              disabled={paraMarcar.length === 0}
            >
              <Icone nome="ok" size={16} /> Marcar {paraMarcar.length > 0 ? `(${paraMarcar.length})` : ''} para adicionar
            </button>
            <p className="apoio" style={{ marginTop: 8 }}>
              As marcadas entram junto com as das outras abas ao tocar em “Adicionar”.
            </p>
          </div>
        ) : aba === 'trabalhos' ? (
          trabalhosDisponiveis.length === 0 ? (
            <div className="vazio" style={{ marginTop: 16 }}>
              <div className="icone"><Icone nome="trabalhos" size={44} /></div>
              <p>
                {trabalhos.length === 0
                  ? 'Você ainda não tem trabalhos no acervo.'
                  : 'Todos os seus trabalhos já são referência deste pedido.'}
              </p>
            </div>
          ) : (
            <div className="grade-fotos" style={{ marginTop: 12, alignItems: 'start' }}>
              {trabalhosDisponiveis.map((t) => {
                const marcado = marcados.has(`t:${t.id}`)
                return (
                  <div className={`foto-item${marcado ? ' marcado' : ''}`} key={t.id}>
                    <div
                      className="acervo-img-wrap"
                      role="button"
                      tabIndex={0}
                      onClick={() => alternar(`t:${t.id}`)}
                      onKeyDown={(e) => e.key === 'Enter' && alternar(`t:${t.id}`)}
                    >
                      <img src={t.url} alt={t.descricao ?? ''} loading="lazy" />
                      {t.codigo_num != null && (
                        <span className="cod-selo" aria-label={`Código A-${t.codigo_num}`}>
                          A-{t.codigo_num}
                        </span>
                      )}
                      <span className={`sel-check${marcado ? ' on' : ''}`} aria-hidden>
                        {marcado ? <Icone nome="ok" size={15} strokeWidth={3} /> : null}
                      </span>
                    </div>
                    {t.descricao && <div className="foto-legenda">{t.descricao}</div>}
                  </div>
                )
              })}
            </div>
          )
        ) : inspDisponiveis.length === 0 ? (
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="inspiracoes" size={44} /></div>
            <p>
              {inspiracoes.length === 0
                ? 'Você ainda não guardou inspirações.'
                : 'Todas as suas inspirações já são referência deste pedido.'}
            </p>
          </div>
        ) : (
          <div className="grade-fotos" style={{ marginTop: 12, alignItems: 'start' }}>
            {inspDisponiveis.map((i) => {
              const marcado = marcados.has(`i:${i.id}`)
              return (
                <div className={`foto-item${marcado ? ' marcado' : ''}`} key={i.id}>
                  <div
                    className="acervo-img-wrap"
                    role="button"
                    tabIndex={0}
                    onClick={() => alternar(`i:${i.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && alternar(`i:${i.id}`)}
                  >
                    {i.fotoUrl ? (
                      <img src={i.fotoUrl} alt={i.nota ?? ''} loading="lazy" />
                    ) : (
                      <div className="insp-link-capa">
                        <span className="insp-link-emoji" aria-hidden><Icone nome="link" size={30} /></span>
                        <span className="insp-link-dominio">{i.url ? dominioDe(i.url) : 'link'}</span>
                      </div>
                    )}
                    {i.codigo_num != null && (
                      <span className="cod-selo" aria-label={`Código I-${i.codigo_num}`}>
                        I-{i.codigo_num}
                      </span>
                    )}
                    <span className={`sel-check${marcado ? ' on' : ''}`} aria-hidden>
                      {marcado ? <Icone nome="ok" size={15} strokeWidth={3} /> : null}
                    </span>
                  </div>
                  {i.nota && <div className="foto-legenda">{i.nota}</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* CTA primário fixo */}
      <div className="cta-area">
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => navegar(`/pedidos/${id}`)}
            className="btn-secundario"
            style={{ flex: 1 }}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={aoAdicionar}
            disabled={salvando || qtd === 0}
            className="cta"
            style={{ flex: 2 }}
          >
            {salvando ? 'Salvando…' : `Adicionar ${qtd || ''}`.trim()}
          </button>
        </div>
      </div>

      {limiteAberto && <LimiteModal onFechar={() => setLimiteAberto(false)} />}
    </div>
  )
}
