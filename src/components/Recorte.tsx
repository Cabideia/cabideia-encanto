import { useEffect, useRef, useState } from 'react'
import { abrirImagem, type AreaRecorte } from '../lib/imagem'

/**
 * Recorte manual de imagem — sem dependência externa.
 *
 * A imagem é desenhada num <canvas> escalado para caber na tela. Por cima,
 * uma moldura (overlay) que a usuária arrasta e redimensiona pelos cantos.
 * Ao confirmar, convertemos a moldura (em px de TELA) para px da imagem
 * ORIGINAL e devolvemos via onConfirmar, junto do giro acumulado.
 *
 * Presets: "Quadrado" (1:1, ideal para a vitrine) e "Livre".
 */
type Props = {
  arquivo: File
  onConfirmar: (area: AreaRecorte) => void
  onCancelar: () => void
}

type Caixa = { x: number; y: number; w: number; h: number } // em px de tela (canvas)

const LADO_MIN = 40 // tamanho mínimo da moldura em px de tela

export function Recorte({ arquivo, onConfirmar, onCancelar }: Props) {
  const palcoRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bitmapRef = useRef<ImageBitmap | null>(null)

  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [giro, setGiro] = useState<0 | 90 | 180 | 270>(0)
  const [proporcao, setProporcao] = useState<'livre' | 'quadrado'>('quadrado')

  // Escala tela→original e dimensões desenhadas (preenchidas ao montar/girar)
  const escalaRef = useRef(1)
  const dimRef = useRef({ larguraDesenho: 0, alturaDesenho: 0, larguraOrig: 0, alturaOrig: 0 })

  const [caixa, setCaixa] = useState<Caixa>({ x: 0, y: 0, w: 0, h: 0 })

  // Estado de arraste
  const arraste = useRef<
    | { tipo: 'mover'; ox: number; oy: number; cx: number; cy: number }
    | { tipo: 'canto'; canto: 'ne' | 'nw' | 'se' | 'sw'; ini: Caixa; px: number; py: number }
    | null
  >(null)

  // ── Carrega a imagem e desenha no canvas (redesenha quando o giro muda) ──
  useEffect(() => {
    let vivo = true
    async function carregar() {
      try {
        if (!bitmapRef.current) {
          bitmapRef.current = await abrirImagem(arquivo)
        }
        if (!vivo) return
        desenhar()
        setPronto(true)
      } catch (e: unknown) {
        setErro((e as Error)?.message ?? 'Não consegui abrir a imagem.')
      }
    }
    carregar()
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivo])

  useEffect(() => {
    if (pronto) desenhar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [giro])

  function desenhar() {
    const bitmap = bitmapRef.current
    const palco = palcoRef.current
    const canvas = canvasRef.current
    if (!bitmap || !palco || !canvas) return

    // Dimensões da imagem considerando o giro
    const girado = giro === 90 || giro === 270
    const wOrig = girado ? bitmap.height : bitmap.width
    const hOrig = girado ? bitmap.width : bitmap.height

    // Cabe na largura do palco, com teto de altura
    const larguraPalco = palco.clientWidth
    const alturaMax = Math.min(window.innerHeight * 0.5, 420)
    const escala = Math.min(larguraPalco / wOrig, alturaMax / hOrig, 1)

    const larguraDesenho = Math.round(wOrig * escala)
    const alturaDesenho = Math.round(hOrig * escala)

    canvas.width = larguraDesenho
    canvas.height = alturaDesenho

    const ctx = canvas.getContext('2d')!
    ctx.save()
    ctx.translate(larguraDesenho / 2, alturaDesenho / 2)
    ctx.rotate((giro * Math.PI) / 180)
    const dw = (girado ? alturaDesenho : larguraDesenho)
    const dh = (girado ? larguraDesenho : alturaDesenho)
    ctx.drawImage(bitmap, -dw / 2, -dh / 2, dw, dh)
    ctx.restore()

    // escala tela→original = bitmap.width(da imagem girada)/larguraDesenho
    escalaRef.current = wOrig / larguraDesenho
    dimRef.current = {
      larguraDesenho,
      alturaDesenho,
      larguraOrig: wOrig,
      alturaOrig: hOrig,
    }

    // Inicializa a moldura centralizada conforme a proporção atual
    iniciarCaixa(larguraDesenho, alturaDesenho, proporcao)
  }

  function iniciarCaixa(lar: number, alt: number, prop: 'livre' | 'quadrado') {
    if (prop === 'quadrado') {
      const lado = Math.round(Math.min(lar, alt) * 0.86)
      setCaixa({ x: Math.round((lar - lado) / 2), y: Math.round((alt - lado) / 2), w: lado, h: lado })
    } else {
      const w = Math.round(lar * 0.86)
      const h = Math.round(alt * 0.86)
      setCaixa({ x: Math.round((lar - w) / 2), y: Math.round((alt - h) / 2), w, h })
    }
  }

  function trocarProporcao(prop: 'livre' | 'quadrado') {
    setProporcao(prop)
    const { larguraDesenho, alturaDesenho } = dimRef.current
    iniciarCaixa(larguraDesenho, alturaDesenho, prop)
  }

  // ── Gestos (pointer events cobrem mouse e toque) ──
  function pos(e: React.PointerEvent) {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function iniciarMover(e: React.PointerEvent) {
    e.preventDefault()
    const p = pos(e)
    arraste.current = { tipo: 'mover', ox: p.x, oy: p.y, cx: caixa.x, cy: caixa.y }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  function iniciarCanto(e: React.PointerEvent, canto: 'ne' | 'nw' | 'se' | 'sw') {
    e.preventDefault()
    e.stopPropagation()
    const p = pos(e)
    arraste.current = { tipo: 'canto', canto, ini: { ...caixa }, px: p.x, py: p.y }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  function aoMover(e: React.PointerEvent) {
    if (!arraste.current) return
    const p = pos(e)
    const { larguraDesenho, alturaDesenho } = dimRef.current

    if (arraste.current.tipo === 'mover') {
      const a = arraste.current
      let nx = a.cx + (p.x - a.ox)
      let ny = a.cy + (p.y - a.oy)
      nx = Math.max(0, Math.min(nx, larguraDesenho - caixa.w))
      ny = Math.max(0, Math.min(ny, alturaDesenho - caixa.h))
      setCaixa((c) => ({ ...c, x: nx, y: ny }))
      return
    }

    // Redimensionar por canto
    const a = arraste.current
    const dx = p.x - a.px
    const dy = p.y - a.py
    let { x, y, w, h } = a.ini
    const quad = proporcao === 'quadrado'

    if (a.canto === 'se') {
      w = a.ini.w + dx
      h = quad ? w : a.ini.h + dy
    } else if (a.canto === 'sw') {
      w = a.ini.w - dx
      x = a.ini.x + dx
      h = quad ? w : a.ini.h + dy
    } else if (a.canto === 'ne') {
      w = a.ini.w + dx
      h = quad ? w : a.ini.h - dy
      y = quad ? a.ini.y + (a.ini.h - h) : a.ini.y + dy
    } else {
      // nw
      w = a.ini.w - dx
      x = a.ini.x + dx
      h = quad ? w : a.ini.h - dy
      y = quad ? a.ini.y + (a.ini.h - h) : a.ini.y + dy
    }

    // Limites mínimos e dentro do canvas
    w = Math.max(LADO_MIN, w)
    h = Math.max(LADO_MIN, h)
    if (x < 0) { w += x; x = 0 }
    if (y < 0) { h += y; y = 0 }
    if (x + w > larguraDesenho) w = larguraDesenho - x
    if (y + h > alturaDesenho) h = alturaDesenho - y
    if (quad) { const lado = Math.min(w, h); w = lado; h = lado }

    setCaixa({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) })
  }

  function soltar() {
    arraste.current = null
  }

  function confirmar() {
    const esc = escalaRef.current
    // Converte a moldura (px de tela) para px da imagem ORIGINAL.
    // Como o canvas já está na orientação girada, x/y/larg/alt batem com a
    // imagem girada — e recortarEComprimir aplica o mesmo giro na origem.
    onConfirmar({
      x: Math.round(caixa.x * esc),
      y: Math.round(caixa.y * esc),
      largura: Math.round(caixa.w * esc),
      altura: Math.round(caixa.h * esc),
      giro,
    })
  }

  return (
    <div className="recorte-overlay">
      <div className="recorte-caixa">
        <div className="recorte-titulo">Ajustar foto</div>

        {erro ? (
          <p className="apoio" style={{ color: 'var(--framboesa)', padding: '12px 0' }}>{erro}</p>
        ) : (
          <>
            <div className="recorte-palco" ref={palcoRef}>
              <div className="recorte-canvas-wrap">
                <canvas
                  ref={canvasRef}
                  className="recorte-canvas"
                  onPointerMove={aoMover}
                  onPointerUp={soltar}
                  onPointerCancel={soltar}
                />
                {pronto && (
                  <div
                    className="recorte-moldura"
                    style={{ left: caixa.x, top: caixa.y, width: caixa.w, height: caixa.h }}
                    onPointerDown={iniciarMover}
                    onPointerMove={aoMover}
                    onPointerUp={soltar}
                  >
                    <span className="recorte-canto ne" onPointerDown={(e) => iniciarCanto(e, 'ne')} />
                    <span className="recorte-canto nw" onPointerDown={(e) => iniciarCanto(e, 'nw')} />
                    <span className="recorte-canto se" onPointerDown={(e) => iniciarCanto(e, 'se')} />
                    <span className="recorte-canto sw" onPointerDown={(e) => iniciarCanto(e, 'sw')} />
                  </div>
                )}
              </div>
            </div>

            <div className="recorte-controles">
              <div className="recorte-props">
                <button
                  type="button"
                  className={`filtro${proporcao === 'quadrado' ? ' ativo' : ''}`}
                  onClick={() => trocarProporcao('quadrado')}
                >
                  ⬛ Quadrado
                </button>
                <button
                  type="button"
                  className={`filtro${proporcao === 'livre' ? ' ativo' : ''}`}
                  onClick={() => trocarProporcao('livre')}
                >
                  ▭ Livre
                </button>
                <button
                  type="button"
                  className="filtro"
                  onClick={() => setGiro(((giro + 90) % 360) as 0 | 90 | 180 | 270)}
                >
                  ↻ Girar
                </button>
              </div>
              <p className="apoio" style={{ textAlign: 'center', marginTop: 6 }}>
                Arraste a moldura e os cantos. Quadrado fica ótimo na vitrine.
              </p>
            </div>
          </>
        )}

        <div className="recorte-botoes">
          <button type="button" className="btn-secundario" onClick={onCancelar} style={{ flex: 1 }}>
            Cancelar
          </button>
          <button
            type="button"
            className="cta"
            onClick={confirmar}
            disabled={!pronto || !!erro}
            style={{ flex: 2, height: 48 }}
          >
            Usar esta foto
          </button>
        </div>
      </div>
    </div>
  )
}

