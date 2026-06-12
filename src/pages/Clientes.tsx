import { BarraTopo } from '../components/BarraTopo'
import { Vazio } from '../components/Vazio'

/** M-003: clientes com botão WhatsApp. (esqueleto) */
export function Clientes() {
  return (
    <div className="tela">
      <BarraTopo titulo="Clientes" />
      <div className="conteudo">
        <Vazio icone="🩷" frase="Suas clientes ficam aqui, com o WhatsApp a um toque." />
      </div>
      <div className="cta-area">
        <button className="cta">＋ Adicionar cliente</button>
      </div>
    </div>
  )
}
