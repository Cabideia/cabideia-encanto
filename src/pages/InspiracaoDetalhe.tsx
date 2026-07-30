import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { TelaCarregando } from '../components/TelaCarregando'
import { Confirmar } from '../components/Confirmar'
import { SeletorTag } from '../components/SeletorTag'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useInspiracoes, dominioDe } from '../hooks/useInspiracoes'

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

  if (carregando) return <TelaCarregando titulo="Inspiração" variante="formulario" />

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
                <Icone nome="avancar" />
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

      {/* Bottom sheet de tags — mesma folha do acervo, agora com o SeletorTag
          único no miolo de entrada (UX-038): a folha e os chips com ✕ ficam. */}
      {tagsAbertas && (
        <div className="painel-overlay" onClick={() => setTagsAbertas(false)}>
          <div className="painel" onClick={(e) => e.stopPropagation()}>
            <div className="painel-puxador" />
            <button className="painel-fechar" onClick={() => setTagsAbertas(false)} aria-label="Fechar"><Icone nome="fechar" size={16} /></button>

            <div className="painel-secao" style={{ marginTop: 0 }}>Tags desta inspiração</div>
            {insp.tags.length > 0 ? (
              <div className="tags-area">
                {insp.tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className="tag-chip aplicada"
                    onClick={() => removerTag(insp.id, tag.id)}
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
            <SeletorTag
              todasTags={todasTags}
              selecionadas={insp.tags.map((t) => t.id)}
              onSelecionar={(tag) => atribuirTag(insp.id, tag.id)}
              onCriar={criarTag}
              inputClassName="painel-input"
            />
          </div>
        </div>
      )}

      {/* UX-026 · exclusão REAL (M-051): a mesma verdade do Acervo. Só a imagem
          pode estar em links já enviados; a inspiração-link não tem essa parte. */}
      {aExcluir && (
        <Confirmar
          titulo={insp.tipo === 'imagem' ? 'Excluir esta foto?' : 'Excluir esta inspiração?'}
          descricao={
            insp.tipo === 'imagem'
              ? 'Ela sai também dos links já enviados às clientes.'
              : 'Esta ação não pode ser desfeita.'
          }
          rotuloConfirmar={insp.tipo === 'imagem' ? 'Excluir foto' : 'Excluir inspiração'}
          onConfirmar={confirmarExcluir}
          onCancelar={() => setAExcluir(false)}
        />
      )}
    </div>
  )
}
