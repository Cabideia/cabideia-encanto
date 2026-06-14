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

/**
 * Carrega um File como ImageBitmap, com a mesma mensagem amigável de erro
 * usada na compressão (HEIC não decodifica). Exposto para a tela de recorte,
 * que precisa medir e desenhar a imagem antes do upload.
 */
export async function abrirImagem(arquivo: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(arquivo)
  } catch {
    throw new Error(
      'Não consegui abrir essa imagem. Tente uma foto em JPG ou PNG (no iPhone, ' +
      'tire a foto em "Mais compatível" ou tire um print da imagem).'
    )
  }
}

/**
 * Área de recorte em coordenadas da imagem ORIGINAL (px), mais um giro
 * em múltiplos de 90°. A tela de recorte calcula isto e entrega aqui.
 */
export type AreaRecorte = {
  x: number
  y: number
  largura: number
  altura: number
  giro: 0 | 90 | 180 | 270
}

/**
 * Aplica recorte + giro e devolve um JPEG já comprimido, pronto para upload.
 * Roda inteiramente no cliente (sem custo). O resultado também respeita o
 * teto de 1280px no maior lado, como a compressão padrão.
 */
export async function recortarEComprimir(
  arquivo: File,
  area: AreaRecorte
): Promise<ImagemComprimida> {
  const bitmap = await abrirImagem(arquivo)

  // Dimensões do recorte (antes do giro)
  const larguraRecorte = Math.max(1, Math.round(area.largura))
  const alturaRecorte = Math.max(1, Math.round(area.altura))

  // Com giro de 90°/270°, largura e altura finais se invertem
  const girado = area.giro === 90 || area.giro === 270
  const larguraFinalBruta = girado ? alturaRecorte : larguraRecorte
  const alturaFinalBruta = girado ? larguraRecorte : alturaRecorte

  // Reduz para o teto de 1280px no maior lado
  const escala = Math.min(1, LARGURA_MAX / Math.max(larguraFinalBruta, alturaFinalBruta))
  const larguraFinal = Math.round(larguraFinalBruta * escala)
  const alturaFinal = Math.round(alturaFinalBruta * escala)

  const canvas = document.createElement('canvas')
  canvas.width = larguraFinal
  canvas.height = alturaFinal
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Canvas indisponível neste aparelho')
  }

  // Posiciona o giro no centro do canvas final e desenha o trecho recortado.
  ctx.save()
  ctx.translate(larguraFinal / 2, alturaFinal / 2)
  ctx.rotate((area.giro * Math.PI) / 180)
  // Após girar, o destino volta a usar as dimensões "não giradas" do recorte,
  // escaladas para caber no teto.
  const destLargura = larguraRecorte * escala
  const destAltura = alturaRecorte * escala
  ctx.drawImage(
    bitmap,
    area.x, area.y, larguraRecorte, alturaRecorte,
    -destLargura / 2, -destAltura / 2, destLargura, destAltura
  )
  ctx.restore()
  bitmap.close()

  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error('Falha ao processar a imagem'))),
      'image/jpeg',
      QUALIDADE
    )
  )
  return { blob, largura: larguraFinal, altura: alturaFinal }
}
