/**
 * Compartilhar / Salvar uma imagem do acervo — 100% no cliente.
 *
 * Caminho feliz (celular): Web Share API com ARQUIVO, abrindo o menu nativo
 * (WhatsApp, Instagram, "Salvar nas Fotos"…). Fallbacks para desktop ou
 * navegadores sem suporte: âncora <a download> e, em último caso, abrir a
 * imagem em nova aba.
 *
 * Espelha o padrão já usado na Proposta (PropostaForm), mas partindo de uma
 * URL do Storage em vez de um canvas.
 */

export type ResultadoCompartilhar = 'compartilhado' | 'baixado' | 'aberto' | 'cancelado'

/**
 * Busca o blob da imagem (mesma URL pública que o acervo já exibe) e tenta
 * compartilhar como arquivo. Devolve o que acabou acontecendo para a tela
 * decidir se mostra um aviso ("Imagem baixada ✓").
 */
export async function compartilharImagem(
  url: string,
  nomeArquivo: string,
  meta: { title?: string; text?: string } = {}
): Promise<ResultadoCompartilhar> {
  let blob: Blob | null = null
  try {
    const resp = await fetch(url)
    if (resp.ok) blob = await resp.blob()
  } catch {
    /* CORS/rede: cai nos fallbacks abaixo */
  }

  // 1) Web Share com arquivo (celular)
  if (blob) {
    const arquivo = new File([blob], nomeArquivo, { type: blob.type || 'image/jpeg' })
    if (navigator.canShare?.({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], title: meta.title, text: meta.text })
        return 'compartilhado'
      } catch {
        // Usuária cancelou o menu nativo — não força download por cima.
        return 'cancelado'
      }
    }

    // 2) Fallback desktop/sem suporte: baixar o arquivo
    baixarBlob(blob, nomeArquivo)
    return 'baixado'
  }

  // 3) Último recurso (não conseguiu o blob): abrir a imagem em nova aba
  window.open(url, '_blank', 'noopener')
  return 'aberto'
}

/** Dispara o download de um blob como arquivo (âncora <a download>). */
function baixarBlob(blob: Blob, nomeArquivo: string) {
  const objUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objUrl
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(objUrl), 4000)
}

export type ResultadoCompartilharVarias = 'compartilhado' | 'baixado' | 'cancelado' | 'falhou'

/**
 * Compartilha/salva VÁRIAS imagens de uma vez (modo seleção do acervo).
 *
 * Celular: um único menu nativo com todos os arquivos quando o aparelho
 * aceita (`navigator.canShare`). Caso contrário, baixa cada imagem.
 * Itens cuja imagem não pôde ser baixada são ignorados.
 */
export async function compartilharImagens(
  itens: { url: string; nome: string }[],
  meta: { title?: string; text?: string } = {}
): Promise<ResultadoCompartilharVarias> {
  const arquivos: File[] = []
  for (const item of itens) {
    try {
      const resp = await fetch(item.url)
      if (!resp.ok) continue
      const blob = await resp.blob()
      arquivos.push(new File([blob], item.nome, { type: blob.type || 'image/jpeg' }))
    } catch {
      /* CORS/rede: pula este item */
    }
  }

  if (arquivos.length === 0) return 'falhou'

  // 1) Web Share com vários arquivos (celular)
  if (navigator.canShare?.({ files: arquivos })) {
    try {
      await navigator.share({ files: arquivos, title: meta.title, text: meta.text })
      return 'compartilhado'
    } catch {
      return 'cancelado'
    }
  }

  // 2) Fallback desktop/sem suporte: baixa uma a uma
  for (const arquivo of arquivos) baixarBlob(arquivo, arquivo.name)
  return 'baixado'
}
