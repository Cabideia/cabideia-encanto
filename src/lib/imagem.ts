/**
 * Compressão de imagem no cliente — OBRIGATÓRIA antes de qualquer upload
 * (lição nº 1 herdada do Cabideia: HEIC de 3–5MB trava a aba no Android sem erro).
 *
 * Implementação completa entra no M-009 (acervo). O contrato fica definido aqui
 * para que nenhum módulo suba arquivo cru por engano.
 */
export type ImagemComprimida = {
  blob: Blob
  largura: number
  altura: number
}

const LARGURA_MAX = 1600
const QUALIDADE = 0.82

export async function comprimirImagem(arquivo: File): Promise<ImagemComprimida> {
  const bitmap = await createImageBitmap(arquivo)
  const escala = Math.min(1, LARGURA_MAX / bitmap.width)
  const largura = Math.round(bitmap.width * escala)
  const altura = Math.round(bitmap.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível neste aparelho')
  ctx.drawImage(bitmap, 0, 0, largura, altura)
  bitmap.close()

  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error('Falha ao comprimir a imagem'))),
      'image/jpeg',
      QUALIDADE
    )
  )
  return { blob, largura, altura }
}
