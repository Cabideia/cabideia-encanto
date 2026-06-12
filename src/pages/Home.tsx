import { Link } from 'react-router-dom'
import { useSessao } from '../hooks/useSessao'

/** Home em blocos (UX-001): sem barra inferior, engrenagem no topo. */
export function Home() {
  const { sessao } = useSessao()
  const nome = sessao?.user.user_metadata?.name?.split(' ')[0] ?? 'confeiteira'
  const hoje = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long'
  }).format(new Date())

  return (
    <div className="tela">
      <div className="barra">
        <span className="vaga" />
        <div className="titulo" style={{ fontSize: 17, color: 'var(--cacau-claro)' }}>{hoje}</div>
        <Link to="/config" className="btn-icone" aria-label="Configurações">⚙️</Link>
      </div>
      <div className="conteudo">
        <div className="ola">
          <div className="marca">Olá, <em>{nome}</em></div>
          <div className="apoio">Seus encantos, guardados com carinho.</div>
        </div>

        <div className="secao"><span className="confeito" /><h2>Próximas entregas</h2></div>
        <p className="apoio">Os pedidos com data aparecem aqui. (M-002)</p>

        <div className="blocos">
          <Link to="/vitrine" className="bloco destaque">
            <div className="emoji" aria-hidden>🛍️</div>
            <div className="texto">
              <div className="nome">Minha vitrine</div>
              <div className="conta">monte e compartilhe seu link</div>
            </div>
            <span aria-hidden>›</span>
          </Link>
          <Link to="/acervo" className="bloco">
            <div className="emoji" aria-hidden>📸</div>
            <div><div className="nome">Meus trabalhos</div><div className="conta">acervo na nuvem</div></div>
          </Link>
          <Link to="/inspiracoes" className="bloco">
            <div className="emoji" aria-hidden>💡</div>
            <div><div className="nome">Inspirações</div><div className="conta">guarde referências</div></div>
          </Link>
          <Link to="/pedidos" className="bloco">
            <div className="emoji" aria-hidden>🧁</div>
            <div><div className="nome">Pedidos</div><div className="conta">leves e rápidos</div></div>
          </Link>
          <Link to="/clientes" className="bloco">
            <div className="emoji" aria-hidden>🩷</div>
            <div><div className="nome">Clientes</div><div className="conta">com botão WhatsApp</div></div>
          </Link>
          <Link to="/calendario" className="bloco">
            <div className="emoji" aria-hidden>📅</div>
            <div><div className="nome">Calendário</div><div className="conta">entregas do mês</div></div>
          </Link>
          <Link to="/cardapio" className="bloco">
            <div className="emoji" aria-hidden>📋</div>
            <div><div className="nome">Cardápio</div><div className="conta">seus preços de referência</div></div>
          </Link>
          <Link to="/anotacoes" className="bloco">
            <div className="emoji" aria-hidden>📝</div>
            <div><div className="nome">Anotações</div><div className="conta">texto livre</div></div>
          </Link>
        </div>

        <Link to="/planos" className="aviso-teste">
          🎀 Teste grátis do Plano Vitrine <span className="seta">Ver planos ›</span>
        </Link>
      </div>
    </div>
  )
}
