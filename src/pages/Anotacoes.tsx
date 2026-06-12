import { BarraTopo } from '../components/BarraTopo'
import { Vazio } from '../components/Vazio'

/** M-008: bloco de texto livre. (esqueleto) */
export function Anotacoes() {
  return (
    <div className="tela">
      <BarraTopo titulo="Anotações" />
      <div className="conteudo">
        <Vazio icone="📝" frase="Um lugar simples para suas ideias e lembretes." />
      </div>
      <div className="cta-area">
        <button className="cta">＋ Nova anotação</button>
      </div>
    </div>
  )
}
