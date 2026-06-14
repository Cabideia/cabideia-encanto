import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { supabase } from '../lib/supabase'

/**
 * M-017 (herói) — gestão da vitrine.
 *
 * Caminho único de fotos (decisão de produto): a usuária NÃO sobe fotos aqui.
 * Toda foto entra em "Meus trabalhos" (acervo) e é marcada para a vitrine pelo
 * botão 🛍️. Esta tela cuida só de: publicar/ocultar, link e compartilhar.
 */
type Perfil = {
  nome_negocio: string | null
  arroba: string | null
  vitrine_publicada: boolean
}

export function Vitrine() {
  const { sessao } = useSessao()
  const avisar = useAviso()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [qtdNaVitrine, setQtdNaVitrine] = useState<number>(0)

  useEffect(() => {
    if (!sessao) return
    async function carregar() {
      const { data } = await supabase
        .from('perfis')
        .select('nome_negocio, arroba, vitrine_publicada')
        .eq('id', sessao!.user.id)
        .maybeSingle()
      setPerfil(data)

      // Conta quantas fotos estão marcadas para a vitrine (informativo)
      const { count } = await supabase
        .from('trabalhos')
        .select('id', { count: 'exact', head: true })
        .eq('usuaria_id', sessao!.user.id)
        .eq('na_vitrine', true)
      setQtdNaVitrine(count ?? 0)

      setCarregando(false)
    }
    carregar()
  }, [sessao])

  async function alternarPublicacao() {
    if (!sessao || !perfil || salvando) return
    const novoValor = !perfil.vitrine_publicada
    setSalvando(true)
    const { error } = await supabase
      .from('perfis')
      .update({ vitrine_publicada: novoValor })
      .eq('id', sessao.user.id)
    setSalvando(false)
    if (error) {
      avisar('Erro ao salvar. Tente novamente.')
      return
    }
    setPerfil({ ...perfil, vitrine_publicada: novoValor })
    avisar(novoValor ? 'Vitrine publicada ✓' : 'Vitrine ocultada')
  }

  async function compartilhar() {
    if (!perfil?.arroba) return
    const url = `https://cabideia.com.br/encanto/@${perfil.arroba}`
    const nome = perfil.nome_negocio ?? `@${perfil.arroba}`
    const texto = `Veja os trabalhos de ${nome} ✨`
    if (navigator.share) {
      try {
        await navigator.share({ title: nome, text: texto, url })
      } catch {
        /* usuária cancelou */
      }
    } else {
      navigator.clipboard?.writeText(url)
      avisar('Link copiado ✓')
    }
  }

  if (carregando) return null

  const temArroba = !!perfil?.arroba
  const link = temArroba ? `cabideia.com.br/encanto/@${perfil!.arroba}` : ''
  const publicada = perfil?.vitrine_publicada ?? false

  return (
    <div className="tela">
      <BarraTopo titulo="Minha vitrine" />
      <div className="conteudo">
        <div className="vitrine-moldura">
          <div className="babado" />
          <div className="vitrine-corpo">
            <div className="logo-redonda">✨</div>
            <div className="nome-negocio">{perfil?.nome_negocio || 'Seu negócio'}</div>
            {temArroba ? (
              <>
                <div className="apoio">@{perfil!.arroba}</div>
                <div
                  className="link-vitrine"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    navigator.clipboard?.writeText('https://' + link)
                    avisar('Link copiado ✓')
                  }}
                >
                  🔗 {link} · copiar
                </div>
              </>
            ) : (
              <div className="apoio">Complete seu perfil para abrir a vitrine</div>
            )}
          </div>
        </div>

        {/* Toggle publicar/despublicar */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            margin: '16px 0', padding: '14px 16px', background: 'var(--acucar)',
            borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              {publicada ? '🟢 Vitrine publicada' : '⚫ Vitrine oculta'}
            </div>
            <div className="apoio" style={{ marginTop: 2 }}>
              {publicada ? 'Clientes podem ver sua vitrine' : 'Só você vê. Publique quando estiver pronta.'}
            </div>
          </div>
          <button
            onClick={alternarPublicacao}
            disabled={salvando || !temArroba}
            style={{
              flexShrink: 0, marginLeft: 12, padding: '8px 18px', borderRadius: 20,
              border: 'none', fontWeight: 600, fontSize: 14,
              cursor: salvando || !temArroba ? 'not-allowed' : 'pointer',
              background: publicada ? 'var(--neutro-suave)' : 'var(--framboesa)',
              color: publicada ? 'var(--cacau)' : '#fff',
              opacity: salvando ? 0.6 : 1, transition: 'all 0.2s',
            }}
          >
            {salvando ? '…' : publicada ? 'Ocultar' : 'Publicar'}
          </button>
        </div>

        {/* Compartilhar (só se publicada) */}
        {publicada && temArroba && (
          <button
            onClick={compartilhar}
            style={{
              width: '100%', padding: '14px', borderRadius: 16,
              border: '2px solid var(--framboesa)', background: 'transparent',
              color: 'var(--framboesa)', fontWeight: 600, fontSize: 15,
              cursor: 'pointer', marginBottom: 16,
            }}
          >
            📤 Compartilhar vitrine
          </button>
        )}

        {!temArroba && (
          <p className="apoio" style={{ textAlign: 'center', marginBottom: 8 }}>
            Complete seu perfil para poder publicar a vitrine.
          </p>
        )}

        {/* Editar perfil */}
        <Link to="/perfil" className="bloco" style={{ marginTop: 8 }}>
          <div className="emoji" aria-hidden>📝</div>
          <div className="texto">
            <div className="nome">{temArroba ? 'Editar perfil' : 'Completar perfil'}</div>
            <div className="conta">nome, @, WhatsApp, bio e nicho</div>
          </div>
          <span aria-hidden>›</span>
        </Link>

        {/* Origem das fotos: o acervo. Caminho único. */}
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="emoji" aria-hidden style={{ width: 42, height: 42, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: 'var(--framboesa-suave)' }}>
              🛍️
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--t-base)' }}>
                {qtdNaVitrine > 0
                  ? `${qtdNaVitrine} foto${qtdNaVitrine !== 1 ? 's' : ''} na vitrine`
                  : 'Nenhuma foto na vitrine ainda'}
              </div>
              <div className="apoio" style={{ marginTop: 2 }}>
                As fotos da vitrine vêm dos seus trabalhos. Em “Meus trabalhos”,
                toque no 🛍️ da foto para mostrá-la aqui.
              </div>
            </div>
          </div>
          <Link
            to="/acervo"
            className="btn-secundario"
            style={{ width: '100%', marginTop: 14, justifyContent: 'center' }}
          >
            Ir para Meus trabalhos
          </Link>
        </div>

        {temArroba && publicada && (
          <p className="apoio" style={{ textAlign: 'center', marginTop: 16 }}>
            👀 Veja como a cliente vê:{' '}
            <a
              href={`https://${link}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--framboesa)', fontWeight: 700 }}
            >
              abrir minha vitrine
            </a>
          </p>
        )}
      </div>
    </div>
  )
}

