import { useNavigate } from 'react-router-dom'

/**
 * M-011 · Modal de bloqueio de upload no plano Grátis.
 * Mostrado quando a usuária tenta subir uma imagem além das 150 do plano.
 * Não apaga nem despublica nada — só oferece o caminho dos planos.
 */
export function LimiteModal({ onFechar }: { onFechar: () => void }) {
  const navegar = useNavigate()
  return (
    <div className="painel-overlay" onClick={onFechar}>
      <div className="painel" onClick={(e) => e.stopPropagation()}>
        <div className="painel-puxador" />
        <div className="form-acervo-titulo" style={{ textAlign: 'center' }}>
          🎀 Limite do plano Grátis
        </div>
        <p className="apoio" style={{ textAlign: 'center', marginTop: 8 }}>
          Você atingiu o limite do plano Grátis (150 imagens). Para guardar mais fotos,
          assine o Vitrine — ou apague algumas imagens para liberar espaço.
        </p>
        <button className="cta" style={{ marginTop: 16 }} onClick={() => navegar('/planos')}>
          Ver planos
        </button>
        <button
          className="btn-secundario"
          style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}
          onClick={onFechar}
        >
          Agora não
        </button>
      </div>
    </div>
  )
}
