import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { usePropostas } from '../hooks/usePropostas'
import { useCardapio, formatarReal } from '../hooks/useCardapio'
import { usePropostaItens, type NovoItemProposta } from '../hooks/usePropostaItens'

/**
 * M-042 F2a I3 · Picker de itens do cardápio para a proposta (rota
 * /propostas/:id/itens). Multi-seleção + "TRAZER TODOS". Cada item escolhido
 * vira uma linha em `proposta_itens` com SNAPSHOT (nome + preço COPIADOS do
 * cardápio agora — não relê o preço vivo depois). Volta ao form ao salvar.
 */
export function PropostaItens() {
  const { id } = useParams()
  const { sessao } = useSessao()
  const avisar = useAviso()
  const navegar = useNavigate()

  const { buscarPorId, carregando: carregandoPropostas } = usePropostas(sessao?.user.id)
  const { itens: cardapio, carregando: carregandoCardapio } = useCardapio(sessao?.user.id)
  const { itens: jaNaProposta, carregando: carregandoItens, salvando, adicionar } =
    usePropostaItens(sessao?.user.id, id)

  const proposta = id ? buscarPorId(id) : undefined

  // Ids do cardápio já ofertados nesta proposta somem da grade (a remoção fica no form).
  const jaTem = useMemo(() => {
    const s = new Set<string>()
    for (const it of jaNaProposta) if (it.cardapio_item_id) s.add(it.cardapio_item_id)
    return s
  }, [jaNaProposta])

  const disponiveis = cardapio.filter((c) => !jaTem.has(c.id))
  const [marcados, setMarcados] = useState<Set<string>>(new Set())

  function alternar(itemId: string) {
    setMarcados((prev) => {
      const n = new Set(prev)
      if (n.has(itemId)) n.delete(itemId)
      else n.add(itemId)
      return n
    })
  }

  function trazerTodos() {
    setMarcados(new Set(disponiveis.map((c) => c.id)))
  }

  async function aoAdicionar() {
    if (!id) return
    if (marcados.size === 0) return avisar('Escolha ao menos um item.')
    const novos: NovoItemProposta[] = disponiveis
      .filter((c) => marcados.has(c.id))
      .map((c) => ({
        cardapio_item_id: c.id,
        nome_snapshot: c.nome,
        preco_snapshot: c.preco_base,
      }))
    const erro = await adicionar(id, novos)
    if (erro) return avisar(erro)
    avisar(novos.length === 1 ? 'Item adicionado ✓' : `${novos.length} itens adicionados ✓`)
    navegar(`/propostas/${id}`, { replace: true })
  }

  if (carregandoPropostas || carregandoCardapio || carregandoItens) return null

  if (!id || !proposta) {
    return (
      <div className="tela">
        <BarraTopo titulo="Itens da proposta" />
        <div className="conteudo">
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="busca" size={44} /></div>
            <p>Esta proposta não foi encontrada.</p>
          </div>
        </div>
      </div>
    )
  }

  const qtd = marcados.size

  return (
    <div className="tela">
      <BarraTopo titulo="Escolher itens" />

      <div className="conteudo" style={{ paddingBottom: 96 }}>
        {cardapio.length === 0 ? (
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="precos" size={44} /></div>
            <p>Você ainda não tem itens no Cardápio. Cadastre lá para trazer aqui.</p>
            <button
              type="button"
              className="btn-secundario"
              style={{ marginTop: 12 }}
              onClick={() => navegar('/cardapio')}
            >
              <Icone nome="precos" size={16} /> Ir ao Cardápio
            </button>
          </div>
        ) : disponiveis.length === 0 ? (
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="ok" size={44} /></div>
            <p>Todos os itens do seu cardápio já estão nesta proposta.</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p className="apoio" style={{ margin: 0 }}>
                Toque para escolher. O preço é congelado agora.
              </p>
              <button type="button" className="tag-criar" onClick={trazerTodos}>
                Trazer todos
              </button>
            </div>

            <div className="lista">
              {disponiveis.map((c) => {
                const marcado = marcados.has(c.id)
                const preco =
                  c.preco_base != null
                    ? formatarReal(c.preco_base)
                    : c.preco_sob_consulta
                    ? 'sob consulta'
                    : 'sem preço'
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`linha-selecao${marcado ? ' marcado' : ''}`}
                    onClick={() => alternar(c.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 14px',
                      border: `1px solid ${marcado ? 'var(--framboesa)' : 'var(--linha)'}`,
                      borderRadius: 12,
                      background: marcado ? 'var(--framboesa-suave)' : 'var(--acucar)',
                      color: 'var(--cacau)',
                      marginBottom: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      className={`sel-check${marcado ? ' on' : ''}`}
                      aria-hidden
                      style={{ position: 'static', flexShrink: 0 }}
                    >
                      {marcado ? <Icone nome="ok" size={15} strokeWidth={3} /> : null}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, display: 'block' }}>{c.nome}</span>
                      {c.unidade && (
                        <span className="apoio" style={{ display: 'block' }}>por {c.unidade}</span>
                      )}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--framboesa)', flexShrink: 0 }}>{preco}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* CTA primário fixo */}
      <div className="cta-area">
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => navegar(`/propostas/${id}`, { replace: true })}
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
    </div>
  )
}
