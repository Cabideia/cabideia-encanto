import { useRef, useState } from 'react'
import { BarraTopo } from '../components/BarraTopo'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useAcervo, type Tag, type Trabalho } from '../hooks/useAcervo'

const LIMITE_GRATIS = 150

// ─────────────────────────────────────────────────────────
// Painel de detalhe (bottom sheet) — abre ao tocar numa foto.
// Concentra toda a edição de tags, longe da grade.
// ─────────────────────────────────────────────────────────
type PainelProps = {
  trabalho: Trabalho
  todasTags: Tag[]
  onFechar: () => void
  onAtribuirTag: (trabalhoId: string, tagId: string) => Promise<void>
  onRemoverTag: (trabalhoId: string, tagId: string) => Promise<void>
  onCriarTag: (nome: string) => Promise<Tag | null>
}

function PainelTrabalho({
  trabalho,
  todasTags,
  onFechar,
  onAtribuirTag,
  onRemoverTag,
  onCriarTag,
}: PainelProps) {
  const [texto, setTexto] = useState('')

  // Tags que ainda NÃO estão nesta foto (candidatas a adicionar)
  const disponiveis = todasTags.filter(
    (t) => !trabalho.tags.some((tg) => tg.id === t.id)
  )
  const sugestoes = disponiveis.filter(
    (t) => !texto || t.nome.includes(texto.toLowerCase())
  )
  const podeCriar =
    !!texto.trim() && !todasTags.some((t) => t.nome === texto.trim().toLowerCase())

  async function adicionar(tagId: string) {
    await onAtribuirTag(trabalho.id, tagId)
    setTexto('')
  }

  async function criarEAdicionar() {
    if (!texto.trim()) return
    const tag = await onCriarTag(texto)
    if (tag) await onAtribuirTag(trabalho.id, tag.id)
    setTexto('')
  }

  return (
    <div className="painel-overlay" onClick={onFechar}>
      <div className="painel" onClick={(e) => e.stopPropagation()}>
        <div className="painel-puxador" />
        <button className="painel-fechar" onClick={onFechar} aria-label="Fechar">
          ✕
        </button>

        <img className="painel-foto" src={trabalho.url} alt={trabalho.descricao ?? ''} />

        {trabalho.descricao && <div className="painel-legenda">{trabalho.descricao}</div>}

        {/* Tags que ESTÃO nesta foto — × remove desta foto */}
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
                {tag.nome} ✕
              </button>
            ))}
          </div>
        ) : (
          <p className="apoio" style={{ padding: '2px 2px 4px' }}>
            Nenhuma tag ainda. Adicione abaixo para achar essa foto depois.
          </p>
        )}

        {/* Adicionar tag: campo + sugestões + criar nova */}
        <div className="painel-secao">Adicionar tag</div>
        <input
          className="painel-input"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (sugestoes.length > 0) adicionar(sugestoes[0].id)
              else if (podeCriar) criarEAdicionar()
            }
          }}
          placeholder="Digite para buscar ou criar…"
          autoCapitalize="none"
        />

        {(sugestoes.length > 0 || podeCriar) && (
          <div className="tags-area" style={{ paddingTop: 8 }}>
            {sugestoes.map((t) => (
              <button
                key={t.id}
                type="button"
                className="tag-chip"
                onClick={() => adicionar(t.id)}
              >
                + {t.nome}
              </button>
            ))}
            {podeCriar && (
              <button type="button" className="tag-criar" onClick={criarEAdicionar}>
                Criar “{texto.trim()}”
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Cartão da grade — só visual. Toque na foto abre o painel.
// ─────────────────────────────────────────────────────────
type CartaoProps = {
  trabalho: Trabalho
  onAbrir: () => void
  onRemover: () => void
  onAlternarVitrine: () => void
}

function CartaoTrabalho({ trabalho, onAbrir, onRemover, onAlternarVitrine }: CartaoProps) {
  return (
    <div className="foto-item">
      <div
        className="acervo-img-wrap"
        onClick={onAbrir}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onAbrir()}
      >
        <img src={trabalho.url} alt={trabalho.descricao ?? ''} loading="lazy" />
        <button
          className={`foto-vitrine-btn${trabalho.na_vitrine ? ' ativa' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onAlternarVitrine()
          }}
          aria-label={trabalho.na_vitrine ? 'Remover da vitrine' : 'Adicionar à vitrine'}
          title={
            trabalho.na_vitrine
              ? 'Na vitrine — toque para retirar'
              : 'Toque para mostrar na vitrine'
          }
        >
          🛍️
        </button>
        <button
          className="foto-remover"
          onClick={(e) => {
            e.stopPropagation()
            onRemover()
          }}
          aria-label="Remover foto"
        >
          ✕
        </button>
      </div>

      {trabalho.descricao && <div className="foto-legenda">{trabalho.descricao}</div>}

      {trabalho.tags.length > 0 && (
        <button className="acervo-selo-tags" onClick={onAbrir} type="button">
          🏷️ {trabalho.tags.length} tag{trabalho.tags.length !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Página principal do Acervo
// ─────────────────────────────────────────────────────────
export function Acervo() {
  const { sessao } = useSessao()
  const avisar = useAviso()
  const {
    trabalhos,
    todasTags,
    carregando,
    enviando,
    adicionar,
    remover,
    alternarVitrine,
    criarTag,
    atribuirTag,
    removerTag,
  } = useAcervo(sessao?.user.id)

  const [formAberto, setFormAberto] = useState(false)
  const [descricao, setDescricao] = useState('')
  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>([])
  const [novaTagTexto, setNovaTagTexto] = useState('')
  const [busca, setBusca] = useState('')
  const [tagFiltro, setTagFiltro] = useState<string | null>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filtragem local — sem roundtrip ao banco
  const filtrados = trabalhos.filter((t) => {
    const okTexto = !busca || t.descricao?.toLowerCase().includes(busca.toLowerCase())
    const okTag = !tagFiltro || t.tags.some((tg) => tg.id === tagFiltro)
    return okTexto && okTag
  })

  // O painel lê sempre o trabalho mais atual (tags mudam em tempo real)
  const trabalhoAberto = abertoId
    ? trabalhos.find((t) => t.id === abertoId) ?? null
    : null

  const total = trabalhos.length
  const pct = Math.min(100, Math.round((total / LIMITE_GRATIS) * 100))
  const corBarra = pct >= 90 ? 'var(--caramelo)' : 'var(--framboesa)'

  function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setArquivo(f)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(f))
  }

  function fecharForm() {
    setFormAberto(false)
    setArquivo(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setDescricao('')
    setTagsSelecionadas([])
    setNovaTagTexto('')
  }

  async function aoEnviar() {
    if (!arquivo) return avisar('Escolha uma foto primeiro')
    const erro = await adicionar(arquivo, descricao, tagsSelecionadas)
    if (erro) avisar(erro)
    else {
      avisar('Trabalho guardado ✓')
      fecharForm()
    }
  }

  function toggleTagForm(id: string) {
    setTagsSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function aoAdicionarNovaTag() {
    if (!novaTagTexto.trim()) return
    const tag = await criarTag(novaTagTexto)
    if (tag && !tagsSelecionadas.includes(tag.id))
      setTagsSelecionadas((prev) => [...prev, tag.id])
    setNovaTagTexto('')
  }

  async function aoRemover(t: Trabalho) {
    const erro = await remover(t)
    avisar(erro ?? 'Foto removida')
  }

  async function aoAlternarVitrine(t: Trabalho) {
    const erro = await alternarVitrine(t)
    if (erro) avisar(erro)
    else avisar(t.na_vitrine ? 'Removido da vitrine' : 'Adicionado à vitrine ✓')
  }

  if (carregando) return null

  return (
    <div className="tela">
      <BarraTopo titulo="Meus trabalhos" />
      <div className="conteudo">

        {/* Contador + barra de progresso */}
        <div className="contador-acervo">
          <div className="contador-texto">
            <span className="contador-num">{total}</span>
            <span className="contador-desc">
              {' '}foto{total !== 1 ? 's' : ''} · limite do plano Grátis: {LIMITE_GRATIS}
            </span>
          </div>
          <div className="contador-barra">
            <div
              className="contador-progresso"
              style={{ width: `${pct}%`, background: corBarra }}
            />
          </div>
        </div>

        {/* Busca por legenda */}
        <div className="busca" style={{ marginTop: 12 }}>
          🔎
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por legenda…"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--cacau-claro)', fontSize: 16, lineHeight: 1,
              }}
              aria-label="Limpar busca"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filtros por tag */}
        {todasTags.length > 0 && (
          <div className="filtros">
            <button
              className={`filtro${!tagFiltro ? ' ativo' : ''}`}
              onClick={() => setTagFiltro(null)}
            >
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

        {/* Grade de trabalhos */}
        {filtrados.length === 0 ? (
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone">📸</div>
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
                onAbrir={() => setAbertoId(t.id)}
                onRemover={() => aoRemover(t)}
                onAlternarVitrine={() => aoAlternarVitrine(t)}
              />
            ))}
          </div>
        )}

        {/* Formulário de adição (inline, aparece ao clicar no CTA) */}
        {formAberto && (
          <div className="form-acervo">
            <div className="form-acervo-titulo">Guardar um trabalho</div>

            {/* Seletor de foto */}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={aoEscolher}
            />
            <div
              className="foto-seletor"
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
              aria-label="Escolher foto"
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview da foto selecionada"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }}
                />
              ) : (
                <>
                  <div style={{ fontSize: 36 }}>📷</div>
                  <div className="foto-seletor-texto">Toque para escolher a foto</div>
                </>
              )}
            </div>

            {/* Legenda */}
            <div className="campo" style={{ marginTop: 14 }}>
              <label>Legenda (opcional)</label>
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: Bolo de casamento 3 andares"
                maxLength={80}
              />
            </div>

            {/* Tags — aqui o verde = "vai entrar nesta foto ao guardar" */}
            <div className="campo">
              <label>Tags (toque para escolher)</label>
              {todasTags.length > 0 && (
                <div className="tags-area" style={{ marginBottom: 8, padding: '0 0 2px' }}>
                  {todasTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      className={`tag-chip${tagsSelecionadas.includes(tag.id) ? ' selecionada' : ''}`}
                      onClick={() => toggleTagForm(tag.id)}
                    >
                      {tagsSelecionadas.includes(tag.id) ? '✓ ' : ''}{tag.nome}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={novaTagTexto}
                  onChange={(e) => setNovaTagTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      aoAdicionarNovaTag()
                    }
                  }}
                  placeholder="Nova tag… Enter para criar"
                  style={{
                    flex: 1, minHeight: 44, padding: '10px 14px',
                    border: '1px solid var(--linha)', borderRadius: 12,
                    font: 'inherit', fontSize: 'var(--t-base)', outline: 'none',
                    background: 'var(--acucar)', color: 'var(--cacau)',
                  }}
                />
                <button
                  type="button"
                  onClick={aoAdicionarNovaTag}
                  style={{
                    height: 44, padding: '0 16px', border: '1px solid var(--linha)',
                    borderRadius: 12, background: 'var(--pistache-suave)',
                    color: 'var(--pistache)', fontWeight: 700, cursor: 'pointer', fontSize: 18,
                  }}
                >
                  ＋
                </button>
              </div>
            </div>

            {/* Ações do form */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                onClick={fecharForm}
                className="btn-secundario"
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={aoEnviar}
                disabled={enviando || !arquivo}
                className="cta"
                style={{ flex: 2, height: 48 }}
              >
                {enviando ? 'Enviando…' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {!formAberto && (
        <div className="cta-area">
          <button className="cta" onClick={() => setFormAberto(true)}>
            ＋ Guardar um trabalho
          </button>
        </div>
      )}

      {/* Painel de detalhe/tags — fora do fluxo da grade */}
      {trabalhoAberto && (
        <PainelTrabalho
          trabalho={trabalhoAberto}
          todasTags={todasTags}
          onFechar={() => setAbertoId(null)}
          onAtribuirTag={atribuirTag}
          onRemoverTag={removerTag}
          onCriarTag={criarTag}
        />
      )}
    </div>
  )
}

