import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Icone } from '../components/Icone'
import { SeletorTema } from '../components/SeletorTema'
import { supabase } from '../lib/supabase'
import { useSessao } from '../hooks/useSessao'
import { useAssinatura } from '../hooks/useAssinatura'

/** Retorno da RPC `resumo_imagens_usuaria` (M-011). */
type ResumoImagens = {
  total: number
  trabalhos: number
  inspiracoes: number
  referencias: number
  na_vitrine: number // já cortado pelo número de slots da vitrine
}

export function Config() {
  const { sessao } = useSessao()
  const { plano, fundadora, total, limite, ilimitado } = useAssinatura(sessao?.user.id)

  // Detalhamento das imagens por categoria (M-011) — RPC dedicada.
  const [resumo, setResumo] = useState<ResumoImagens | null>(null)
  useEffect(() => {
    const uid = sessao?.user.id
    if (!uid) return
    supabase.rpc('resumo_imagens_usuaria', { uid }).then(({ data }) => {
      if (data) setResumo(data as ResumoImagens)
    })
  }, [sessao?.user.id])

  const resumoPlano = fundadora
    ? 'Fundadora · imagens sem limite'
    : plano === 'vitrine'
      ? 'Plano Vitrine · imagens sem limite'
      : `Grátis · ${total}/${limite} imagens`

  return (
    <div className="tela">
      <BarraTopo titulo="Configurações" />
      <div className="conteudo">
        <div className="lista card" style={{ padding: '4px 16px' }}>
          <Link to="/planos" className="item" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div className="bola"><Icone nome="plano" /></div>
            <div className="card-info">
              <div className="card-nome" style={{ fontSize: 'var(--t-base)' }}>Meu plano</div>
              <div className="apoio">{resumoPlano}</div>
            </div>
            <span aria-hidden>›</span>
          </Link>
          <div className="item" onClick={() => supabase.auth.signOut()} role="button" tabIndex={0}>
            <div className="bola"><Icone nome="sair" /></div>
            <div className="card-info">
              <div className="card-nome" style={{ fontSize: 'var(--t-base)' }}>Sair</div>
              <div className="apoio">Suas fotos continuam guardadas na nuvem</div>
            </div>
          </div>
        </div>

        {/* Identidade visual (Decisão #9) — 3 temas, só a cor muda. */}
        <SeletorTema />

        {resumo && (
          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-nome" style={{ fontSize: 'var(--t-base)' }}>
              {ilimitado
                ? `Você tem ${resumo.total} imagens`
                : `Você tem ${resumo.total} de ${limite} imagens`}
            </div>
            <div className="apoio" style={{ marginTop: 8, lineHeight: 1.9 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icone nome="trabalhos" size={16} /> Meus Trabalhos: {resumo.trabalhos} — destas, {resumo.na_vitrine} publicadas na vitrine
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icone nome="inspiracoes" size={16} /> Inspirações: {resumo.inspiracoes}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icone nome="precos" size={16} /> Referências de pedidos: {resumo.referencias}
              </div>
            </div>
          </div>
        )}

        {!ilimitado && (
          <p className="apoio" style={{ textAlign: 'center', marginTop: 14 }}>
            Plano Grátis: até {limite} imagens (trabalhos, inspirações e referências).
          </p>
        )}

        <nav className="legal-links" aria-label="Documentos legais">
          <Link to="/privacidade">Política de Privacidade</Link>
          <span className="legal-links-sep" aria-hidden>·</span>
          <Link to="/termos">Termos de Uso</Link>
        </nav>
      </div>
    </div>
  )
}
