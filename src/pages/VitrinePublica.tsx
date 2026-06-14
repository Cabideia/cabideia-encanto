import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * M-017 · Etapa 3 — Vitrine pública (cabideia.com.br/encanto/@usuaria).
 *
 * Rota SEM login: é o que a cliente final vê. Lê do banco apenas perfis com
 * vitrine_publicada = true (a política RLS vitrine_perfil_publico garante isso;
 * perfis não publicados simplesmente não retornam).
 */
type PerfilPublico = {
  nome_negocio: string | null
  bio: string | null
  cidade: string | null
  nicho: string | null
  whatsapp: string | null
  logo_path: string | null
}

const MSG_WHATSAPP = 'Olá! Vi seus trabalhos e gostaria de um orçamento'

export function VitrinePublica() {
  const { arroba } = useParams()
  const usuaria = (arroba ?? '').replace(/^@/, '')

  const [perfil, setPerfil] = useState<PerfilPublico | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!usuaria) {
      setCarregando(false)
      return
    }
    supabase
      .from('perfis')
      .select('nome_negocio, bio, cidade, nicho, whatsapp, logo_path')
      .eq('arroba', usuaria)
      .eq('vitrine_publicada', true)
      .maybeSingle()
      .then(({ data }) => {
        setPerfil(data)
        setCarregando(false)
      })
  }, [usuaria])

  function abrirWhatsApp() {
    if (!perfil?.whatsapp) return
    let num = perfil.whatsapp.replace(/\D/g, '')
    if (num.length <= 11) num = '55' + num
    const texto = encodeURIComponent(MSG_WHATSAPP)
    window.open(`https://wa.me/${num}?text=${texto}`, '_blank')
  }

  if (carregando) {
    return (
      <div className="tela">
        <div className="conteudo" style={{ paddingTop: 40, textAlign: 'center' }}>
          <p className="apoio">Carregando…</p>
        </div>
      </div>
    )
  }

  if (!perfil) {
    return (
      <div className="tela">
        <div className="conteudo" style={{ paddingTop: 40, textAlign: 'center' }}>
          <div className="logo-redonda" style={{ margin: '0 auto 16px' }}>✨</div>
          <div className="nome-negocio">Vitrine não encontrada</div>
          <p className="apoio" style={{ marginTop: 8 }}>
            Esta vitrine não existe ou ainda não foi publicada.
          </p>
          <p className="apoio" style={{ textAlign: 'center', marginTop: 24 }}>
            feito com <b style={{ color: 'var(--framboesa)' }}>Cabideia Encanto</b> ✨
          </p>
        </div>
      </div>
    )
  }

  const logoUrl = perfil.logo_path
    ? supabase.storage.from('publico').getPublicUrl(perfil.logo_path).data.publicUrl
    : null

  return (
    <div className="tela">
      <div className="conteudo" style={{ paddingTop: 16 }}>
        <div className="vitrine-moldura">
          <div className="babado" />
          <div className="vitrine-corpo">
            <div className="logo-redonda">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={perfil.nome_negocio ?? ''}
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                '✨'
              )}
            </div>
            <div className="nome-negocio">{perfil.nome_negocio || `@${usuaria}`}</div>
            {perfil.cidade && <div className="apoio">📍 {perfil.cidade}</div>}
            {perfil.bio && (
              <p className="apoio" style={{ marginTop: 8, textAlign: 'center' }}>
                {perfil.bio}
              </p>
            )}
          </div>
        </div>

        <p className="apoio" style={{ textAlign: 'center', marginTop: 16 }}>
          feito com <b style={{ color: 'var(--framboesa)' }}>Cabideia Encanto</b> ✨
        </p>
      </div>

      {perfil.whatsapp && (
        <div className="cta-area">
          <button className="cta" onClick={abrirWhatsApp}>
            💬 Pedir pelo WhatsApp
          </button>
        </div>
      )}
    </div>
  )
}
