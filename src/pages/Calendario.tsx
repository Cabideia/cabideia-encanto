import { BarraTopo } from '../components/BarraTopo'
import { Vazio } from '../components/Vazio'

/** M-006: visão mensal por data de entrega. (esqueleto) */
export function Calendario() {
  return (
    <div className="tela">
      <BarraTopo titulo="Calendário" />
      <div className="conteudo">
        <Vazio icone="📅" frase="As entregas do mês aparecem aqui, dia a dia." />
      </div>
    </div>
  )
}
