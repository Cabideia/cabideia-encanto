import { useParams } from 'react-router-dom'

/**
 * M-017: página pública da vitrine — cabideia.com.br/encanto/@usuaria
 * Rota SEM login: é o que a cliente final vê. (esqueleto)
 */
export function VitrinePublica() {
  const { arroba } = useParams()
  const usuaria = (arroba ?? '').replace(/^@/, '')

  return (
    <div className="tela">
      <div className="conteudo" style={{ paddingTop: 16 }}>
        <div className="vitrine-moldura">
          <div className="babado" />
          <div className="vitrine-corpo">
            <div className="logo-redonda">✨</div>
            <div className="nome-negocio">@{usuaria}</div>
            <div className="apoio">Trabalhos feitos por encomenda, com capricho 🩷</div>
          </div>
        </div>
        <p className="apoio" style={{ textAlign: 'center', marginTop: 16 }}>
          feito com <b style={{ color: 'var(--framboesa)' }}>Cabideia Encanto</b> ✨
        </p>
      </div>
      <div className="cta-area">
        <button className="cta">💬 Pedir pelo WhatsApp</button>
      </div>
    </div>
  )
}
