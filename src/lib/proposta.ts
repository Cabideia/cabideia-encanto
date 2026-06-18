/**
 * M-021 · Render do cartão de proposta — 100% no cliente (canvas), sem custo
 * e sem salvar nada no acervo. Desenha foto + descrição + valor + a logo do
 * perfil sobre a identidade visual v5 (lê os tokens do :root para não divergir
 * do design system).
 *
 * O cartão sai em 1080×1440 (retrato 3:4), bom para enviar no WhatsApp.
 */

export type DadosCartao = {
  fotoBitmap: ImageBitmap | null
  logoBitmap: ImageBitmap | null
  nomeNegocio: string
  titulo: string
  descricao: string
  cliente: string
  valorTexto: string // já formatado p/ exibição (ex.: "R$ 120,00" ou "A combinar")
  validadeTexto: string // já formatado (ex.: "Válido até 30/06/2026") ou '' p/ esconder
}

export const LARGURA_CARTAO = 1080
export const ALTURA_CARTAO = 1440

/** Lê uma variável de cor do :root (cai num padrão se faltar). */
function token(nome: string, padrao: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim()
  return v || padrao
}

/** Caminho de retângulo arredondado (compat. com navegadores sem roundRect). */
function caminhoArredondado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const raio = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + raio, y)
  ctx.arcTo(x + w, y, x + w, y + h, raio)
  ctx.arcTo(x + w, y + h, x, y + h, raio)
  ctx.arcTo(x, y + h, x, y, raio)
  ctx.arcTo(x, y, x + w, y, raio)
  ctx.closePath()
}

/** Desenha um bitmap "cover" (preenche a caixa, corta o excedente, centralizado). */
function desenharCover(
  ctx: CanvasRenderingContext2D,
  bmp: ImageBitmap,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const escala = Math.max(w / bmp.width, h / bmp.height)
  const dw = bmp.width * escala
  const dh = bmp.height * escala
  ctx.drawImage(bmp, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

/** Trunca um texto com reticências para caber numa largura. */
function truncar(ctx: CanvasRenderingContext2D, texto: string, larguraMax: number): string {
  if (ctx.measureText(texto).width <= larguraMax) return texto
  let t = texto
  while (t.length > 1 && ctx.measureText(t + '…').width > larguraMax) t = t.slice(0, -1)
  return t + '…'
}

/** Quebra o texto em linhas (respeita \n) até no máx. `maxLinhas`. */
function quebrarLinhas(
  ctx: CanvasRenderingContext2D,
  texto: string,
  larguraMax: number,
  maxLinhas: number
): string[] {
  const linhas: string[] = []
  for (const paragrafo of texto.split('\n')) {
    const palavras = paragrafo.split(/\s+/).filter(Boolean)
    let atual = ''
    for (const palavra of palavras) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra
      if (ctx.measureText(tentativa).width > larguraMax && atual) {
        linhas.push(atual)
        atual = palavra
      } else {
        atual = tentativa
      }
      if (linhas.length >= maxLinhas) break
    }
    if (linhas.length >= maxLinhas) break
    if (atual) linhas.push(atual)
  }
  if (linhas.length > maxLinhas) linhas.length = maxLinhas
  // Reticências na última linha se sobrou texto.
  if (linhas.length === maxLinhas) {
    const total = texto.replace(/\s+/g, ' ').trim()
    const montado = linhas.join(' ').trim()
    if (montado.length < total.length) {
      linhas[maxLinhas - 1] = truncar(ctx, linhas[maxLinhas - 1] + '…', larguraMax)
    }
  }
  return linhas
}

const SERIF = '"Fraunces", Georgia, serif'
const SANS = '"Nunito Sans", system-ui, sans-serif'

/** Desenha o cartão da proposta no canvas informado (1080×1440). */
export function desenharProposta(canvas: HTMLCanvasElement, d: DadosCartao) {
  const W = LARGURA_CARTAO
  const H = ALTURA_CARTAO
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const massa = token('--massa', '#FFF6F1')
  const framboesa = token('--framboesa', '#C2476B')
  const framboesaSuave = token('--framboesa-suave', '#FBE9EE')
  const cacau = token('--cacau', '#43302B')
  const cacauClaro = token('--cacau-claro', '#8B6F65')
  const linha = token('--linha', '#F0DFD8')

  // Fundo
  ctx.fillStyle = massa
  ctx.fillRect(0, 0, W, H)

  // Divisória limpa no topo (antes era o babado/renda) — faixa fina na primária.
  ctx.fillStyle = framboesa
  ctx.fillRect(0, 0, W, 12)

  const M = 64
  const larguraConteudo = W - M * 2

  // Logo redonda
  const lcx = W / 2
  const lcy = 158
  const lr = 62
  ctx.save()
  caminhoArredondado(ctx, lcx - lr, lcy - lr, lr * 2, lr * 2, lr)
  ctx.clip()
  if (d.logoBitmap) {
    desenharCover(ctx, d.logoBitmap, lcx - lr, lcy - lr, lr * 2, lr * 2)
  } else {
    ctx.fillStyle = framboesaSuave
    ctx.fillRect(lcx - lr, lcy - lr, lr * 2, lr * 2)
    ctx.fillStyle = framboesa
    ctx.font = `600 56px ${SERIF}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const inicial = d.nomeNegocio.trim().charAt(0).toUpperCase()
    ctx.fillText(inicial || 'C', lcx, lcy + 4)
  }
  ctx.restore()
  // Anel da logo
  ctx.beginPath()
  ctx.arc(lcx, lcy, lr, 0, Math.PI * 2)
  ctx.lineWidth = 5
  ctx.strokeStyle = framboesa
  ctx.stroke()

  // Cabeçalho (cursor descendo): nome do negócio → "Proposta para X" → título
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  // Nome do negócio
  ctx.fillStyle = cacau
  ctx.font = `600 40px ${SERIF}`
  let cursor = 282
  ctx.fillText(truncar(ctx, d.nomeNegocio || 'Minha confeitaria', larguraConteudo), W / 2, cursor)

  // "Proposta para {cliente}" (ou só "Proposta")
  const temCliente = !!d.cliente.trim()
  ctx.fillStyle = framboesa
  ctx.font = `700 24px ${SANS}`
  cursor += 34
  ctx.fillText(
    truncar(ctx, temCliente ? `Proposta para ${d.cliente.trim()}` : 'Proposta', larguraConteudo),
    W / 2,
    cursor
  )

  // Título da proposta (opcional)
  const titulo = d.titulo.trim()
  if (titulo) {
    ctx.fillStyle = cacau
    ctx.font = `600 33px ${SERIF}`
    cursor += 44
    ctx.fillText(truncar(ctx, titulo, larguraConteudo), W / 2, cursor)
  }

  // Foto — topo logo abaixo do cabeçalho, base fixa para o rodapé respirar.
  const fy = cursor + 28
  const FOTO_BASE = 1040
  const fh = FOTO_BASE - fy
  ctx.save()
  caminhoArredondado(ctx, M, fy, larguraConteudo, fh, 28)
  ctx.clip()
  if (d.fotoBitmap) {
    desenharCover(ctx, d.fotoBitmap, M, fy, larguraConteudo, fh)
  } else {
    ctx.fillStyle = framboesaSuave
    ctx.fillRect(M, fy, larguraConteudo, fh)
    ctx.fillStyle = cacauClaro
    ctx.font = `700 30px ${SANS}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Adicione uma foto', W / 2, fy + fh / 2)
  }
  ctx.restore()
  caminhoArredondado(ctx, M, fy, larguraConteudo, fh, 28)
  ctx.lineWidth = 2
  ctx.strokeStyle = linha
  ctx.stroke()

  // Descrição (até 2 linhas)
  let dy = FOTO_BASE + 54
  ctx.fillStyle = cacau
  ctx.font = `400 30px ${SANS}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const linhasDesc = quebrarLinhas(ctx, d.descricao.trim(), larguraConteudo, 2)
  for (const l of linhasDesc) {
    ctx.fillText(l, W / 2, dy)
    dy += 42
  }

  // Valor (pílula)
  ctx.font = `600 58px ${SERIF}`
  const tw = ctx.measureText(d.valorTexto).width
  const pilulaH = 108
  const pilulaW = Math.min(larguraConteudo, tw + 96)
  const pilulaX = (W - pilulaW) / 2
  const pilulaY = Math.max(dy + 12, 1166)
  caminhoArredondado(ctx, pilulaX, pilulaY, pilulaW, pilulaH, pilulaH / 2)
  ctx.fillStyle = framboesaSuave
  ctx.fill()
  ctx.fillStyle = framboesa
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(truncar(ctx, d.valorTexto, larguraConteudo - 64), W / 2, pilulaY + pilulaH / 2 + 2)

  // Validade (opcional), logo abaixo da pílula
  const validade = d.validadeTexto.trim()
  if (validade) {
    ctx.fillStyle = cacauClaro
    ctx.font = `700 25px ${SANS}`
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(truncar(ctx, validade, larguraConteudo), W / 2, pilulaY + pilulaH + 46)
  }

  // Rodapé
  ctx.fillStyle = cacauClaro
  ctx.font = `700 25px ${SANS}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('feito com Cabideia Encanto', W / 2, H - 46)
}

/** Exporta o cartão como PNG (Blob). */
export function cartaoParaPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem'))),
      'image/png'
    )
  )
}
