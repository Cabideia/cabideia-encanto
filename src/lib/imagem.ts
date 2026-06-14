/**
 * Compressão de imagem no cliente — OBRIGATÓRIA antes de qualquer upload
 * (lição nº 1 herdada do Cabideia: HEIC de 3–5MB trava a aba no Android sem erro).
 *
 * Alvo: máx 1280px no maior lado, JPEG qualidade ~0.8 (~150–300KB típico).
 * Bom equilíbrio para o 4G das confeiteiras sem perder qualidade visível.
 */
export type ImagemComprimida = {
  blob: Blob
  largura: number
  altura: number
}

const LARGURA_MAX = 1280
const QUALIDADE = 0.8

export async function comprimirImagem(arquivo: File): Promise<ImagemComprimida> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(arquivo)
  } catch {
    // HEIC/HEIF (iPhone) e formatos exóticos caem aqui: o navegador não decodifica.
    throw new Error(
      'Não consegui abrir essa imagem. Tente uma foto em JPG ou PNG (no iPhone, ' +
      'tire a foto em "Mais compatível" ou tire um print da imagem).'
    )
  }

  const escala = Math.min(1, LARGURA_MAX / Math.max(bitmap.width, bitmap.height))
  const largura = Math.round(bitmap.width * escala)
  const altura = Math.round(bitmap.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Canvas indisponível neste aparelho')
  }
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
