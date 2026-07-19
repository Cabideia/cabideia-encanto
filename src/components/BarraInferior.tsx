import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icone } from './Icone'

/**
 * UX-017 · Barra inferior (Decisão #35): Início · Pedidos · ＋ · Agenda · Menu.
 *
 * Renderizada só nas telas privadas (dentro de `Privada` no App). As páginas
 * públicas, o login e as páginas legais seguem SEM barra (regra do CLAUDE.md).
 * O FAB abre a folha "O que você quer criar?"; o Menu abre a folha de destinos
 * que saíram da barra (Clientes fica a 1 toque aqui e no bloco da home).
 * Ambas usam o padrão .painel/.painel-overlay já existente no app.
 *
 * "Nova proposta" leva a /clientes (a proposta nasce da ficha da cliente —
 * fluxo atual; a criação de cliente inline é evolução do UX-018).
 * "Propostas" no Menu aponta para o Acompanhar até a fusão do UX-018.
 */
export function BarraInferior() {
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const [folha, setFolha] = useState<'criar' | 'menu' | null>(null)

  // Marca no <html> que a barra está presente — o CSS sobe .conteudo/.cta-area.
  useEffect(() => {
    document.documentElement.dataset.comBarra = 'sim'
    return () => {
      delete document.documentElement.dataset.comBarra
    }
  }, [])

  const ativo = (base: string) =>
    base === '/' ? pathname === '/' : pathname.startsWith(base)

  function ir(rota: string) {
    setFolha(null)
    navegar(rota)
  }

  return (
    <>
      <nav className="nav-inferior" aria-label="Navegação principal">
        <Link className={`nav-item${ativo('/') ? ' ativa' : ''}`} to="/">
          <Icone nome="inicio" size={21} />
          Início
        </Link>
        <Link className={`nav-item${ativo('/pedidos') ? ' ativa' : ''}`} to="/pedidos">
          <Icone nome="pedidos" size={21} />
          Pedidos
        </Link>
        <div className="nav-mais">
          <button type="button" className="fab" aria-label="Criar" onClick={() => setFolha('criar')}>
            <Icone nome="mais" size={26} strokeWidth={2.2} />
          </button>
        </div>
        <Link className={`nav-item${ativo('/calendario') ? ' ativa' : ''}`} to="/calendario">
          <Icone nome="calendario" size={21} />
          Agenda
        </Link>
        <button type="button" className="nav-item" onClick={() => setFolha('menu')}>
          <Icone nome="menu" size={21} />
          Menu
        </button>
      </nav>

      {folha === 'criar' && (
        <div className="painel-overlay" onClick={() => setFolha(null)}>
          <div className="painel" onClick={(e) => e.stopPropagation()}>
            <div className="painel-puxador" />
            <div className="folha-titulo">O que você quer criar?</div>
            <button className="acao-folha" onClick={() => ir('/pedidos/novo')}>
              <span className="acao-ico"><Icone nome="pedidos" /></span>
              <span>Novo pedido<span className="acao-sub">Uma encomenda de cliente</span></span>
            </button>
            <button className="acao-folha" onClick={() => ir('/clientes')}>
              <span className="acao-ico"><Icone nome="enviar" /></span>
              <span>Nova proposta<span className="acao-sub">Escolha a cliente para começar</span></span>
            </button>
            <button className="acao-folha" onClick={() => ir('/acervo/novo')}>
              <span className="acao-ico"><Icone nome="camera" /></span>
              <span>Guardar trabalho<span className="acao-sub">Foto de algo que você fez</span></span>
            </button>
            <button className="acao-folha" onClick={() => ir('/inspiracoes/nova')}>
              <span className="acao-ico"><Icone nome="inspiracoes" /></span>
              <span>Nova inspiração<span className="acao-sub">Foto ou link de uma ideia</span></span>
            </button>
          </div>
        </div>
      )}

      {folha === 'menu' && (
        <div className="painel-overlay" onClick={() => setFolha(null)}>
          <div className="painel" onClick={(e) => e.stopPropagation()}>
            <div className="painel-puxador" />
            <button className="acao-folha" onClick={() => ir('/clientes')}>
              <span className="acao-ico"><Icone nome="clientes" /></span>Clientes
            </button>
            <button className="acao-folha" onClick={() => ir('/acompanhar')}>
              <span className="acao-ico"><Icone nome="acompanhar" /></span>Propostas
            </button>
            <button className="acao-folha" onClick={() => ir('/acervo')}>
              <span className="acao-ico"><Icone nome="trabalhos" /></span>Meus Trabalhos
            </button>
            <button className="acao-folha" onClick={() => ir('/inspiracoes')}>
              <span className="acao-ico"><Icone nome="inspiracoes" /></span>Inspirações
            </button>
            <button className="acao-folha" onClick={() => ir('/vitrine')}>
              <span className="acao-ico"><Icone nome="vitrine" /></span>Minha vitrine
            </button>
            <button className="acao-folha" onClick={() => ir('/cardapio')}>
              <span className="acao-ico"><Icone nome="precos" /></span>Tabela de preços
            </button>
            <button className="acao-folha" onClick={() => ir('/config')}>
              <span className="acao-ico"><Icone nome="config" /></span>Configurações
            </button>
          </div>
        </div>
      )}
    </>
  )
}
