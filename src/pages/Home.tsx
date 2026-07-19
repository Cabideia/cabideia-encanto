import { Link } from 'react-router-dom'
import { useSessao } from '../hooks/useSessao'
import { usePedidos, tituloPedido } from '../hooks/usePedidos'
import { rotuloEntrega } from '../lib/datas'
import { Icone } from '../components/Icone'

/** Home em blocos (UX-001): sem barra inferior, engrenagem no topo. */
export function Home() {
  const { sessao } = useSessao()
  const { proximasEntregas } = usePedidos(sessao?.user.id)
  // Resumo enxuto na home: as próximas entregas de 7 dias. A visão completa
  // (mês a mês) vive no Calendário, alcançável pelo "Ver todas".
  const entregas = proximasEntregas('7d')
  const nome = sessao?.user.user_metadata?.name?.split(' ')[0] ?? 'confeiteira'
  const hoje = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long'
  }).format(new Date())

  return (
    <div className="tela">
      <div className="barra">
        <span className="vaga" />
        <div className="titulo" style={{ fontSize: 17, color: 'var(--cacau-claro)' }}>{hoje}</div>
        <Link to="/config" className="btn-icone" aria-label="Configurações"><Icone nome="config" /></Link>
      </div>
      <div className="conteudo">
        <div className="ola">
          <div className="marca">Olá, <em>{nome}</em></div>
          <div className="apoio">Seus encantos, guardados com carinho.</div>
        </div>

        <div className="secao" style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="confeito" /><h2>Próximas entregas</h2>
          </span>
          <Link to="/calendario" className="secao-link">Ver todas ›</Link>
        </div>
        {entregas.length === 0 ? (
          <p className="apoio">
            Nenhuma entrega nos próximos 7 dias. Veja o mês todo no <Link to="/calendario" style={{ color: 'var(--framboesa)', fontWeight: 700 }}>Calendário</Link>.
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
            <div className="emoji"><Icone nome="vitrine" /></div>
            <div className="texto">
              <div className="nome">Minha vitrine</div>
              <div className="conta">monte e compartilhe seu link</div>
            </div>
            <span aria-hidden>›</span>
          </Link>
          <Link to="/acervo" className="bloco">
            <div className="emoji"><Icone nome="trabalhos" /></div>
            <div><div className="nome">Meus trabalhos</div><div className="conta">suas fotos na nuvem</div></div>
          </Link>
          <Link to="/inspiracoes" className="bloco">
            <div className="emoji"><Icone nome="inspiracoes" /></div>
            <div><div className="nome">Inspirações</div><div className="conta">guarde referências</div></div>
          </Link>
          <Link to="/pedidos" className="bloco">
            <div className="emoji"><Icone nome="pedidos" /></div>
            <div><div className="nome">Pedidos</div><div className="conta">leves e rápidos</div></div>
          </Link>
          <Link to="/clientes" className="bloco">
            <div className="emoji"><Icone nome="clientes" /></div>
            <div><div className="nome">Clientes</div><div className="conta">com botão WhatsApp</div></div>
          </Link>
          <Link to="/calendario" className="bloco">
            <div className="emoji"><Icone nome="calendario" /></div>
            <div><div className="nome">Calendário</div><div className="conta">entregas do mês</div></div>
          </Link>
          <Link to="/cardapio" className="bloco">
            <div className="emoji"><Icone nome="precos" /></div>
            <div><div className="nome">Tabela de preços</div><div className="conta">seus preços de referência</div></div>
          </Link>
          <Link to="/anotacoes" className="bloco">
            <div className="emoji"><Icone nome="anotacoes" /></div>
            <div><div className="nome">Anotações</div><div className="conta">texto livre</div></div>
          </Link>
          <Link to="/propostas" className="bloco">
            <div className="emoji"><Icone nome="acompanhar" /></div>
            <div><div className="nome">Propostas</div><div className="conta">acompanhe as respostas</div></div>
          </Link>
        </div>

        <Link to="/planos" className="aviso-teste">
          <Icone nome="loja" size={18} /> Conheça o Plano Vitrine <span className="seta">Ver planos ›</span>
        </Link>
      </div>
    </div>
  )
}
