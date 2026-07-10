import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Confirmar } from '../components/Confirmar'
import { Icone } from '../components/Icone'
import { SeletorTag } from '../components/SeletorTag'
import { useAviso } from '../components/Toast'
import { compartilharImagem, compartilharImagens } from '../lib/compartilhar'
import { comprimirImagem } from '../lib/imagem'
import { useSessao } from '../hooks/useSessao'
import { useAcervo, type Tag, type Trabalho } from '../hooks/useAcervo'
import { useInspiracoes, dominioDe, type Inspiracao } from '../hooks/useInspiracoes'
import { useAssinatura } from '../hooks/useAssinatura'

const AVISO_CURADORIA_TRAVADA =
  'Para escolher quais fotos aparecem na vitrine, fique com até 150 imagens ou assine o Vitrine.'

// ─────────────────────────────────────────────────────────
// Painel de detalhe (bottom sheet) — abre ao tocar numa foto.
// ─────────────────────────────────────────────────────────
type PainelProps = {
  trabalho: Trabalho
  todasTags: Tag[]
  enviando: boolean
  onFechar: () => void
  onVerPedido: (pedidoId: string) => void
  onAtribuirTag: (trabalhoId: string, tagId: string) => Promise<void>
  onRemoverTag: (trabalhoId: string, tagId: string) => Promise<void>
  onCriarTag: (nome: string) => Promise<Tag | null>
  onAtualizar: (
    trabalho: Trabalho,
    dados: { descricao: string; novoBlob?: Blob | null }
  ) => Promise<string | null>
}

function PainelTrabalho({
  trabalho,
  todasTags,
  enviando,
  onFechar,
  onVerPedido,
  onAtribuirTag,
  onRemoverTag,
  onCriarTag,
  onAtualizar,
}: PainelProps) {
  const avisar = useAviso()
  const [compartilhando, setCompartilhando] = useState(false)

  // M-026 · edição inline (legenda + troca de foto). Tags já são editáveis abaixo.
  const [editando, setEditando] = useState(false)
  const [legendaEdit, setLegendaEdit] = useState(trabalho.descricao ?? '')
  const [novoBlob, setNovoBlob] = useState<Blob | null>(null)
  const [previewEdit, setPreviewEdit] = useState<string | null>(null)
  const inputFoto = useRef<HTMLInputElement>(null)

  const pedidoVinculadoId = trabalho.pedido_id

  function abrirEdicao() {
    setLegendaEdit(trabalho.descricao ?? '')
    setNovoBlob(null)
    if (previewEdit) URL.revokeObjectURL(previewEdit)
    setPreviewEdit(null)
    setEditando(true)
  }
  function cancelarEdicao() {
    if (previewEdit) URL.revokeObjectURL(previewEdit)
    setPreviewEdit(null)
    setNovoBlob(null)
    setEditando(false)
  }
  async function aoTrocarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const { blob } = await comprimirImagem(f) // compressão obrigatória (M-009)
      if (previewEdit) URL.revokeObjectURL(previewEdit)
      setNovoBlob(blob)
      setPreviewEdit(URL.createObjectURL(blob))
    } catch (err: unknown) {
      avisar((err as Error)?.message ?? 'Não consegui processar a foto.')
    }
  }
  async function salvarEdicao() {
    const erro = await onAtualizar(trabalho, { descricao: legendaEdit, novoBlob })
    if (erro) {
      avisar(erro)
      return
    }
    if (previewEdit) URL.revokeObjectURL(previewEdit)
    setPreviewEdit(null)
    setNovoBlob(null)
    setEditando(false)
    avisar('Trabalho atualizado ✓')
  }

  async function compartilhar() {
    if (compartilhando) return
    setCompartilhando(true)
    try {
      const rotulo = trabalho.codigo_num != null ? `A-${trabalho.codigo_num}` : 'trabalho'
      const nome =
        trabalho.codigo_num != null
          ? `cabideia-A${trabalho.codigo_num}.jpg`
          : 'cabideia-trabalho.jpg'
      const res = await compartilharImagem(trabalho.url, nome, {
        title: `Trabalho ${rotulo} · Cabideia Encanto`,
        text: trabalho.descricao ?? undefined,
      })
      if (res === 'baixado') avisar('Imagem baixada ✓')
    } finally {
      setCompartilhando(false)
    }
  }

  return (
    <div className="painel-overlay" onClick={onFechar}>
      <div className="painel" onClick={(e) => e.stopPropagation()}>
        <div className="painel-puxador" />
        <button className="painel-fechar" onClick={onFechar} aria-label="Fechar"><Icone nome="fechar" size={16} /></button>

        <img className="painel-foto" src={previewEdit ?? trabalho.url} alt={trabalho.descricao ?? ''} />
        {trabalho.codigo_num != null && (
          <div className="cod-linha">Código <b>A-{trabalho.codigo_num}</b></div>
        )}

        {editando ? (
          <>
            <input
              ref={inputFoto}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={aoTrocarFoto}
            />
            <button
              type="button"
              className="btn-secundario"
              style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
              onClick={() => inputFoto.current?.click()}
              disabled={enviando}
            >
              <Icone nome="imagem" size={16} /> Trocar foto
            </button>

            <div className="painel-secao">Legenda</div>
            <input
              className="painel-input"
              value={legendaEdit}
              onChange={(e) => setLegendaEdit(e.target.value)}
              placeholder="Ex.: Bolo de casamento 3 andares"
              maxLength={80}
            />

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button
                type="button"
                className="btn-secundario"
                style={{ flex: 1 }}
                onClick={cancelarEdicao}
                disabled={enviando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="cta"
                style={{ flex: 2, height: 48 }}
                onClick={salvarEdicao}
                disabled={enviando}
              >
                {enviando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </>
        ) : (
          <>
            {trabalho.descricao && <div className="painel-legenda">{trabalho.descricao}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button
                type="button"
                className="btn-secundario"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={abrirEdicao}
              >
                <Icone nome="editar" size={16} /> Editar
              </button>
              <button
                type="button"
                className="btn-secundario"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={compartilhar}
                disabled={compartilhando}
              >
                <Icone nome="compartilhar" size={16} />{' '}
                {compartilhando ? 'Abrindo…' : 'Baixar / compartilhar foto'}
              </button>
            </div>

            {pedidoVinculadoId && (
              <button
                type="button"
                className="btn-secundario"
                style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                onClick={() => onVerPedido(pedidoVinculadoId)}
              >
                <Icone nome="pedidos" size={16} /> Ver pedido
              </button>
            )}
          </>
        )}

        <div className="painel-secao">Tags desta foto</div>
        {trabalho.tags.length > 0 ? (
          <div className="tags-area">
            {trabalho.tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="tag-chip aplicada"
                onClick={() => onRemoverTag(trabalho.id, tag.id)}
                title="Toque para tirar esta tag da foto"
              >
                {tag.nome} <Icone nome="fechar" size={13} />
              </button>
            ))}
          </div>
        ) : (
          <p className="apoio" style={{ padding: '2px 2px 4px' }}>
            Nenhuma tag ainda. Adicione abaixo para achar essa foto depois.
          </p>
        )}

        <div className="painel-secao">Adicionar tag</div>
        <SeletorTag
          todasTags={todasTags}
          selecionadas={trabalho.tags.map((t) => t.id)}
          onSelecionar={(tag) => onAtribuirTag(trabalho.id, tag.id)}
          onCriar={onCriarTag}
          inputClassName="painel-input"
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Cartão da grade. Em modo seleção, vira um seletor (checkbox).
// ─────────────────────────────────────────────────────────
type CartaoProps = {
  trabalho: Trabalho
  modoSelecao: boolean
  marcado: boolean
  vitrineBloqueada: boolean
  onAbrir: () => void
  onAlternarMarca: () => void
  onLongPress: () => void
  onPedirRemover: () => void
  onAlternarVitrine: () => void
}

function CartaoTrabalho({
  trabalho,
  modoSelecao,
  marcado,
  vitrineBloqueada,
  onAbrir,
  onAlternarMarca,
  onLongPress,
  onPedirRemover,
  onAlternarVitrine,
}: CartaoProps) {
  // Segurar a foto (long-press) entra no modo seleção já marcando esta foto
  // (M-036). Um toque curto abre o detalhe; em modo seleção, alterna a marca.
  const timer = useRef<number | null>(null)
  const segurou = useRef(false)

  function limparTimer() {
    if (timer.current != null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }
  function aoPressionar() {
    if (modoSelecao) return
    segurou.current = false
    timer.current = window.setTimeout(() => {
      segurou.current = true
      onLongPress()
    }, 450)
  }
  function aoClicar() {
    // Se acabou de ser um long-press, não dispara o toque curto.
    if (segurou.current) {
      segurou.current = false
      return
    }
    if (modoSelecao) onAlternarMarca()
    else onAbrir()
  }

  return (
    <div className={`foto-item${modoSelecao && marcado ? ' marcado' : ''}`}>
      <div
        className="acervo-img-wrap"
        onClick={aoClicar}
        onPointerDown={aoPressionar}
        onPointerUp={limparTimer}
        onPointerLeave={limparTimer}
        onPointerCancel={limparTimer}
        onContextMenu={(e) => e.preventDefault()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && (modoSelecao ? onAlternarMarca() : onAbrir())}
      >
        <img src={trabalho.url} alt={trabalho.descricao ?? ''} loading="lazy" />

        {trabalho.codigo_num != null && (
          <span className="cod-selo" aria-label={`Código A-${trabalho.codigo_num}`}>
            A-{trabalho.codigo_num}
          </span>
        )}

        {modoSelecao ? (
          <span className={`sel-check${marcado ? ' on' : ''}`} aria-hidden>
            {marcado ? <Icone nome="ok" size={15} strokeWidth={3} /> : null}
          </span>
        ) : (
          <>
            <button
              className={`foto-vitrine-btn${trabalho.na_vitrine ? ' ativa' : ''}`}
              onClick={(e) => { e.stopPropagation(); onAlternarVitrine() }}
              aria-label={trabalho.na_vitrine ? 'Remover da vitrine' : 'Adicionar à vitrine'}
              title={
                vitrineBloqueada
                  ? 'Curadoria da vitrine travada no excedente'
                  : trabalho.na_vitrine
                    ? 'Na vitrine — toque para retirar'
                    : 'Toque para mostrar na vitrine'
              }
              style={vitrineBloqueada ? { opacity: 0.45 } : undefined}
            >
              <Icone nome="vitrine" size={16} />
            </button>
            <button
              className="foto-remover"
              onClick={(e) => { e.stopPropagation(); onPedirRemover() }}
              aria-label="Apagar foto"
            >
              <Icone nome="fechar" size={15} />
            </button>
          </>
        )}
      </div>

      {!modoSelecao && trabalho.na_vitrine && (
        <div className="rotulo-vitrine"><Icone nome="vitrine" size={13} /> na vitrine</div>
      )}

      {!modoSelecao && trabalho.descricao && (
        <div className="foto-legenda">{trabalho.descricao}</div>
      )}

      {!modoSelecao && trabalho.tags.length > 0 && (
        <button className="acervo-selo-tags" onClick={onAbrir} type="button">
          <Icone nome="tags" size={13} /> {trabalho.tags.length} tag{trabalho.tags.length !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Cartão de inspiração no modo seleção (M-022 estendido).
// ─────────────────────────────────────────────────────────
function CartaoInspSelecao({
  insp,
  marcado,
  onAlternarMarca,
}: {
  insp: Inspiracao
  marcado: boolean
  onAlternarMarca: () => void
}) {
  return (
    <div className={`foto-item${marcado ? ' marcado' : ''}`}>
      <div
        className="acervo-img-wrap"
        onClick={onAlternarMarca}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onAlternarMarca()}
      >
        {insp.fotoUrl ? (
          <img src={insp.fotoUrl} alt={insp.nota ?? ''} loading="lazy" />
        ) : (
          <div className="insp-link-capa">
            <span className="insp-link-emoji" aria-hidden><Icone nome="link" size={30} /></span>
            <span className="insp-link-dominio">{insp.url ? dominioDe(insp.url) : 'link'}</span>
          </div>
        )}
        {insp.codigo_num != null && (
          <span className="cod-selo" aria-label={`Código I-${insp.codigo_num}`}>
            I-{insp.codigo_num}
          </span>
        )}
        <span className={`sel-check${marcado ? ' on' : ''}`} aria-hidden>
          {marcado ? <Icone nome="ok" size={15} strokeWidth={3} /> : null}
        </span>
      </div>
      {insp.nota && <div className="foto-legenda">{insp.nota}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Página principal do Acervo
// ─────────────────────────────────────────────────────────
export function Acervo() {
  const { sessao } = useSessao()
  const avisar = useAviso()
  const navegar = useNavigate()
  const {
    trabalhos,
    todasTags,
    carregando,
    enviando,
    remover,
    alternarVitrine,
    atualizarTrabalho,
    criarTag,
    atribuirTag,
    removerTag,
  } = useAcervo(sessao?.user.id)
  const { inspiracoes } = useInspiracoes(sessao?.user.id)
  const { total, limite, ilimitado, emExcedente } = useAssinatura(sessao?.user.id)
  const [params, setParams] = useSearchParams()

  const [busca, setBusca] = useState('')
  const [tagFiltro, setTagFiltro] = useState<string | null>(null)
  const [abertoId, setAbertoId] = useState<string | null>(null)

  const [aApagar, setAApagar] = useState<Trabalho | null>(null)

  // Modo seleção — hoje serve só para baixar/compartilhar fotos em lote (M-035).
  // O link público de seleção (M-022) foi retirado na unificação (M-042 F2c):
  // todo envio à cliente passa a ser via Proposta. A infra de seleções fica.
  const [modoSelecao, setModoSelecao] = useState(false)
  const [abaSelecao, setAbaSelecao] = useState<'trabalhos' | 'inspiracoes'>('trabalhos')
  // Chaves prefixadas: 't:<id>' (trabalho) · 'i:<id>' (inspiração).
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [salvandoFotos, setSalvandoFotos] = useState(false)

  const filtrados = trabalhos.filter((t) => {
    const okTexto = !busca || t.descricao?.toLowerCase().includes(busca.toLowerCase())
    const okTag = !tagFiltro || t.tags.some((tg) => tg.id === tagFiltro)
    return okTexto && okTag
  })

  const inspFiltradas = inspiracoes.filter((i) => {
    const okTexto = !busca || i.nota?.toLowerCase().includes(busca.toLowerCase())
    const okTag = !tagFiltro || i.tags.some((tg) => tg.id === tagFiltro)
    return okTexto && okTag
  })

  const trabalhoAberto = abertoId ? trabalhos.find((t) => t.id === abertoId) ?? null : null

  // Deep-link vindo do detalhe do pedido (M-028): /acervo?t=<id> abre o painel.
  useEffect(() => {
    const t = params.get('t')
    if (t) {
      setAbertoId(t)
      setParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Uso do plano: total de IMAGENS (trabalhos + inspirações-imagem + referências),
  // não só os trabalhos desta tela. Fundadora/Vitrine = ilimitado.
  const pct = Math.min(100, Math.round((total / limite) * 100))
  const corBarra = emExcedente ? 'var(--caramelo)' : pct >= 90 ? 'var(--caramelo)' : 'var(--framboesa)'

  // ── Modo seleção ──
  function entrarSelecao() {
    setModoSelecao(true)
    setAbaSelecao('trabalhos')
    setMarcados(new Set())
  }
  function sairSelecao() {
    setModoSelecao(false)
    setMarcados(new Set())
  }
  // Entrar no modo seleção já marcando um item (vindo do long-press na grade).
  function iniciarSelecaoCom(chave: string) {
    setModoSelecao(true)
    setAbaSelecao('trabalhos')
    setMarcados(new Set([chave]))
  }
  function alternarMarca(chave: string) {
    setMarcados((prev) => {
      const n = new Set(prev)
      if (n.has(chave)) n.delete(chave)
      else n.add(chave)
      return n
    })
  }

  // Baixar/compartilhar as FOTOS marcadas (trabalhos + inspirações com imagem).
  // Itens que são só link (sem imagem) são ignorados.
  async function salvarFotosSelecionadas() {
    if (salvandoFotos) return
    const itens = Array.from(marcados)
      .map((chave) => {
        const id = chave.slice(2)
        if (chave.startsWith('i:')) {
          const insp = inspiracoes.find((i) => i.id === id)
          if (!insp?.fotoUrl) return null
          return {
            url: insp.fotoUrl,
            nome: insp.codigo_num != null ? `cabideia-I${insp.codigo_num}.jpg` : 'cabideia-inspiracao.jpg',
          }
        }
        const t = trabalhos.find((x) => x.id === id)
        if (!t) return null
        return {
          url: t.url,
          nome: t.codigo_num != null ? `cabideia-A${t.codigo_num}.jpg` : 'cabideia-trabalho.jpg',
        }
      })
      .filter((x): x is { url: string; nome: string } => x !== null)

    if (itens.length === 0) {
      avisar('Selecione fotos — itens só de link não têm imagem para salvar.')
      return
    }
    setSalvandoFotos(true)
    try {
      const res = await compartilharImagens(itens, { title: 'Cabideia Encanto' })
      if (res === 'baixado') avisar(itens.length > 1 ? 'Fotos baixadas ✓' : 'Imagem baixada ✓')
      else if (res === 'falhou') avisar('Não consegui baixar as fotos. Tente de novo.')
    } finally {
      setSalvandoFotos(false)
    }
  }

  async function confirmarApagar() {
    if (!aApagar) return
    const erro = await remover(aApagar)
    avisar(erro ?? 'Foto apagada')
    setAApagar(null)
  }
  async function aoAlternarVitrine(t: Trabalho) {
    // Curadoria travada no excedente: marcar/desmarcar fica bloqueado, mas
    // excluir continua (caminho de regularização).
    if (emExcedente) {
      avisar(AVISO_CURADORIA_TRAVADA)
      return
    }
    const erro = await alternarVitrine(t)
    if (erro) avisar(erro)
    else avisar(t.na_vitrine ? 'Removido da vitrine' : 'Adicionado à vitrine ✓')
  }

  if (carregando) return null

  const qtdMarcados = marcados.size
  // Quantas das marcadas têm imagem de fato (links-só de inspiração não contam)
  // — base do plural dinâmico do botão de fotos.
  const qtdFotosMarcadas = Array.from(marcados).filter((chave) => {
    if (chave.startsWith('i:')) return !!inspiracoes.find((i) => i.id === chave.slice(2))?.fotoUrl
    return true
  }).length
  const rotuloFotos = `Baixar / compartilhar ${qtdFotosMarcadas === 1 ? 'foto' : 'fotos'}`

  return (
    <div className="tela">
      <BarraTopo
        titulo={modoSelecao ? 'Escolha as fotos' : 'Meus trabalhos'}
        voltar={!modoSelecao}
        acao={
          modoSelecao ? (
            <button className="btn-icone" onClick={sairSelecao} aria-label="Sair da seleção"><Icone nome="fechar" /></button>
          ) : (
            <Link to="/tags" className="btn-icone" aria-label="Minhas tags"><Icone nome="tags" /></Link>
          )
        }
      />
      <div className="conteudo" style={{ paddingBottom: modoSelecao ? 168 : undefined }}>

        {!modoSelecao && (
          <>
            <div className="contador-acervo">
              {ilimitado ? (
                <div className="contador-texto">
                  <span className="contador-num">{total}</span>
                  <span className="contador-desc"> imagens · plano sem limite</span>
                </div>
              ) : (
                <>
                  <div className="contador-texto">
                    <span className="contador-num">{total}</span>
                    <span className="contador-desc">
                      {' '}de {limite} imagens do plano Grátis
                    </span>
                  </div>
                  <div className="contador-barra">
                    <div className="contador-progresso" style={{ width: `${pct}%`, background: corBarra }} />
                  </div>
                  {emExcedente && (
                    <p className="apoio" style={{ marginTop: 6 }}>
                      Você passou das {limite} imagens. A curadoria da vitrine fica travada
                      até regularizar — apagar imagens é sempre permitido.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Entrar no modo seleção para baixar/compartilhar fotos em lote (M-035).
                Também dá pra segurar uma foto na grade para entrar já marcando. */}
            {trabalhos.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <button
                  className="btn-secundario"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={entrarSelecao}
                >
                  <Icone nome="ok" size={16} /> Selecionar
                </button>
                <p className="apoio" style={{ textAlign: 'center', marginTop: 6 }}>
                  ou segure uma foto para escolher
                </p>
              </div>
            )}
          </>
        )}

        {modoSelecao && (
          <>
            <p className="apoio" style={{ marginTop: 4, marginBottom: 8 }}>
              Toque nas fotos que quer salvar no celular ou compartilhar — de Meus
              Trabalhos e de Inspirações.
            </p>
            <div className="escolha" style={{ marginBottom: 4 }}>
              <button
                type="button"
                className={`filtro${abaSelecao === 'trabalhos' ? ' ativo' : ''}`}
                onClick={() => setAbaSelecao('trabalhos')}
              >
                <Icone nome="trabalhos" size={15} /> Meus Trabalhos
              </button>
              <button
                type="button"
                className={`filtro${abaSelecao === 'inspiracoes' ? ' ativo' : ''}`}
                onClick={() => setAbaSelecao('inspiracoes')}
              >
                <Icone nome="inspiracoes" size={15} /> Inspirações
              </button>
            </div>
          </>
        )}

        {/* Busca */}
        <div className="busca" style={{ marginTop: 12 }}>
          <Icone nome="busca" size={18} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por legenda…"
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

        {/* Filtros por tag */}
        {todasTags.length > 0 && (
          <div className="filtros">
            <button className={`filtro${!tagFiltro ? ' ativo' : ''}`} onClick={() => setTagFiltro(null)}>
              Todas
            </button>
            {todasTags.map((tag) => (
              <button
                key={tag.id}
                className={`filtro${tagFiltro === tag.id ? ' ativo' : ''}`}
                onClick={() => setTagFiltro(tagFiltro === tag.id ? null : tag.id)}
              >
                {tag.nome}
              </button>
            ))}
          </div>
        )}

        {/* Grade — inspirações (só no modo seleção, aba Inspirações) */}
        {modoSelecao && abaSelecao === 'inspiracoes' ? (
          inspFiltradas.length === 0 ? (
            <div className="vazio" style={{ marginTop: 16 }}>
              <div className="icone"><Icone nome="inspiracoes" size={44} /></div>
              <p>
                {busca || tagFiltro
                  ? 'Nenhuma inspiração encontrada com esse filtro.'
                  : 'Você ainda não guardou inspirações. Crie em Inspirações.'}
              </p>
            </div>
          ) : (
            <div className="grade-fotos" style={{ marginTop: 12, alignItems: 'start' }}>
              {inspFiltradas.map((i) => (
                <CartaoInspSelecao
                  key={i.id}
                  insp={i}
                  marcado={marcados.has(`i:${i.id}`)}
                  onAlternarMarca={() => alternarMarca(`i:${i.id}`)}
                />
              ))}
            </div>
          )
        ) : filtrados.length === 0 ? (
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="trabalhos" size={44} /></div>
            <p>
              {busca || tagFiltro
                ? 'Nenhum trabalho encontrado com esse filtro.'
                : 'Suas fotos ficam guardadas na nuvem — sem ocupar o celular.'}
            </p>
          </div>
        ) : (
          <div className="grade-fotos" style={{ marginTop: 12, alignItems: 'start' }}>
            {filtrados.map((t) => (
              <CartaoTrabalho
                key={t.id}
                trabalho={t}
                modoSelecao={modoSelecao}
                marcado={marcados.has(`t:${t.id}`)}
                vitrineBloqueada={emExcedente}
                onAbrir={() => setAbertoId(t.id)}
                onAlternarMarca={() => alternarMarca(`t:${t.id}`)}
                onLongPress={() => iniciarSelecaoCom(`t:${t.id}`)}
                onPedirRemover={() => setAApagar(t)}
                onAlternarVitrine={() => aoAlternarVitrine(t)}
              />
            ))}
          </div>
        )}

      </div>

      {/* CTA guardar (oculto em modo seleção) — abre a tela separada (M-009) */}
      {!modoSelecao && (
        <div className="cta-area">
          <button className="cta" onClick={() => navegar('/acervo/novo')}>
            <Icone nome="mais" /> Adicionar ao acervo
          </button>
        </div>
      )}

      {/* Barra inferior do modo seleção — baixar/compartilhar as fotos em lote
          (M-035). O link público de seleção (M-022) saiu na unificação (F2c). */}
      {modoSelecao && (
        <div
          className="barra-selecao"
          style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}
        >
          <span className="barra-selecao-conta">
            {qtdMarcados} selecionado{qtdMarcados !== 1 ? 's' : ''}
          </span>
          <button
            className="cta"
            style={{ width: '100%', height: 48 }}
            disabled={qtdFotosMarcadas === 0 || salvandoFotos}
            onClick={salvarFotosSelecionadas}
            title="Salvar nas Fotos ou enviar pro WhatsApp/Instagram"
          >
            <Icone nome="compartilhar" size={18} /> {salvandoFotos ? 'Abrindo…' : rotuloFotos}
          </button>
        </div>
      )}

      {/* Painel de detalhe/tags */}
      {trabalhoAberto && !modoSelecao && (
        <PainelTrabalho
          trabalho={trabalhoAberto}
          todasTags={todasTags}
          enviando={enviando}
          onFechar={() => setAbertoId(null)}
          onVerPedido={(pedidoId) => navegar(`/pedidos/${pedidoId}`)}
          onAtribuirTag={atribuirTag}
          onRemoverTag={removerTag}
          onCriarTag={criarTag}
          onAtualizar={atualizarTrabalho}
        />
      )}

      {/* Confirmação de exclusão */}
      {aApagar && (
        <Confirmar
          titulo="Apagar esta foto?"
          descricao="Esta ação não pode ser desfeita. A foto sai de Meus Trabalhos e da vitrine."
          rotuloConfirmar="Apagar foto"
          onConfirmar={confirmarApagar}
          onCancelar={() => setAApagar(null)}
        />
      )}
    </div>
  )
}
