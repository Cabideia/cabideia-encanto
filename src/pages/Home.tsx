import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSessao } from '../hooks/useSessao'
import { usePedidos, tituloPedido, type JanelaEntrega } from '../hooks/usePedidos'
import { rotuloEntrega } from '../lib/datas'

/** Home em blocos (UX-001): sem barra inferior, engrenagem no topo. */
export function Home() {
  const { sessao } = useSessao()
  const { proximasEntregas } = usePedidos(sessao?.user.id)
  const [janela, setJanela] = useState<JanelaEntrega>('7d')
  const entregas = proximasEntregas(janela)
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
        <div className="troca-periodo" style={{ margin: '4px 0 12px' }}>
          <button className={janela === '7d' ? 'ativo' : ''} onClick={() => setJanela('7d')}>
            7 dias
          </button>
          <button className={janela === 'mes' ? 'ativo' : ''} onClick={() => setJanela('mes')}>
            Mês
          </button>
        </div>
        {entregas.length === 0 ? (
          <p className="apoio">
            Nenhuma entrega {janela === '7d' ? 'nos próximos 7 dias' : 'neste mês'}. Anote um pedido em Pedidos.
          </p>
        ) : (
          <div className="entregas">
            {entregas.map((p) => (
              <Link key={p.id} to={`/pedidos/${p.id}`} className="entrega">
                <div className="quando">{p.data_entrega ? rotuloEntrega(p.data_entrega) : ''}</div>
                <div className="o-que">{tituloPedido(p)}</div>
                <div className="apoio" style={{ marginTop: 2 }}>{p.cliente_nome ?? 'sem cliente'}</div>
              </Link>
            ))}
          </div>
        )}

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
            <div><div className="nome">Meus trabalhos</div><div className="conta">suas fotos na nuvem</div></div>
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
          🎀 Conheça o Plano Vitrine <span className="seta">Ver planos ›</span>
        </Link>
      </div>
    </div>
  )
}
