import { useNavigate } from 'react-router-dom'

/**
 * Layout das páginas legais públicas (/privacidade e /termos).
 *
 * São páginas abertas sem login (exigência do Google Play): nada de guarda
 * Privada e nada de barra inferior. A barra superior traz um "voltar" seguro:
 * volta no histórico quando há de onde voltar (ex.: vindo do rodapé do login);
 * aberta direto pelo link (sem histórico), leva para /entrar.
 */
export function LegalLayout({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const navegar = useNavigate()

  function voltar() {
    if (window.history.length > 1) navegar(-1)
    else navegar('/entrar')
  }

  return (
    <div className="tela">
      <div className="barra">
        <button className="btn-icone" onClick={voltar} aria-label="Voltar">
          ←
        </button>
        <div className="titulo">{titulo}</div>
        <span className="vaga" />
      </div>
      <div className="legal-conteudo">
        <article className="legal">{children}</article>
      </div>
    </div>
  )
}
