import { useRef, useState } from 'react'
import { BarraTopo } from '../components/BarraTopo'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useAcervo, type Tag, type Trabalho } from '../hooks/useAcervo'

const LIMITE_GRATIS = 150

// ─────────────────────────────────────────────────────────
// Cartão individual de um trabalho no acervo
// ─────────────────────────────────────────────────────────
type CartaoProps = {
  trabalho: Trabalho
  todasTags: Tag[]
  onRemover: () => void
  onAlternarVitrine: () => void
  onAtribuirTag: (trabalhoId: string, tagId: string) => Promise<void>
  onRemoverTag: (trabalhoId: string, tagId: string) => Promise<void>
  onCriarTag: (nome: string) => Promise<Tag | null>
}

function CartaoTrabalho({
  trabalho,
  todasTags,
  onRemover,
  onAlternarVitrine,
  onAtribuirTag,
  onRemoverTag,
  onCriarTag,
}: CartaoProps) {
  const [adderAberto, setAdderAberto] = useState(false)
  const [textoTag, setTextoTag] = useState('')

  const disponiveis = todasTags.filter(
    (t) => !trabalho.tags.some((tg) => tg.id === t.id)
  )
  const sugestoes = disponiveis.filter(
    (t) => !textoTag || t.nome.includes(textoTag.toLowerCase())
  )

  async function aoSelecionarTag(tagId: string) {
    await onAtribuirTag(trabalho.id, tagId)
    setAdderAberto(false)
    setTextoTag('')
  }

  async function aoCriarESelecionarTag() {
    if (!textoTag.trim()) return
    const tag = await onCriarTag(textoTag)
    if (tag) await onAtribuirTag(trabalho.id, tag.id)
    setAdderAberto(false)
    setTextoTag('')
  }

  return (
    <div>
      {/* Imagem com botões sobrepostos */}
      <div className="acervo-img-wrap">
        <img src={trabalho.url} alt={trabalho.descricao ?? ''} loading="lazy" />
        <button
          className={`foto-vitrine-btn${trabalho.na_vitrine ? ' ativa' : ''}`}
          onClick={onAlternarVitrine}
          aria-label={trabalho.na_vitrine ? 'Remover da vitrine' : 'Adicionar à vitrine'}
          title={trabalho.na_vitrine ? 'Na vitrine — toque para retirar' : 'Toque para mostrar na vitrine'}
        >
          🛍️
        </button>
        <button className="foto-remover" onClick={onRemover} aria-label="Remover foto">
          ✕
        </button>
      </div>

      {/* Rodapé: legenda + tags + adder */}
      <div className="acervo-rodape">
        {trabalho.descricao && (
          <div className="foto-legenda">{trabalho.descricao}</div>
        )}

        {trabalho.tags.length > 0 && (
          <div className="tags-area">
            {trabalho.tags.map((tag) => (
              <button
                key={tag.id}
                className="tag-chip"
                type="button"
                onClick={() => onRemoverTag(trabalho.id, tag.id)}
                title="Toque para remover"
              >
                {tag.nome} ×
              </button>
            ))}
          </div>
        )}

        {adderAberto ? (
          <div className="tag-adder">
            <input
              autoFocus
              value={textoTag}
              onChange={(e) => setTextoTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (sugestoes.length > 0) aoSelecionarTag(sugestoes[0].id)
                  else if (textoTag.trim()) aoCriarESelecionarTag()
                }
                if (e.key === 'Escape') {
                  setAdderAberto(false)
                  setTextoTag('')
                }
              }}
              placeholder="tag…"
            />
            {sugestoes.length > 0 && (
              <div className="tag-sugestoes">
                {sugestoes.slice(0, 4).map((t) => (
                  <button key={t.id} type="button" onClick={() => aoSelecionarTag(t.id)}>
                    {t.nome}
                  </button>
                ))}
              </div>
            )}
            {textoTag && !sugestoes.find((t) => t.nome === textoTag.toLowerCase()) && (
              <button type="button" className="tag-criar" onClick={aoCriarESelecionarTag}>
                Criar "{textoTag}"
              </button>
            )}
            <button
              type="button"
              onClick={() => { setAdderAberto(false); setTextoTag('') }}
              className="tag-cancelar"
            >
              cancelar
            </button>
          </div>
        ) : (
          <button
            className="foto-add-tag"
            type="button"
            onClick={() => setAdderAberto(true)}
          >
            + tag
          </button>
        )}
      </div>
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
  const inputRef = useRef<HTMLInputElement>(null)

  // Filtragem local — sem roundtrip ao banco
  const filtrados = trabalhos.filter((t) => {
    const okTexto = !busca || t.descricao?.toLowerCase().includes(busca.toLowerCase())
    const okTag = !tagFiltro || t.tags.some((tg) => tg.id === tagFiltro)
    return okTexto && okTag
  })

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
                todasTags={todasTags}
                onRemover={() => aoRemover(t)}
                onAlternarVitrine={() => aoAlternarVitrine(t)}
                onAtribuirTag={atribuirTag}
                onRemoverTag={removerTag}
                onCriarTag={criarTag}
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

            {/* Tags */}
            <div className="campo">
              <label>Tags</label>
              {todasTags.length > 0 && (
                <div className="tags-area" style={{ marginBottom: 8 }}>
                  {todasTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      className={`tag-chip${tagsSelecionadas.includes(tag.id) ? ' selecionada' : ''}`}
                      onClick={() => toggleTagForm(tag.id)}
                    >
                      {tag.nome}
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
    </div>
  )
}

