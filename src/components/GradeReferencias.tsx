import { Icone } from './Icone'
import { dominioDe, type Inspiracao } from '../hooks/useInspiracoes'
import type { Trabalho } from '../hooks/useAcervo'

/**
 * R2b (UX-024/UX-029) · Grade de referências compartilhada.
 *
 * Uma referência aponta para um TRABALHO ou uma INSPIRAÇÃO (padrão M-042 I5);
 * este componente só desenha — resolver as origens e decidir o que acontece no
 * toque é de quem chama. Usado no PedidoForm (edição, com ×), no PedidoDetalhe
 * (prévia de 4) e na GaleriaReferencias (2 colunas + zoom). O PropostaForm
 * mantém a própria cópia por ora (fora do escopo da R2b — dívida registrada).
 */

/** Referência mínima que a grade precisa (PedidoReferencia satisfaz). */
export type RefDaGrade = {
  id: string
  origem: 'trabalho' | 'inspiracao'
  trabalho_id: string | null
  inspiracao_id: string | null
}

/** Modelo visual de uma referência com a origem já resolvida. */
export type RefVisual = {
  refId: string
  origem: 'trabalho' | 'inspiracao'
  /** URL da imagem (null → é um link sem capa: mostra o cartão de link). */
  url: string | null
  /** Selo A-{n} / I-{n} (null → sem selo). */
  codigo: string | null
  /** Legenda curta sob a foto (nota da inspiração). */
  legenda: string | null
  /** Domínio exibido no cartão de link (só quando url === null). */
  linkDominio: string | null
  /** URL externa do link da inspiração (para abrir no navegador). */
  linkExterno: string | null
  /** Rota interna da origem (acervo/inspiração). */
  rotaOrigem: string
}

/**
 * Cruza as referências com os acervos e devolve os modelos visuais, na ordem
 * recebida. Origem que não carregou/foi excluída é omitida (mesmo comportamento
 * do detalhe do pedido: `find` falhou → não renderiza).
 */
export function resolverReferencias(
  referencias: RefDaGrade[],
  trabalhos: Trabalho[],
  inspiracoes: Inspiracao[]
): RefVisual[] {
  const saida: RefVisual[] = []
  for (const r of referencias) {
    if (r.origem === 'trabalho') {
      const t = trabalhos.find((x) => x.id === r.trabalho_id)
      if (!t) continue
      saida.push({
        refId: r.id,
        origem: 'trabalho',
        url: t.url,
        codigo: t.codigo_num != null ? `A-${t.codigo_num}` : null,
        legenda: null,
        linkDominio: null,
        linkExterno: null,
        rotaOrigem: `/acervo?t=${t.id}`,
      })
      continue
    }
    const insp = inspiracoes.find((x) => x.id === r.inspiracao_id)
    if (!insp) continue
    saida.push({
      refId: r.id,
      origem: 'inspiracao',
      url: insp.fotoUrl ?? null,
      codigo: insp.codigo_num != null ? `I-${insp.codigo_num}` : null,
      legenda: insp.nota ?? null,
      linkDominio: insp.url ? dominioDe(insp.url) : null,
      linkExterno: insp.url ?? null,
      rotaOrigem: `/inspiracoes/${insp.id}`,
    })
  }
  return saida
}

type Props = {
  itens: RefVisual[]
  /** Colunas da grade (a `grade-fotos` padrão tem 3; a galeria usa 2). */
  colunas?: number
  /** Toque na foto/cartão. */
  aoTocar: (rv: RefVisual) => void
  /** Presente → cada item ganha o × (desvincular); ausente → sem ×. */
  aoRemover?: (rv: RefVisual) => void
}

export function GradeReferencias({ itens, colunas, aoTocar, aoRemover }: Props) {
  if (itens.length === 0) return null
  return (
    <div
      className="grade-fotos"
      style={{
        alignItems: 'start',
        ...(colunas ? { gridTemplateColumns: `repeat(${colunas}, 1fr)` } : null),
      }}
    >
      {itens.map((rv) => (
        <div className="foto-item" key={rv.refId}>
          <div
            className="acervo-img-wrap"
            role="button"
            tabIndex={0}
            onClick={() => aoTocar(rv)}
            onKeyDown={(e) => e.key === 'Enter' && aoTocar(rv)}
          >
            {rv.url ? (
              <img src={rv.url} alt={rv.legenda ?? ''} loading="lazy" />
            ) : (
              <div className="insp-link-capa">
                <span className="insp-link-emoji" aria-hidden>
                  <Icone nome="link" size={30} />
                </span>
                <span className="insp-link-dominio">{rv.linkDominio ?? 'link'}</span>
              </div>
            )}
            {rv.codigo && (
              <span className="cod-selo" aria-label={`Código ${rv.codigo}`}>
                {rv.codigo}
              </span>
            )}
            {aoRemover && (
              <button
                className="foto-remover"
                onClick={(e) => {
                  e.stopPropagation()
                  aoRemover(rv)
                }}
                aria-label="Tirar esta referência do pedido"
              >
                <Icone nome="fechar" size={15} />
              </button>
            )}
          </div>
          {rv.legenda && <div className="foto-legenda">{rv.legenda}</div>}
        </div>
      ))}
    </div>
  )
}
