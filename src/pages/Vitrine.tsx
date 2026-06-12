import { BarraTopo } from '../components/BarraTopo'
import { useAviso } from '../components/Toast'

/** M-017 (herói): gestão da vitrine pública. (esqueleto) */
export function Vitrine() {
  const avisar = useAviso()
  const link = 'cabideia.com.br/encanto/@seu-nome'

  return (
    <div className="tela">
      <BarraTopo titulo="Minha vitrine" />
      <div className="conteudo">
        <div className="vitrine-moldura">
          <div className="babado" />
          <div className="vitrine-corpo">
            <div className="logo-redonda">✨</div>
            <div className="nome-negocio">Seu negócio</div>
            <div className="apoio">Complete seu perfil para abrir a vitrine</div>
            <div
              className="link-vitrine"
              role="button"
              tabIndex={0}
              onClick={() => {
                navigator.clipboard?.writeText('https://' + link)
                avisar('Link copiado ✓')
              }}
            >
              🔗 {link} · copiar
            </div>
          </div>
        </div>
        <p className="apoio" style={{ textAlign: 'center' }}>
          Escolha trabalhos no acervo com “Mostrar na vitrine” e eles aparecem aqui.
        </p>
      </div>
      <div className="cta-area">
        <button className="cta" onClick={() => avisar('Em breve: compartilhar pelo WhatsApp')}>
          📤 Compartilhar minha vitrine
        </button>
      </div>
    </div>
  )
}
