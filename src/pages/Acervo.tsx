import { BarraTopo } from '../components/BarraTopo'
import { Vazio } from '../components/Vazio'

/** M-009: acervo na nuvem com compressão, tags e busca. (esqueleto) */
export function Acervo() {
  return (
    <div className="tela">
      <BarraTopo titulo="Meus trabalhos" />
      <div className="conteudo">
        <div className="busca">🔎<input placeholder="Buscar por tema, cliente, tag…" /></div>
        <Vazio icone="📸" frase="Suas fotos ficam guardadas na nuvem — sem ocupar o celular." />
      </div>
      <div className="cta-area">
        <button className="cta">＋ Guardar um trabalho</button>
      </div>
    </div>
  )
}
