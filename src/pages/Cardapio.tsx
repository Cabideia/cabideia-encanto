import { BarraTopo } from '../components/BarraTopo'
import { Vazio } from '../components/Vazio'

/** M-015: prateleira de referência (produto + preço base), sem vínculo com pedido. */
export function Cardapio() {
  return (
    <div className="tela">
      <BarraTopo titulo="Cardápio" />
      <div className="conteudo">
        <Vazio icone="📋" frase="Seus produtos e preços de referência, para consultar rapidinho." />
      </div>
      <div className="cta-area">
        <button className="cta">＋ Adicionar produto</button>
      </div>
    </div>
  )
}
