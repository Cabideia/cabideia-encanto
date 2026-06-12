import { BarraTopo } from '../components/BarraTopo'
import { Vazio } from '../components/Vazio'

/** M-007: mural de inspirações com tags. (esqueleto) */
export function Inspiracoes() {
  return (
    <div className="tela">
      <BarraTopo titulo="Inspirações" />
      <div className="conteudo">
        <Vazio icone="💡" frase="Guarde imagens e links que te inspiram — e ache em segundos quando precisar." />
      </div>
      <div className="cta-area">
        <button className="cta">＋ Guardar inspiração</button>
      </div>
    </div>
  )
}
