import { BarraTopo } from './BarraTopo'

type Variante = 'cartoes' | 'lista' | 'grade' | 'formulario'

type Props = {
  /** Título da BarraTopo. Omitir em uso embutido (painéis e folhas). */
  titulo?: string
  variante?: Variante
}

/**
 * UX-034 · Esqueleto de carregamento com variantes fixas (Decisão #82).
 * Nasce com a mesma estrutura da tela de cromo puro do app
 * (`.tela` › `BarraTopo` › `.conteudo` › bloco central) para não trocar
 * de forma quando o conteúdo real chega.
 *
 * - Com `titulo`: tela inteira (barra + conteúdo + esqueleto).
 * - Sem `titulo`: só o bloco de esqueleto (uso embutido em painéis/folhas,
 *   onde a barra/cabeçalho já está renderizado acima).
 */
export function TelaCarregando({ titulo, variante = 'lista' }: Props) {
  const esqueleto = (
    <div role="status" aria-label="Carregando">
      <Esqueleto variante={variante} />
    </div>
  )

  if (titulo === undefined) return esqueleto

  return (
    <div className="tela">
      <BarraTopo titulo={titulo} />
      <div className="conteudo sem-animacao">{esqueleto}</div>
    </div>
  )
}

/**
 * UX-034 · Esqueleto das 4 telas públicas (Decisão #94).
 * Preserva a FORMA do `.pub-cabecalho` (altura, avatar redondo, linha de
 * título, linha de subtítulo, babado) + 2 cards-fantasma, para que a chegada
 * do conteúdo real não produza salto de layout. Cor NEUTRA, sem tema: o tema
 * só chega na 1ª resposta da RPC (`aplicarTema` roda depois do dado), então
 * pintar aqui produziria flash de cor na primeira tela que a cliente vê.
 * Componente irmão — não uma variante nova — para não sobrecarregar a
 * assinatura de `TelaCarregando`, que já tem dois modos (Decisão #82).
 */
export function TelaCarregandoPublica() {
  return (
    <div className="tela">
      <div className="conteudo">
        <div role="status" aria-label="Carregando">
          <div className="pub-cabecalho-esq" aria-hidden="true">
            <div className="esqueleto pub-avatar-esq" />
            <div className="esqueleto pub-esq-titulo" />
            <div className="esqueleto pub-esq-sub" />
            <div className="babado-ondas" />
          </div>
          <div className="esqueleto pub-esq-card" aria-hidden="true" />
          <div className="esqueleto pub-esq-card" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}

function Esqueleto({ variante }: { variante: Variante }) {
  if (variante === 'cartoes') {
    return (
      <div aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="esqueleto-cartao">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="esqueleto" style={{ width: '55%', height: 16, marginBottom: 8 }} />
              <div className="esqueleto" style={{ width: '35%', height: 14 }} />
            </div>
            <div className="esqueleto-chip" />
          </div>
        ))}
      </div>
    )
  }

  if (variante === 'grade') {
    return (
      <div className="esqueleto-grade" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="esqueleto-quadro" />
        ))}
      </div>
    )
  }

  if (variante === 'formulario') {
    return (
      <div className="esqueleto-form" aria-hidden="true">
        <div className="esqueleto" style={{ width: '40%', height: 20, marginBottom: 16 }} />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div className="esqueleto" style={{ width: 90, height: 14, marginBottom: 6 }} />
            <div className="esqueleto-campo" />
          </div>
        ))}
      </div>
    )
  }

  // 'lista' (default)
  return (
    <div aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="esqueleto-linha">
          <div className="esqueleto-bola" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="esqueleto" style={{ width: '60%', height: 16, marginBottom: 8 }} />
            <div className="esqueleto" style={{ width: '40%', height: 14 }} />
          </div>
        </div>
      ))}
    </div>
  )
}
