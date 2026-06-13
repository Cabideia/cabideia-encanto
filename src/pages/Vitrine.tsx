import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { supabase } from '../lib/supabase'

/**
 * M-017 (herói) — gestão da vitrine.
 * Etapa 1: lê o perfil real e oferece completar/editar o perfil.
 * (As fotos na vitrine e o publicar/compartilhar chegam nas próximas etapas.)
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

  useEffect(() => {
    if (!sessao) return
    supabase
      .from('perfis')
      .select('nome_negocio, arroba, vitrine_publicada')
      .eq('id', sessao.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setPerfil(data)
        setCarregando(false)
      })
  }, [sessao])

  if (carregando) return null

  const temArroba = !!perfil?.arroba
  const link = temArroba ? `cabideia.com.br/encanto/@${perfil!.arroba}` : ''

  return (
    <div className="tela">
      <BarraTopo titulo="Minha vitrine" />
      <div className="conteudo">
        <div className="vitrine-moldura">
          <div className="babado" />
          <div className="vitrine-corpo">
            <div className="logo-redonda">✨</div>
            <div className="nome-negocio">
              {perfil?.nome_negocio || 'Seu negócio'}
            </div>

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

        <div style={{ marginTop: 16 }}>
          <Link to="/perfil" className="bloco">
            <div className="emoji" aria-hidden>📝</div>
            <div className="texto">
              <div className="nome">{temArroba ? 'Editar perfil' : 'Completar perfil'}</div>
              <div className="conta">nome, @, WhatsApp, bio e nicho</div>
            </div>
            <span aria-hidden>›</span>
          </Link>
        </div>

        <p className="apoio" style={{ textAlign: 'center', marginTop: 16 }}>
          Em breve: escolher trabalhos do acervo para aparecer aqui e publicar sua vitrine.
        </p>
      </div>
    </div>
  )
}
