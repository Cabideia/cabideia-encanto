import { useState } from 'react'
import { BarraTopo } from '../components/BarraTopo'
import { Confirmar } from '../components/Confirmar'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useAcervo, type TagComUso } from '../hooks/useAcervo'

/**
 * Tela "Minhas tags" (M-009 · refino).
 * Lista as tags com a contagem de uso; permite renomear (inline) e apagar
 * (com confirmação que avisa de quantas fotos a tag sairá).
 */
export function MinhasTags() {
  const { sessao } = useSessao()
  const avisar = useAviso()
  const { carregando, renomearTag, apagarTag, tagsComUso } = useAcervo(sessao?.user.id)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [aApagar, setAApagar] = useState<TagComUso | null>(null)

  const tags = tagsComUso()

  function iniciarEdicao(tag: TagComUso) {
    setEditandoId(tag.id)
    setTexto(tag.nome)
  }

  async function salvar(id: string) {
    const erro = await renomearTag(id, texto)
    if (erro) {
      avisar(erro)
      return
    }
    setEditandoId(null)
    setTexto('')
    avisar('Tag renomeada ✓')
  }

  async function confirmarApagar() {
    if (!aApagar) return
    const erro = await apagarTag(aApagar.id)
    avisar(erro ?? 'Tag apagada')
    setAApagar(null)
  }

  if (carregando) return null

  return (
    <div className="tela">
      <BarraTopo titulo="Minhas tags" />
      <div className="conteudo">
        <p className="apoio" style={{ marginBottom: 12 }}>
          As tags ajudam você a achar um trabalho em segundos. Renomeie ou apague aqui —
          a mudança vale para todas as fotos.
        </p>

        {tags.length === 0 ? (
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="tags" size={44} /></div>
            <p>Você ainda não criou tags. Crie ao guardar ou abrir um trabalho.</p>
          </div>
        ) : (
          <div className="lista card" style={{ padding: '4px 16px' }}>
            {tags.map((tag) => (
              <div className="item" key={tag.id} style={{ cursor: 'default' }}>
                {editandoId === tag.id ? (
                  <>
                    <input
                      autoFocus
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') salvar(tag.id)
                        if (e.key === 'Escape') { setEditandoId(null); setTexto('') }
                      }}
                      autoCapitalize="none"
                      style={{
                        flex: 1, minHeight: 40, padding: '8px 12px',
                        border: '1px solid var(--pistache)', borderRadius: 10,
                        font: 'inherit', fontSize: 'var(--t-base)', outline: 'none',
                        background: 'var(--acucar)', color: 'var(--cacau)',
                      }}
                    />
                    <button className="zap" onClick={() => salvar(tag.id)}>Salvar</button>
                    <button
                      className="btn-icone"
                      onClick={() => { setEditandoId(null); setTexto('') }}
                      aria-label="Cancelar edição"
                    >
                      <Icone nome="fechar" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="card-info">
                      <div className="card-nome" style={{ fontSize: 'var(--t-base)' }}>
                        {tag.nome}
                      </div>
                      <div className="apoio">
                        em {tag.uso} foto{tag.uso !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <button
                      className="btn-icone"
                      onClick={() => iniciarEdicao(tag)}
                      aria-label={`Renomear ${tag.nome}`}
                    >
                      <Icone nome="editar" />
                    </button>
                    <button
                      className="btn-icone"
                      onClick={() => setAApagar(tag)}
                      aria-label={`Apagar ${tag.nome}`}
                    >
                      <Icone nome="lixo" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {aApagar && (
        <Confirmar
          titulo={`Apagar “${aApagar.nome}”?`}
          descricao={
            aApagar.uso > 0
              ? `Esta tag será removida de ${aApagar.uso} foto${aApagar.uso !== 1 ? 's' : ''}. As fotos continuam guardadas — só perdem esta etiqueta.`
              : 'Esta tag não está em nenhuma foto.'
          }
          rotuloConfirmar="Apagar tag"
          onConfirmar={confirmarApagar}
          onCancelar={() => setAApagar(null)}
        />
      )}
    </div>
  )
}

