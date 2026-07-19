/**
 * M-050 · Códigos da cliente — parser tolerante do que chega pelo WhatsApp.
 *
 * A cliente marca 🤍 nas fotos (vitrine/proposta) e manda os códigos no zap
 * (M-049); a doceira cola/digita aqui. Aceita variações comuns: "A-37",
 * "a37", "i 12", "I-12" e "#37" (sem prefixo = trabalho, o caso da vitrine).
 * Deduplica preservando a ordem digitada.
 */
export type CodigoRef = { tipo: 't' | 'i'; num: number }

export function extrairCodigos(texto: string): CodigoRef[] {
  const vistos = new Set<string>()
  const saida: CodigoRef[] = []
  const re = /([aAiI])\s*-?\s*(\d{1,5})|#\s*(\d{1,5})/g
  let m: RegExpExecArray | null
  while ((m = re.exec(texto))) {
    const tipo: 't' | 'i' = m[1] && m[1].toLowerCase() === 'i' ? 'i' : 't'
    const num = parseInt(m[2] ?? m[3], 10)
    if (!Number.isFinite(num)) continue
    const chave = `${tipo}${num}`
    if (!vistos.has(chave)) {
      vistos.add(chave)
      saida.push({ tipo, num })
    }
  }
  return saida
}
