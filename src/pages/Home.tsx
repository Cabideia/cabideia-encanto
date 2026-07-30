import { Link } from 'react-router-dom'
import { useSessao } from '../hooks/useSessao'
import { usePedidos, tituloPedido, STATUS_INFO, PAGAMENTO_CURTO } from '../hooks/usePedidos'
import { usePropostas } from '../hooks/usePropostas'
import { dataLocal } from '../lib/datas'
import { Icone } from '../components/Icone'

// Bloco de data do card de entrega: dia da semana curto derivado da data_entrega
// com Intl, sem tocar no `rotuloEntrega` (que é usado em outras telas).
const DIA_SEMANA = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })

/** Home em blocos (UX-001): engrenagem no topo; a navegação é pela barra inferior. */
export function Home() {
  const { sessao } = useSessao()
  const { proximasEntregas } = usePedidos(sessao?.user.id)
  // Resumo enxuto na home: as próximas entregas de 7 dias. A visão completa
  // (mês a mês) vive no Calendário, alcançável pelo "Ver agenda".
  const entregas = proximasEntregas('7d')
  // Decisão #101 · atalho vivo de propostas aguardando: custa UMA consulta nova
  // na Home (o usePropostas busca todas as propostas da dona). Aceito por ser o
  // coração do item 3a; registrado aqui para a próxima onda não achar descuido.
  const { propostas } = usePropostas(sessao?.user.id)
  const aguardando = propostas.filter((p) => !p.resolvida).length
  const nome = sessao?.user.user_metadata?.name?.split(' ')[0] ?? 'confeiteira'
  // Formato curto para caber em uma linha no `.titulo` (22px) sem inline style.
  const hoje = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short', day: 'numeric', month: 'long'
  }).format(new Date())

  return (
    <div className="tela">
      <div className="barra">
        <span className="vaga" />
        <div className="titulo">{hoje}</div>
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
          <Link to="/calendario" className="secao-link">Ver agenda <Icone nome="avancar" size={15} /></Link>
        </div>
        {entregas.length === 0 ? (
          <p className="apoio">
            Nenhuma entrega nos próximos 7 dias. Veja o mês todo no{' '}
            <Link to="/calendario" className="link-texto">Calendário</Link>.
          </p>
        ) : (
          <div className="entregas">
            {entregas.map((p) => {
              const info = STATUS_INFO[p.status]
              const d = p.data_entrega ? dataLocal(p.data_entrega) : null
              return (
                <Link key={p.id} to={`/pedidos/${p.id}`} className="entrega">
                  {d && (
                    <div className="entrega-data">
                      <span className="dia-semana">{DIA_SEMANA.format(d).replace('.', '')}</span>
                      <span className="dia-num">{d.getDate()}</span>
                    </div>
                  )}
                  <div className="entrega-info">
                    <div className="o-que">{tituloPedido(p)}</div>
                    <div className="apoio">
                      {p.cliente_nome ?? 'sem cliente'}
                      {p.status_pagamento !== 'nao_pago' ? ` · ${PAGAMENTO_CURTO[p.status_pagamento]}` : ''}
                    </div>
                    <span className={`chip ${info.chip}`}>{info.rotulo}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Decisão #101 · atalho vivo — só renderiza com pendências (vazio é ruído). */}
        {aguardando > 0 && (
          <Link to="/propostas" className="aviso-teste">
            <Icone nome="acompanhar" size={18} />
            {aguardando === 1
              ? '1 proposta aguardando resposta'
              : `${aguardando} propostas aguardando resposta`}
            <span className="seta"><Icone nome="avancar" size={16} /></span>
          </Link>
        )}

        <div className="secao"><span className="confeito" /><h2>Meu ateliê</h2></div>
        <div className="blocos">
          <Link to="/acervo" className="bloco">
            <div className="emoji"><Icone nome="trabalhos" /></div>
            <div><div className="nome">Meus trabalhos</div><div className="conta">suas fotos na nuvem</div></div>
          </Link>
          <Link to="/vitrine" className="bloco">
            <div className="emoji"><Icone nome="vitrine" /></div>
            <div><div className="nome">Minha vitrine</div><div className="conta">monte e compartilhe seu link</div></div>
          </Link>
          <Link to="/cardapio" className="bloco">
            <div className="emoji"><Icone nome="precos" /></div>
            <div><div className="nome">Tabela de preços</div><div className="conta">seus preços de referência</div></div>
          </Link>
          <Link to="/inspiracoes" className="bloco">
            <div className="emoji"><Icone nome="inspiracoes" /></div>
            <div><div className="nome">Inspirações</div><div className="conta">guarde referências</div></div>
          </Link>
        </div>

        <Link to="/planos" className="aviso-teste">
          <Icone nome="loja" size={18} /> Conheça o Plano Vitrine <span className="seta">Ver planos <Icone nome="avancar" size={16} /></span>
        </Link>
      </div>
    </div>
  )
}
