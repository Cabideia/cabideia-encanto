import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useAcervo } from '../hooks/useAcervo'
import { useInspiracoes, dominioDe } from '../hooks/useInspiracoes'
import { usePedidos, tituloPedido } from '../hooks/usePedidos'
import { usePedidoReferencias, type NovaReferencia } from '../hooks/usePedidoReferencias'

/**
 * M-042 · Picker de referências de um pedido AVULSO (rota /pedidos/:id/referencias).
 *
 * Escolhe itens de Meus Trabalhos e/ou Inspirações e grava em `pedido_referencias`
 * (NÃO cria seleção pública). Volta ao detalhe ao salvar/cancelar (retorno-ao-pedido
 * do I6).
 *
 * DÍVIDA TÉCNICA (registrada por decisão da gestão): a grade/abas/checkbox de
 * seleção é REPLICADA aqui em vez de reusar os componentes inline do Acervo.tsx —
 * o Acervo é tela verificada e central (M-009) e não vale risco de regressão na
 * janela de teste. Extrair `CartaoSelecao`/`GradeSelecao` compartilhados quando
 * houver folga e então trocar as duas telas para o componente único.
 */
export function PedidoReferencias() {
  const { id } = useParams()
  const { sessao } = useSessao()
  const avisar = useAviso()
  const navegar = useNavigate()

  const { buscarPorId, carregando: carregandoPedidos } = usePedidos(sessao?.user.id)
  const { trabalhos, carregando: carregandoAcervo } = useAcervo(sessao?.user.id)
  const { inspiracoes } = useInspiracoes(sessao?.user.id)
  const { referencias, carregando: carregandoRefs, salvando, adicionar } =
    usePedidoReferencias(sessao?.user.id, id)

  const pedido = id ? buscarPorId(id) : undefined

  const [aba, setAba] = useState<'trabalhos' | 'inspiracoes'>('trabalhos')
  // Chaves prefixadas 't:<id>' / 'i:<id>' — mesmo padrão do Acervo.
  const [marcados, setMarcados] = useState<Set<string>>(new Set())

  // Itens que já são referência deste pedido saem da grade (só dá p/ adicionar
  // novos aqui; a remoção fica no detalhe). O hook ainda deduplica por garantia.
  const jaRef = useMemo(() => {
    const s = new Set<string>()
    for (const r of referencias)
      s.add(r.trabalho_id ? `t:${r.trabalho_id}` : `i:${r.inspiracao_id}`)
    return s
  }, [referencias])

  const trabalhosDisponiveis = trabalhos.filter((t) => !jaRef.has(`t:${t.id}`))
  const inspDisponiveis = inspiracoes.filter((i) => !jaRef.has(`i:${i.id}`))

  function alternar(chave: string) {
    setMarcados((prev) => {
      const n = new Set(prev)
      if (n.has(chave)) n.delete(chave)
      else n.add(chave)
      return n
    })
  }

  async function aoAdicionar() {
    if (!id) return
    if (marcados.size === 0) return avisar('Escolha ao menos uma referência.')
    const itens: NovaReferencia[] = Array.from(marcados).map((chave) =>
      chave.startsWith('i:')
        ? { origem: 'inspiracao', id: chave.slice(2) }
        : { origem: 'trabalho', id: chave.slice(2) }
    )
    const erro = await adicionar(id, itens)
    if (erro) return avisar(erro)
    avisar(
      itens.length === 1 ? 'Referência adicionada ✓' : `${itens.length} referências adicionadas ✓`
    )
    navegar(`/pedidos/${id}`, { replace: true })
  }

  if (carregandoPedidos || carregandoAcervo || carregandoRefs) return null

  if (!id || !pedido) {
    return (
      <div className="tela">
        <BarraTopo titulo="Referências" />
        <div className="conteudo">
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="busca" size={44} /></div>
            <p>Este pedido não foi encontrado.</p>
          </div>
        </div>
      </div>
    )
  }

  const qtd = marcados.size

  return (
    <div className="tela">
      <BarraTopo titulo="Selecionar referências" />

      <div className="conteudo" style={{ paddingBottom: 96 }}>
        <p className="apoio" style={{ marginBottom: 8 }}>
          Escolha fotos de Meus Trabalhos e/ou Inspirações como referência de
          “{tituloPedido(pedido)}”. Elas ficam guardadas no pedido — sem criar link.
        </p>

        <div className="escolha" style={{ marginBottom: 4 }}>
          <button
            type="button"
            className={`filtro${aba === 'trabalhos' ? ' ativo' : ''}`}
            onClick={() => setAba('trabalhos')}
          >
            <Icone nome="trabalhos" size={15} /> Meus Trabalhos
          </button>
          <button
            type="button"
            className={`filtro${aba === 'inspiracoes' ? ' ativo' : ''}`}
            onClick={() => setAba('inspiracoes')}
          >
            <Icone nome="inspiracoes" size={15} /> Inspirações
          </button>
        </div>

        {aba === 'trabalhos' ? (
          trabalhosDisponiveis.length === 0 ? (
            <div className="vazio" style={{ marginTop: 16 }}>
              <div className="icone"><Icone nome="trabalhos" size={44} /></div>
              <p>
                {trabalhos.length === 0
                  ? 'Você ainda não tem trabalhos no acervo.'
                  : 'Todos os seus trabalhos já são referência deste pedido.'}
              </p>
            </div>
          ) : (
            <div className="grade-fotos" style={{ marginTop: 12, alignItems: 'start' }}>
              {trabalhosDisponiveis.map((t) => {
                const marcado = marcados.has(`t:${t.id}`)
                return (
                  <div className={`foto-item${marcado ? ' marcado' : ''}`} key={t.id}>
                    <div
                      className="acervo-img-wrap"
                      role="button"
                      tabIndex={0}
                      onClick={() => alternar(`t:${t.id}`)}
                      onKeyDown={(e) => e.key === 'Enter' && alternar(`t:${t.id}`)}
                    >
                      <img src={t.url} alt={t.descricao ?? ''} loading="lazy" />
                      {t.codigo_num != null && (
                        <span className="cod-selo" aria-label={`Código A-${t.codigo_num}`}>
                          A-{t.codigo_num}
                        </span>
                      )}
                      <span className={`sel-check${marcado ? ' on' : ''}`} aria-hidden>
                        {marcado ? <Icone nome="ok" size={15} strokeWidth={3} /> : null}
                      </span>
                    </div>
                    {t.descricao && <div className="foto-legenda">{t.descricao}</div>}
                  </div>
                )
              })}
            </div>
          )
        ) : inspDisponiveis.length === 0 ? (
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="inspiracoes" size={44} /></div>
            <p>
              {inspiracoes.length === 0
                ? 'Você ainda não guardou inspirações.'
                : 'Todas as suas inspirações já são referência deste pedido.'}
            </p>
          </div>
        ) : (
          <div className="grade-fotos" style={{ marginTop: 12, alignItems: 'start' }}>
            {inspDisponiveis.map((i) => {
              const marcado = marcados.has(`i:${i.id}`)
              return (
                <div className={`foto-item${marcado ? ' marcado' : ''}`} key={i.id}>
                  <div
                    className="acervo-img-wrap"
                    role="button"
                    tabIndex={0}
                    onClick={() => alternar(`i:${i.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && alternar(`i:${i.id}`)}
                  >
                    {i.fotoUrl ? (
                      <img src={i.fotoUrl} alt={i.nota ?? ''} loading="lazy" />
                    ) : (
                      <div className="insp-link-capa">
                        <span className="insp-link-emoji" aria-hidden><Icone nome="link" size={30} /></span>
                        <span className="insp-link-dominio">{i.url ? dominioDe(i.url) : 'link'}</span>
                      </div>
                    )}
                    {i.codigo_num != null && (
                      <span className="cod-selo" aria-label={`Código I-${i.codigo_num}`}>
                        I-{i.codigo_num}
                      </span>
                    )}
                    <span className={`sel-check${marcado ? ' on' : ''}`} aria-hidden>
                      {marcado ? <Icone nome="ok" size={15} strokeWidth={3} /> : null}
                    </span>
                  </div>
                  {i.nota && <div className="foto-legenda">{i.nota}</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* CTA primário fixo */}
      <div className="cta-area">
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => navegar(`/pedidos/${id}`)}
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
