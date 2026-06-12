import { BarraTopo } from '../components/BarraTopo'
import { Vazio } from '../components/Vazio'

/** M-002: pedido leve em texto livre + status. (esqueleto) */
export function Pedidos() {
  return (
    <div className="tela">
      <BarraTopo titulo="Pedidos" />
      <div className="conteudo">
        <div className="filtros">
          <button className="filtro ativo">Todos</button>
          <button className="filtro">A fazer</button>
          <button className="filtro">Em produção</button>
          <button className="filtro">Entregues</button>
        </div>
        <Vazio icone="🧁" frase="Anote um pedido em segundos: cliente, tema e data. Sem burocracia." />
      </div>
      <div className="cta-area">
        <button className="cta">＋ Anotar pedido</button>
      </div>
    </div>
  )
}
