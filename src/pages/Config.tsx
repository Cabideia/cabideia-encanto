import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
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
    ? 'Fundadora · imagens sem limite ✨'
    : plano === 'vitrine'
      ? 'Plano Vitrine · imagens sem limite ✨'
      : `Grátis · ${total}/${limite} imagens`

  return (
    <div className="tela">
      <BarraTopo titulo="Configurações" />
      <div className="conteudo">
        <div className="lista card" style={{ padding: '4px 16px' }}>
          <Link to="/planos" className="item" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div className="bola">🎀</div>
            <div className="card-info">
              <div className="card-nome" style={{ fontSize: 'var(--t-base)' }}>Meu plano</div>
              <div className="apoio">{resumoPlano}</div>
            </div>
            <span aria-hidden>›</span>
          </Link>
          <div className="item" onClick={() => supabase.auth.signOut()} role="button" tabIndex={0}>
            <div className="bola">👋</div>
            <div className="card-info">
              <div className="card-nome" style={{ fontSize: 'var(--t-base)' }}>Sair</div>
              <div className="apoio">Suas fotos continuam guardadas na nuvem</div>
            </div>
          </div>
        </div>

        {resumo && (
          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-nome" style={{ fontSize: 'var(--t-base)' }}>
              {ilimitado
                ? `Você tem ${resumo.total} imagens`
                : `Você tem ${resumo.total} de ${limite} imagens`}
            </div>
            <p className="apoio" style={{ marginTop: 8, lineHeight: 1.6 }}>
              🛍️ Meus Trabalhos: {resumo.trabalhos} · 💡 Inspirações: {resumo.inspiracoes} · 📋 Referências de pedidos: {resumo.referencias} · 🌐 Na vitrine: {resumo.na_vitrine}
            </p>
          </div>
        )}

        {!ilimitado && (
          <p className="apoio" style={{ textAlign: 'center', marginTop: 14 }}>
            Plano Grátis: até {limite} imagens (trabalhos, inspirações e referências).
          </p>
        )}
      </div>
    </div>
  )
}
