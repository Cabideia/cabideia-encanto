import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Icone } from '../components/Icone'
import { SeletorTema } from '../components/SeletorTema'
import { VersaoApp } from '../components/VersaoApp'
import { supabase } from '../lib/supabase'
import { useSessao } from '../hooks/useSessao'
import { useAssinatura } from '../hooks/useAssinatura'
import { useAviso } from '../components/Toast'

/** Palavra que a usuária precisa digitar para liberar a exclusão (M-033). */
const PALAVRA_CONFIRMA = 'EXCLUIR'

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
  const navegar = useNavigate()
  const avisar = useAviso()

  // M-033 · exclusão real da conta. Abre confirmação que só libera o botão
  // quando a usuária digita EXCLUIR; aí invoca a Edge Function `excluir-conta`.
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [textoConfirma, setTextoConfirma] = useState('')
  const [excluindo, setExcluindo] = useState(false)

  const podeExcluir = textoConfirma.trim().toUpperCase() === PALAVRA_CONFIRMA

  function fecharConfirma() {
    if (excluindo) return // não deixa fechar no meio da exclusão
    setConfirmandoExclusao(false)
    setTextoConfirma('')
  }

  async function excluirConta() {
    if (!podeExcluir || excluindo) return
    setExcluindo(true)
    const { error } = await supabase.functions.invoke('excluir-conta', { method: 'POST' })
    if (error) {
      setExcluindo(false)
      avisar('Não foi possível excluir. Tente novamente.')
      return
    }
    // Sucesso: encerra a sessão e volta para a tela de entrada.
    avisar('Conta excluída')
    await supabase.auth.signOut()
    navegar('/entrar', { replace: true })
  }

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

        {/* M-033 · Exclusão REAL da conta de dentro do app (exigência do Google
            Play). Ação destrutiva: cor framboesa (a do design system). Abre a
            confirmação por digitação — não navega mais para a página de texto. */}
        <div className="lista card" style={{ padding: '4px 16px', marginTop: 18 }}>
          <div
            className="item"
            role="button"
            tabIndex={0}
            onClick={() => setConfirmandoExclusao(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setConfirmandoExclusao(true)
            }}
            style={{ color: 'var(--framboesa)' }}
          >
            <div className="bola" style={{ color: 'var(--framboesa)' }}>
              <Icone nome="lixo" />
            </div>
            <div className="card-info">
              <div className="card-nome" style={{ fontSize: 'var(--t-base)', color: 'var(--framboesa)' }}>
                Excluir minha conta
              </div>
              <div className="apoio">Apague sua conta e todos os seus dados</div>
            </div>
            <span aria-hidden style={{ color: 'var(--framboesa)' }}>›</span>
          </div>
        </div>

        <nav className="legal-links" aria-label="Documentos legais">
          <Link to="/privacidade">Política de Privacidade</Link>
          <span className="legal-links-sep" aria-hidden>·</span>
          <Link to="/termos">Termos de Uso</Link>
        </nav>

        {/* Versão do bundle carregado — confirma no device que o deploy subiu. */}
        <VersaoApp />
      </div>

      {/* M-033 · Confirmação por digitação. O botão de exclusão só habilita
          quando o campo bate com EXCLUIR — barreira contra toque acidental. */}
      {confirmandoExclusao && (
        <div className="confirmar-overlay" onClick={fecharConfirma}>
          <div
            className="confirmar-caixa"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-label="Excluir minha conta"
          >
            <div className="confirmar-titulo">Excluir minha conta</div>
            <p className="confirmar-desc">
              Esta ação é definitiva. Apagamos seu perfil, suas fotos, pedidos,
              clientes e tudo o que está na sua conta. Não dá para desfazer.
              <br />
              Para confirmar, digite <strong>{PALAVRA_CONFIRMA}</strong> abaixo.
            </p>
            <div className="campo" style={{ marginBottom: 18 }}>
              <input
                type="text"
                value={textoConfirma}
                onChange={(e) => setTextoConfirma(e.target.value)}
                placeholder={PALAVRA_CONFIRMA}
                autoFocus
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                disabled={excluindo}
                aria-label={`Digite ${PALAVRA_CONFIRMA} para confirmar`}
                style={{ textAlign: 'center', textTransform: 'uppercase', letterSpacing: '.1em' }}
              />
            </div>
            <div className="confirmar-botoes">
              <button
                type="button"
                className="btn-secundario"
                onClick={fecharConfirma}
                disabled={excluindo}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="confirmar-perigo"
                onClick={excluirConta}
                disabled={!podeExcluir || excluindo}
                style={{ opacity: podeExcluir && !excluindo ? 1 : 0.5 }}
              >
                {excluindo ? 'Excluindo…' : 'Excluir conta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
