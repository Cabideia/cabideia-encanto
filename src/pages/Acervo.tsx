import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { TelaCarregando } from '../components/TelaCarregando'
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
  onPedirRemover: () => void
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
  onPedirRemover,
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
                {compartilhando ? 'Abrindo…' : 'Compartilhar'}
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

        {/* UX-036 · a exclusão saiu da grade e passou a viver só aqui, no detalhe
            (Decisão #87). Abre o mesmo Confirmar de sempre — texto inalterado. */}
        {!editando && (
          <button
            type="button"
            className="btn-secundario"
            style={{
              width: '100%', justifyContent: 'center', marginTop: 18,
              color: 'var(--cor-erro)', borderColor: 'var(--cor-erro)', background: 'var(--cor-erro-fundo)',
            }}
            onClick={onPedirRemover}
          >
            <Icone nome="lixo" size={16} /> Excluir foto
          </button>
        )}
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
          </>
        )}
      </div>

      {/* UX-014 — padrão único dos cards: LEGENDA + TAGS sempre presentes.
          Sem legenda → placeholder discreto que convida à edição; sem tags → "0 tags".
          O estado de vitrine agora é só o ícone de sacola (canto inferior direito
          da imagem), sem o texto "na vitrine" — absorve o UX-010. */}
      {!modoSelecao && (
        <>
          <button
            type="button"
            className={`foto-legenda${trabalho.descricao ? '' : ' vazia'}`}
            onClick={onAbrir}
          >
            {trabalho.descricao || 'Edite a legenda'}
          </button>
          <button className="acervo-selo-tags" onClick={onAbrir} type="button">
            <Icone nome="tags" size={13} /> {trabalho.tags.length} tag{trabalho.tags.length !== 1 ? 's' : ''}
          </button>
        </>
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
  // UX-036 · multi-filtro de tag por OU/união (Decisão #97): a foto entra se tiver
  // pelo menos uma das tags marcadas. Conjunto vazio = mostra tudo.
  const [tagsFiltro, setTagsFiltro] = useState<Set<string>>(new Set())
  const [filtroAberto, setFiltroAberto] = useState(false)
  // Contador colapsado em 1 linha (default); toque expande para o card completo.
  const [contadorAberto, setContadorAberto] = useState(false)
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
    const okTag = tagsFiltro.size === 0 || t.tags.some((tg) => tagsFiltro.has(tg.id))
    return okTexto && okTag
  })

  const inspFiltradas = inspiracoes.filter((i) => {
    const okTexto = !busca || i.nota?.toLowerCase().includes(busca.toLowerCase())
    const okTag = tagsFiltro.size === 0 || i.tags.some((tg) => tagsFiltro.has(tg.id))
    return okTexto && okTag
  })

  function alternarTagFiltro(id: string) {
    setTagsFiltro((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

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

  // BUG-015 · No modo seleção escondemos a barra inferior (UX-017) para a barra
  // de ação ocupar o rodapé sem ser coberta (padrão de galeria). O atributo é
  // global (no <html>), mas a LIMPEZA é garantida pelo return do efeito: ele
  // roda ao sair do modo E no unmount — voltar do Android, deep link ou erro de
  // render. Assim a nav nunca fica presa escondida no app inteiro.
  useEffect(() => {
    if (!modoSelecao) return
    document.documentElement.dataset.ocultarBarra = 'sim'
    return () => {
      delete document.documentElement.dataset.ocultarBarra
    }
  }, [modoSelecao])

  // UX-036 · a dica de segurar-para-escolher saiu da tela e virou toast único
  // (Decisão #96): mostra uma vez na 1ª visita com fotos, marca em localStorage.
  const dicaMostrada = useRef(false)
  useEffect(() => {
    if (dicaMostrada.current || modoSelecao || trabalhos.length === 0) return
    if (localStorage.getItem('acervo_dica_selecao')) return
    dicaMostrada.current = true
    localStorage.setItem('acervo_dica_selecao', 'sim')
    avisar('Segure uma foto para escolher várias')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trabalhos.length, modoSelecao])

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
    // A exclusão só nasce do painel de detalhe (Decisão #87) — fecha ao concluir.
    setAbertoId(null)
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

  if (carregando) return <TelaCarregando titulo="Meus trabalhos" variante="grade" />

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
          ) : trabalhos.length > 0 ? (
            // UX-036 · "Selecionar" virou ícone na barra; "Minhas tags" migrou para a
            // folha de filtro e o painel de detalhe (Decisão #96).
            <button className="btn-icone" onClick={entrarSelecao} aria-label="Selecionar fotos"><Icone nome="ok" /></button>
          ) : undefined
        }
      />
      <div className="conteudo" style={{ paddingBottom: modoSelecao ? 168 : undefined }}>

        {/* UX-036 · contador colapsado no topo (Decisão #87). Fechado: 1 linha
            "{total} de {limite} fotos" + barra fina + link para os planos. Toque expande
            para o card completo. O aviso de excedente aparece mesmo fechado. */}
        {!modoSelecao && (
          ilimitado ? (
            <div className="contador-acervo">
              <div className="contador-texto" style={{ marginBottom: 0 }}>
                <span className="contador-num">{total}</span>
                <span className="contador-desc"> imagens · plano sem limite</span>
              </div>
            </div>
          ) : (
            <div className="contador-acervo">
              <div className="contador-linha">
                <button
                  type="button"
                  className="contador-toggle"
                  aria-expanded={contadorAberto}
                  onClick={() => setContadorAberto((v) => !v)}
                >
                  {contadorAberto ? (
                    <span>
                      <span className="contador-num">{total}</span>
                      <span className="contador-desc"> de {limite} imagens do plano Grátis</span>
                    </span>
                  ) : (
                    <span className="contador-desc">
                      <b className="contador-forte">{total}</b> de {limite} fotos
                    </span>
                  )}
                </button>
                {!contadorAberto && (
                  <Link to="/planos" className="contador-plano">
                    plano <Icone nome="avancar" />
                  </Link>
                )}
              </div>
              <div className="contador-barra" style={{ marginTop: 8 }}>
                <div className="contador-progresso" style={{ width: `${pct}%`, background: corBarra }} />
              </div>
              {emExcedente && (
                <p className="apoio" style={{ marginTop: 6 }}>
                  Você passou das {limite} imagens. A curadoria da vitrine fica travada
                  até regularizar — apagar imagens é sempre permitido.
                </p>
              )}
            </div>
          )
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
        <div className="busca" style={{ marginTop: 4 }}>
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

        {/* UX-036 · filtro de tag multi-seleção (Decisão #97): botão "Filtrar (N)"
            abre a folha; as tags marcadas ficam na linha como chips removíveis. */}
        {todasTags.length > 0 && (
          <div className="acervo-filtros-linha">
            <button type="button" className="acervo-filtrar" onClick={() => setFiltroAberto(true)}>
              <Icone nome="tags" size={16} /> Filtrar{tagsFiltro.size > 0 ? ` (${tagsFiltro.size})` : ''}
            </button>
            {[...tagsFiltro].map((id) => {
              const tag = todasTags.find((t) => t.id === id)
              if (!tag) return null
              return (
                <button
                  key={id}
                  type="button"
                  className="tag-chip aplicada"
                  onClick={() => alternarTagFiltro(id)}
                  title="Tirar este filtro"
                >
                  {tag.nome} <Icone nome="fechar" size={13} />
                </button>
              )
            })}
          </div>
        )}

        {/* Grade — inspirações (só no modo seleção, aba Inspirações) */}
        {modoSelecao && abaSelecao === 'inspiracoes' ? (
          inspFiltradas.length === 0 ? (
            <div className="vazio" style={{ marginTop: 16 }}>
              <div className="icone"><Icone nome="inspiracoes" size={44} /></div>
              <p>
                {busca || tagsFiltro.size > 0
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
              {busca || tagsFiltro.size > 0
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
          onPedirRemover={() => setAApagar(trabalhoAberto)}
          onVerPedido={(pedidoId) => navegar(`/pedidos/${pedidoId}`)}
          onAtribuirTag={atribuirTag}
          onRemoverTag={removerTag}
          onCriarTag={criarTag}
          onAtualizar={atualizarTrabalho}
        />
      )}

      {/* UX-036 · folha de filtro por tag (multi-seleção, união). Herda também o
          acesso a "Minhas tags" que saiu da barra (Decisão #96). */}
      {filtroAberto && (
        <div className="painel-overlay" onClick={() => setFiltroAberto(false)}>
          <div className="painel" onClick={(e) => e.stopPropagation()}>
            <div className="painel-puxador" />
            <button className="painel-fechar" onClick={() => setFiltroAberto(false)} aria-label="Fechar"><Icone nome="fechar" size={16} /></button>

            <div className="painel-secao" style={{ marginTop: 4 }}>Filtrar por tag</div>
            <div className="tags-area">
              {todasTags.map((tag) => {
                const marcada = tagsFiltro.has(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={`tag-chip${marcada ? ' aplicada' : ''}`}
                    onClick={() => alternarTagFiltro(tag.id)}
                    aria-pressed={marcada}
                  >
                    {tag.nome}{marcada && <> <Icone nome="ok" size={13} /></>}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                className="btn-secundario"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setTagsFiltro(new Set())}
                disabled={tagsFiltro.size === 0}
              >
                Limpar tudo
              </button>
              <button
                type="button"
                className="cta"
                style={{ flex: 2, height: 48 }}
                onClick={() => setFiltroAberto(false)}
              >
                Ver fotos
              </button>
            </div>

            {/* Rodapé: manutenção de tags (renomear/apagar) — a única outra porta é
                o SeletorTag do painel de detalhe (Decisão #96). */}
            <button
              type="button"
              className="btn-secundario"
              style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
              onClick={() => { setFiltroAberto(false); navegar('/tags') }}
            >
              <Icone nome="tags" size={16} /> Gerenciar tags
            </button>
          </div>
        </div>
      )}

      {/* Confirmação de exclusão */}
      {aApagar && (
        <Confirmar
          titulo="Excluir esta foto?"
          descricao="Ela sai da vitrine e também dos links já enviados às clientes. Não dá para desfazer."
          rotuloConfirmar="Excluir foto"
          onConfirmar={confirmarApagar}
          onCancelar={() => setAApagar(null)}
        />
      )}
    </div>
  )
}
