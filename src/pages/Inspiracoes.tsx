import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { useSessao } from '../hooks/useSessao'
import { useInspiracoes, dominioDe, type Inspiracao } from '../hooks/useInspiracoes'

/** Cartão da grade: imagem, ou link (capa se houver, senão domínio). */
function Cartao({ insp, onAbrir }: { insp: Inspiracao; onAbrir: () => void }) {
  return (
    <div className="foto-item">
      <div
        className="acervo-img-wrap"
        onClick={onAbrir}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onAbrir()}
      >
        {insp.fotoUrl ? (
          <img src={insp.fotoUrl} alt={insp.nota ?? ''} loading="lazy" />
        ) : (
          <div className="insp-link-capa">
            <span className="insp-link-emoji" aria-hidden>🔗</span>
            <span className="insp-link-dominio">{insp.url ? dominioDe(insp.url) : 'link'}</span>
          </div>
        )}
        {insp.tipo === 'link' && (
          <span className="insp-selo-link" aria-hidden>🔗</span>
        )}
      </div>
      {insp.nota && <div className="foto-legenda">{insp.nota}</div>}
      {insp.tags.length > 0 && (
        <button className="acervo-selo-tags" onClick={onAbrir} type="button">
          🏷️ {insp.tags.length} tag{insp.tags.length !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}

/** M-007 · Galeria de inspirações: imagens e links, com busca e filtro por tag. */
export function Inspiracoes() {
  const { sessao } = useSessao()
  const navegar = useNavigate()
  const { inspiracoes, todasTags, carregando } = useInspiracoes(sessao?.user.id)

  const [busca, setBusca] = useState('')
  const [tagFiltro, setTagFiltro] = useState<string | null>(null)

  const filtradas = inspiracoes.filter((i) => {
    const okTexto = !busca || i.nota?.toLowerCase().includes(busca.toLowerCase())
    const okTag = !tagFiltro || i.tags.some((tg) => tg.id === tagFiltro)
    return okTexto && okTag
  })

  if (carregando) return null

  const vazioTotal = inspiracoes.length === 0

  return (
    <div className="tela">
      <BarraTopo titulo="Inspirações" />
      <div className="conteudo">
        {vazioTotal ? (
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone" aria-hidden>💡</div>
            <p>Guarde imagens e links que te inspiram — e ache em segundos quando precisar.</p>
          </div>
        ) : (
          <>
            {/* Busca por nota */}
            <div className="busca" style={{ marginTop: 8 }}>
              🔎
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nota…"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cacau-claro)', fontSize: 16, lineHeight: 1 }}
                  aria-label="Limpar busca"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filtro por tag (mesmo padrão do acervo) */}
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

            {/* Grade */}
            {filtradas.length === 0 ? (
              <div className="vazio" style={{ marginTop: 16 }}>
                <div className="icone">🔍</div>
                <p>Nenhuma inspiração encontrada com esse filtro.</p>
              </div>
            ) : (
              <div className="grade-fotos" style={{ marginTop: 12, alignItems: 'start' }}>
                {filtradas.map((i) => (
                  <Cartao key={i.id} insp={i} onAbrir={() => navegar(`/inspiracoes/${i.id}`)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* CTA primário fixo */}
      <div className="cta-area">
        <button className="cta" onClick={() => navegar('/inspiracoes/nova')}>
          ＋ Nova inspiração
        </button>
      </div>
    </div>
  )
}
