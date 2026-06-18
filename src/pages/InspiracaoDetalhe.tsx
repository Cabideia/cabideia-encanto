import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Confirmar } from '../components/Confirmar'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useInspiracoes, dominioDe } from '../hooks/useInspiracoes'
import type { Tag } from '../hooks/useAcervo'

/**
 * M-007 · Detalhe da inspiração.
 * Imagem em tela cheia, ou card de link (domínio + nota) que abre a URL no
 * navegador. Tags editáveis num bottom sheet (mesmo padrão do acervo).
 */
export function InspiracaoDetalhe() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { sessao } = useSessao()
  const avisar = useAviso()

  const {
    carregando,
    todasTags,
    buscarPorId,
    excluir,
    criarTag,
    atribuirTag,
    removerTag,
  } = useInspiracoes(sessao?.user.id)

  const insp = id ? buscarPorId(id) : undefined

  const [tagsAbertas, setTagsAbertas] = useState(false)
  const [aExcluir, setAExcluir] = useState(false)

  if (carregando) return null

  if (!insp) {
    return (
      <div className="tela">
        <BarraTopo titulo="Inspiração" />
        <div className="conteudo">
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="busca" size={44} /></div>
            <p>Esta inspiração não foi encontrada.</p>
          </div>
        </div>
      </div>
    )
  }

  function abrirLink() {
    if (insp!.url) window.open(insp!.url, '_blank', 'noopener')
  }

  async function confirmarExcluir() {
    const erro = await excluir(insp!)
    if (erro) {
      avisar(erro)
      setAExcluir(false)
      return
    }
    avisar('Inspiração excluída')
    navegar('/inspiracoes', { replace: true })
  }

  return (
    <div className="tela">
      <BarraTopo
        titulo="Inspiração"
        acao={
          <button
            className="btn-icone"
            onClick={() => navegar(`/inspiracoes/${insp.id}/editar`)}
            aria-label="Editar inspiração"
          >
            <Icone nome="editar" />
          </button>
        }
      />

      <div className="conteudo">
        {insp.codigo_num != null && (
          <div className="cod-linha" style={{ marginBottom: 10 }}>
            Código <b>I-{insp.codigo_num}</b>
          </div>
        )}

        {/* Imagem em tela cheia */}
        {insp.tipo === 'imagem' && insp.fotoUrl && (
          <img
            src={insp.fotoUrl}
            alt={insp.nota ?? 'Inspiração'}
            style={{ width: '100%', borderRadius: 'var(--raio-card)', display: 'block', border: '1px solid var(--linha)' }}
          />
        )}

        {/* Link: capa (se houver) + card de domínio que abre a URL */}
        {insp.tipo === 'link' && insp.url && (
          <>
            {insp.fotoUrl && (
              <img
                src={insp.fotoUrl}
                alt="Capa do link"
                onClick={abrirLink}
                style={{ width: '100%', borderRadius: 'var(--raio-card)', display: 'block', border: '1px solid var(--linha)', cursor: 'pointer', marginBottom: 12 }}
              />
            )}
            <button
              type="button"
              className="card card-toque"
              onClick={abrirLink}
              style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
            >
              <div className="card-linha">
                <div className="bola" aria-hidden><Icone nome="link" size={18} /></div>
                <div className="card-info">
                  <div className="card-nome">{dominioDe(insp.url)}</div>
                  <div className="apoio">Toque para abrir no navegador</div>
                </div>
                <span aria-hidden>›</span>
              </div>
            </button>
          </>
        )}

        {/* Nota */}
        {insp.nota && (
          <p style={{ marginTop: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{insp.nota}</p>
        )}

        {/* Tags */}
        <div className="secao"><span className="confeito" /><h2>Tags</h2></div>
        {insp.tags.length > 0 ? (
          <div className="tags-area">
            {insp.tags.map((tag) => (
              <span key={tag.id} className="tag-chip aplicada">{tag.nome}</span>
            ))}
          </div>
        ) : (
          <p className="apoio">Nenhuma tag ainda. Adicione para achar essa inspiração depois.</p>
        )}
        <button
          type="button"
          className="btn-secundario"
          style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
          onClick={() => setTagsAbertas(true)}
        >
          <Icone nome="tags" size={16} /> Editar tags
        </button>

        {/* Excluir */}
        <button
          className="btn-secundario"
          style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
          onClick={() => setAExcluir(true)}
        >
          <Icone nome="lixo" size={16} /> Excluir inspiração
        </button>
      </div>

      {/* Bottom sheet de tags (mesmo padrão do acervo) */}
      {tagsAbertas && (
        <PainelTags
          tagsAplicadas={insp.tags}
          todasTags={todasTags}
          onFechar={() => setTagsAbertas(false)}
          onAtribuir={(tagId) => atribuirTag(insp.id, tagId)}
          onRemover={(tagId) => removerTag(insp.id, tagId)}
          onCriar={criarTag}
        />
      )}

      {aExcluir && (
        <Confirmar
          titulo="Excluir esta inspiração?"
          descricao="Esta ação não pode ser desfeita."
          rotuloConfirmar="Excluir inspiração"
          onConfirmar={confirmarExcluir}
          onCancelar={() => setAExcluir(false)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Bottom sheet de tags — espelha o painel de tags do acervo.
// ─────────────────────────────────────────────────────────
type PainelTagsProps = {
  tagsAplicadas: Tag[]
  todasTags: Tag[]
  onFechar: () => void
  onAtribuir: (tagId: string) => Promise<void>
  onRemover: (tagId: string) => Promise<void>
  onCriar: (nome: string) => Promise<Tag | null>
}

function PainelTags({
  tagsAplicadas,
  todasTags,
  onFechar,
  onAtribuir,
  onRemover,
  onCriar,
}: PainelTagsProps) {
  const [texto, setTexto] = useState('')

  const disponiveis = todasTags.filter((t) => !tagsAplicadas.some((tg) => tg.id === t.id))
  const sugestoes = disponiveis.filter((t) => !texto || t.nome.includes(texto.toLowerCase()))
  const podeCriar =
    !!texto.trim() && !todasTags.some((t) => t.nome === texto.trim().toLowerCase())

  async function adicionar(tagId: string) {
    await onAtribuir(tagId)
    setTexto('')
  }
  async function criarEAdicionar() {
    if (!texto.trim()) return
    const tag = await onCriar(texto)
    if (tag) await onAtribuir(tag.id)
    setTexto('')
  }

  return (
    <div className="painel-overlay" onClick={onFechar}>
      <div className="painel" onClick={(e) => e.stopPropagation()}>
        <div className="painel-puxador" />
        <button className="painel-fechar" onClick={onFechar} aria-label="Fechar"><Icone nome="fechar" size={16} /></button>

        <div className="painel-secao" style={{ marginTop: 0 }}>Tags desta inspiração</div>
        {tagsAplicadas.length > 0 ? (
          <div className="tags-area">
            {tagsAplicadas.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="tag-chip aplicada"
                onClick={() => onRemover(tag.id)}
                title="Toque para tirar esta tag"
              >
                {tag.nome} <Icone nome="fechar" size={13} />
              </button>
            ))}
          </div>
        ) : (
          <p className="apoio" style={{ padding: '2px 2px 4px' }}>
            Nenhuma tag ainda. Adicione abaixo para achar essa inspiração depois.
          </p>
        )}

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
              <button key={t.id} type="button" className="tag-chip" onClick={() => adicionar(t.id)}>
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
