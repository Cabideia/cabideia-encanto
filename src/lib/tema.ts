/**
 * Identidade visual multi-nicho (Decisão #9).
 *
 * O tema é só um atributo `data-tema` no <html>; os tokens de cor já vivem em
 * tokens.css por tema. Aqui a gente: aplica o atributo, persiste em localStorage
 * (para abrir já pintado — inclusive OFFLINE, M-023) e mantém a <meta theme-color>
 * coerente com o fundo do tema.
 */

export type Tema = 'oficina' | 'vitrine' | 'encanto'

export const TEMAS: Tema[] = ['oficina', 'vitrine', 'encanto']

export const ROTULO_TEMA: Record<Tema, string> = {
  oficina: 'Oficina',
  vitrine: 'Vitrine',
  encanto: 'Encanto',
}

const CHAVE = 'cabideia:tema'

/** Normaliza qualquer valor (nulo/legado/desconhecido) para um tema válido. */
export function temaValido(valor: string | null | undefined): Tema {
  return valor === 'vitrine' || valor === 'encanto' ? valor : 'oficina'
}

/** Tema salvo localmente (para pintar no boot, antes de qualquer rede). */
export function temaSalvo(): Tema {
  try {
    return temaValido(localStorage.getItem(CHAVE))
  } catch {
    return 'oficina'
  }
}

/**
 * Aplica o tema ao documento: seta data-tema, atualiza a meta theme-color com o
 * fundo do tema e (por padrão) persiste para o próximo boot.
 */
export function aplicarTema(valor: string | null | undefined, persistir = true) {
  const tema = temaValido(valor)
  document.documentElement.dataset.tema = tema
  if (persistir) {
    try {
      localStorage.setItem(CHAVE, tema)
    } catch {
      /* localStorage indisponível (modo privado) — segue sem persistir */
    }
  }
  // theme-color (barra do navegador / PWA) acompanha o fundo do tema.
  const fundo = getComputedStyle(document.documentElement)
    .getPropertyValue('--massa')
    .trim()
  if (fundo) {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', fundo)
  }
}
