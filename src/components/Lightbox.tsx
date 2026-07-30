import { useRef, useState } from 'react'
import { Icone } from './Icone'

type LightboxProps = {
  url: string
  legenda?: string
  aoFechar: () => void
}

const ESCALA_MIN = 1
const ESCALA_MAX = 4

/**
 * UX-009 / D3b (Decisão #102) · Lightbox único do app.
 *
 * Extraído dos dois usos que antes copiavam o markup (GaleriaReferencias e
 * VitrinePublica) para o gesto de pinça viver num lugar só — reimplementá-lo
 * duas vezes é exatamente o padrão que gerou a UX-041.
 *
 * Zoom por pinça (1×–4×), duplo-toque (1×↔2× no ponto tocado) e pan quando
 * ampliado, tudo via pointer events e sem biblioteca. Toque na IMAGEM não fecha
 * (stopPropagation no `.lightbox-quadro` — §0.3); fecha o toque no overlay em
 * volta e o ✕. O zoom reseta sozinho ao fechar, porque o componente desmonta.
 */
export function Lightbox({ url, legenda, aoFechar }: LightboxProps) {
  const [escala, setEscala] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const imgRef = useRef<HTMLImageElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Ponteiros ativos (pinça = 2). O estado do gesto fica em refs para não
  // repintar a cada evento de movimento por causa deles.
  const ponteiros = useRef(new Map<number, { x: number; y: number }>())
  const pincaInicial = useRef<{ dist: number; escala: number } | null>(null)
  const arrasto = useRef<{ x: number; y: number } | null>(null)
  const ultimoToque = useRef(0)

  // Limita o pan às bordas: com transform-origin no centro, cada lado transborda
  // (escala−1)·tamanho/2 — além disso apareceria fundo preto ao lado da imagem.
  function limitar(x: number, y: number, s: number) {
    const img = imgRef.current
    if (!img) return { x, y }
    const maxX = Math.max(0, ((s - 1) * img.offsetWidth) / 2)
    const maxY = Math.max(0, ((s - 1) * img.offsetHeight) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    }
  }

  function centroOverlay() {
    const r = overlayRef.current?.getBoundingClientRect()
    if (!r) return { x: 0, y: 0 }
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }

  // Duplo-toque: se já ampliado, volta a 1×; senão vai a 2× centrando no ponto
  // tocado (translada o ponto para o centro, depois limita às bordas).
  function alternarZoom(clientX: number, clientY: number) {
    if (escala > 1) {
      setEscala(1)
      setPos({ x: 0, y: 0 })
    } else {
      const c = centroOverlay()
      setEscala(2)
      setPos(limitar(c.x - clientX, c.y - clientY, 2))
    }
  }

  function aoDescerPonteiro(e: React.PointerEvent) {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (ponteiros.current.size === 2) {
      const [a, b] = [...ponteiros.current.values()]
      pincaInicial.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), escala }
      arrasto.current = null
    } else if (ponteiros.current.size === 1) {
      arrasto.current = { x: e.clientX, y: e.clientY }
      const agora = Date.now()
      if (agora - ultimoToque.current < 300) {
        alternarZoom(e.clientX, e.clientY)
        ultimoToque.current = 0
      } else {
        ultimoToque.current = agora
      }
    }
  }

  function aoMoverPonteiro(e: React.PointerEvent) {
    if (!ponteiros.current.has(e.pointerId)) return
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (ponteiros.current.size === 2 && pincaInicial.current) {
      const [a, b] = [...ponteiros.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const nova = Math.min(
        ESCALA_MAX,
        Math.max(ESCALA_MIN, pincaInicial.current.escala * (dist / pincaInicial.current.dist))
      )
      setEscala(nova)
      setPos((p) => limitar(p.x, p.y, nova))
    } else if (ponteiros.current.size === 1 && arrasto.current && escala > 1) {
      const dx = e.clientX - arrasto.current.x
      const dy = e.clientY - arrasto.current.y
      arrasto.current = { x: e.clientX, y: e.clientY }
      setPos((p) => limitar(p.x + dx, p.y + dy, escala))
    }
  }

  function aoSubirPonteiro(e: React.PointerEvent) {
    ponteiros.current.delete(e.pointerId)
    if (ponteiros.current.size < 2) pincaInicial.current = null
    if (ponteiros.current.size === 1) {
      // Um dedo saiu da pinça: continua o pan a partir do que ficou.
      const [rem] = [...ponteiros.current.values()]
      arrasto.current = { x: rem.x, y: rem.y }
    }
    if (ponteiros.current.size === 0) arrasto.current = null
  }

  const emGesto = pincaInicial.current !== null || arrasto.current !== null

  return (
    <div
      className="lightbox-overlay"
      ref={overlayRef}
      onClick={aoFechar}
      role="dialog"
      aria-label="Foto ampliada"
    >
      <button
        type="button"
        className="lightbox-fechar"
        onClick={aoFechar}
        aria-label="Fechar"
      >
        <Icone nome="fechar" size={18} />
      </button>
      <div className="lightbox-quadro" onClick={(e) => e.stopPropagation()}>
        <img
          ref={imgRef}
          src={url}
          alt={legenda ?? ''}
          draggable={false}
          onPointerDown={aoDescerPonteiro}
          onPointerMove={aoMoverPonteiro}
          onPointerUp={aoSubirPonteiro}
          onPointerCancel={aoSubirPonteiro}
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${escala})`,
            touchAction: 'none',
            transition: emGesto ? 'none' : 'transform .15s',
            cursor: escala > 1 ? 'grab' : 'auto',
          }}
        />
        {legenda && <div className="lightbox-legenda">{legenda}</div>}
      </div>
    </div>
  )
}
