import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Icone } from '../components/Icone'
import { GradeReferencias, resolverReferencias, type RefVisual } from '../components/GradeReferencias'
import { useSessao } from '../hooks/useSessao'
import { usePedidos, tituloPedido } from '../hooks/usePedidos'
import { useAcervo } from '../hooks/useAcervo'
import { useInspiracoes } from '../hooks/useInspiracoes'
import { usePedidoReferencias } from '../hooks/usePedidoReferencias'

/**
 * R2b (UX-029 · Decisão #72) · Galeria de referências do pedido.
 *
 * Substitui o antigo "Ver inspirações do pedido" (removido no R2a por
 * vocabulário — Decisão #66): tela dedicada com 2 colunas maiores e toque para
 * ampliar (lightbox reusado da vitrine pública). Só leitura — tirar/adicionar
 * referência continua no detalhe e no formulário do pedido. Lê
 * `pedido_referencias`; zero schema.
 */
export function GaleriaReferencias() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { sessao } = useSessao()

  const { carregando, buscarPorId } = usePedidos(sessao?.user.id)
  const { trabalhos } = useAcervo(sessao?.user.id)
  const { inspiracoes } = useInspiracoes(sessao?.user.id)
  const { referencias, carregando: carregandoRefs } = usePedidoReferencias(sessao?.user.id, id)

  const [ampliada, setAmpliada] = useState<RefVisual | null>(null)

  const pedido = id ? buscarPorId(id) : undefined

  if (carregando || carregandoRefs) return null

  if (!pedido) {
    return (
      <div className="tela">
        <BarraTopo titulo="Referências" />
        <div className="conteudo">
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="busca" size={44} /></div>
            <p>Este pedido não foi encontrado.</p>
          </div>
        </div>
      </div>
    )
  }

  const itens = resolverReferencias(referencias, trabalhos, inspiracoes)

  // Foto amplia no lightbox; link puro (sem capa) abre direto no navegador.
  function aoTocar(rv: RefVisual) {
    if (!rv.url && rv.linkExterno) {
      window.open(rv.linkExterno, '_blank', 'noopener')
      return
    }
    setAmpliada(rv)
  }

  return (
    <div className="tela">
      <BarraTopo titulo="Referências" />

      <div className="conteudo">
        <p className="apoio" style={{ marginTop: 0, marginBottom: 12 }}>
          {tituloPedido(pedido)} · {itens.length} referência{itens.length !== 1 ? 's' : ''}
        </p>

        {itens.length === 0 ? (
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="imagem" size={44} /></div>
            <p>Este pedido ainda não tem referências.</p>
          </div>
        ) : (
          <GradeReferencias itens={itens} colunas={2} aoTocar={aoTocar} />
        )}

        <button
          className="btn-secundario"
          style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}
          onClick={() => navegar(`/pedidos/${pedido.id}/referencias`)}
        >
          <Icone nome="imagem" size={16} />{' '}
          {itens.length > 0 ? 'Adicionar mais fotos' : 'Selecionar fotos'}
        </button>
      </div>

      {/* UX-029 · foto ampliada — mesmo lightbox da vitrine pública (UX-009). */}
      {ampliada && (
        <div
          className="lightbox-overlay"
          onClick={() => setAmpliada(null)}
          role="dialog"
          aria-label="Foto ampliada"
        >
          <button
            type="button"
            className="lightbox-fechar"
            onClick={() => setAmpliada(null)}
            aria-label="Fechar"
          >
            <Icone nome="fechar" size={18} />
          </button>
          <div className="lightbox-quadro" onClick={(e) => e.stopPropagation()}>
            <img src={ampliada.url ?? ''} alt={ampliada.legenda ?? ''} />
            {(ampliada.codigo || ampliada.legenda) && (
              <div className="lightbox-legenda">
                {[ampliada.codigo, ampliada.legenda].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
