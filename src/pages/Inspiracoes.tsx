import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Icone } from '../components/Icone'
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
            <span className="insp-link-emoji" aria-hidden><Icone nome="link" size={30} /></span>
            <span className="insp-link-dominio">{insp.url ? dominioDe(insp.url) : 'link'}</span>
          </div>
        )}
        {insp.codigo_num != null && (
          <span className="cod-selo" aria-label={`Código I-${insp.codigo_num}`}>
            I-{insp.codigo_num}
          </span>
        )}
        {insp.tipo === 'link' && (
          <span className="insp-selo-link" aria-hidden><Icone nome="link" size={14} /></span>
        )}
      </div>
      {insp.nota && <div className="foto-legenda">{insp.nota}</div>}
      {insp.tags.length > 0 && (
        <button className="acervo-selo-tags" onClick={onAbrir} type="button">
          <Icone nome="tags" size={13} /> {insp.tags.length} tag{insp.tags.length !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}

/** M-007 · Galeria de inspirações: imagens e links, com busca e filtro por tag. */
export function Inspiracoes() {
  const { sessao } = useSessao()
  const navegar = useNavigate()
  const [searchParams] = useSearchParams()
  const { inspiracoes, todasTags, carregando } = useInspiracoes(sessao?.user.id)

  const [busca, setBusca] = useState('')
  // M-040 · ?tag=<id> chega pré-ligado (é o "Ver inspirações do pedido").
  const [tagFiltro, setTagFiltro] = useState<string | null>(() => searchParams.get('tag'))

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
            <div className="icone" aria-hidden><Icone nome="inspiracoes" size={44} /></div>
            <p>Guarde imagens e links que te inspiram — e ache em segundos quando precisar.</p>
          </div>
        ) : (
          <>
            {/* Busca por nota */}
            <div className="busca" style={{ marginTop: 8 }}>
              <Icone nome="busca" size={18} />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nota…"
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
                <div className="icone"><Icone nome="busca" size={44} /></div>
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
          <Icone nome="mais" /> Nova inspiração
        </button>
      </div>
    </div>
  )
}
