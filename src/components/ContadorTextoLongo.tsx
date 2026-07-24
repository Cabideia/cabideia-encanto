/**
 * UX-023 · Contador de caracteres dos campos de texto longo (descrição e
 * condições da proposta, detalhes do pedido).
 *
 * As colunas são `text` — não há teto físico no banco; o antigo limite de
 * 2.000 caracteres era só da UI e foi removido (supersede Decisão #34 /
 * BUG-012). O contador é apenas informativo (sem "/limite") e, acima de ~5.000
 * caracteres, mostra um aviso suave e NÃO bloqueante: nada trunca, nada impede
 * de salvar — só lembra que texto muito longo fica difícil de ler no celular
 * da cliente.
 */
const AVISO_TEXTO_LONGO = 5000

export function ContadorTextoLongo({ atual }: { atual: number }) {
  const longoDemais = atual > AVISO_TEXTO_LONGO
  return (
    <div
      className="apoio"
      style={{ textAlign: 'right', marginTop: 4, ...(longoDemais ? { color: 'var(--caramelo)' } : null) }}
      aria-live={longoDemais ? 'polite' : undefined}
    >
      {atual} {atual === 1 ? 'caractere' : 'caracteres'}
      {longoDemais && (
        <span style={{ display: 'block', marginTop: 2 }}>
          Texto muito longo fica difícil de ler no celular da cliente.
        </span>
      )}
    </div>
  )
}
