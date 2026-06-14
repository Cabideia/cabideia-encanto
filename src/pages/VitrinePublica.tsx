import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * M-017 · Etapa 3 — Vitrine pública (cabideia.com.br/encanto/@usuaria).
 *
 * Rota SEM login. Lê perfis publicados e fotos na vitrine (RLS garante).
 * Ponto 2: as tags das fotos publicadas viram filtros para a cliente navegar
 * (ex.: "Natal", "infantil"). Só aparecem tags de fotos que estão na vitrine —
 * garantido pelas políticas vitrine_tags_publicas / vitrine_trabalho_tags_publicos.
 */
type PerfilPublico = {
  id: string
  nome_negocio: string | null
  bio: string | null
  cidade: string | null
  nicho: string | null
  whatsapp: string | null
  logo_path: string | null
}

type FotoPublica = {
  id: string
  url: string
  descricao: string | null
  tags: { id: string; nome: string }[]
}

const MSG_WHATSAPP = 'Olá! Vi seus trabalhos e gostaria de um orçamento'

export function VitrinePublica() {
  const { arroba } = useParams()
  const usuaria = (arroba ?? '').replace(/^@/, '')

  const [perfil, setPerfil] = useState<PerfilPublico | null>(null)
  const [fotos, setFotos] = useState<FotoPublica[]>([])
  const [carregando, setCarregando] = useState(true)
  const [tagFiltro, setTagFiltro] = useState<string | null>(null)

  useEffect(() => {
    if (!usuaria) {
      setCarregando(false)
      return
    }
    async function carregar() {
      const { data: p } = await supabase
        .from('perfis')
        .select('id, nome_negocio, bio, cidade, nicho, whatsapp, logo_path')
        .eq('arroba', usuaria)
        .eq('vitrine_publicada', true)
        .maybeSingle()

      setPerfil(p)

      if (p) {
        const { data: t } = await supabase
          .from('trabalhos')
          .select('id, foto_publica_path, descricao, trabalho_tags(tags(id, nome))')
          .eq('usuaria_id', (p as any).id)
          .eq('na_vitrine', true)
          .order('criado_em', { ascending: false })

        setFotos(
          (t ?? [])
            .filter((x: any) => x.foto_publica_path)
            .map((x: any) => ({
              id: x.id,
              descricao: x.descricao,
              url: supabase.storage.from('publico').getPublicUrl(x.foto_publica_path).data.publicUrl,
              tags: (x.trabalho_tags ?? [])
                .filter((wt: any) => wt.tags)
                .map((wt: any) => ({ id: wt.tags.id, nome: wt.tags.nome })),
            }))
        )
      }
      setCarregando(false)
    }
    carregar()
  }, [usuaria])

  // Tags presentes nas fotos publicadas (únicas), para a barra de filtro.
  const tagsDisponiveis = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const f of fotos) for (const t of f.tags) mapa.set(t.id, t.nome)
    return Array.from(mapa, ([id, nome]) => ({ id, nome })).sort((a, b) =>
      a.nome.localeCompare(b.nome)
    )
  }, [fotos])

  const fotosFiltradas = tagFiltro
    ? fotos.filter((f) => f.tags.some((t) => t.id === tagFiltro))
    : fotos

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

        {/* Filtro por tag (só aparece se houver tags nas fotos publicadas) */}
        {tagsDisponiveis.length > 0 && (
          <div className="filtros">
            <button
              className={`filtro${!tagFiltro ? ' ativo' : ''}`}
              onClick={() => setTagFiltro(null)}
            >
              Tudo
            </button>
            {tagsDisponiveis.map((tag) => (
              <button
                key={tag.id}
                className={`filtro${tagFiltro === tag.id ? ' ativo' : ''}`}
                onClick={() => setTagFiltro(tagFiltro === tag.id ? null : tag.id)}
              >
                {tag.nome}
              </button>
            ))}
          </div>
        )}

        {fotosFiltradas.length > 0 ? (
          <div className="grade-fotos" style={{ marginTop: 16 }}>
            {fotosFiltradas.map((f) => (
              <div key={f.id} className="foto-item">
                <img src={f.url} alt={f.descricao ?? ''} loading="lazy" />
                {f.descricao && <div className="foto-legenda">{f.descricao}</div>}
              </div>
            ))}
          </div>
        ) : (
          <p className="apoio" style={{ textAlign: 'center', marginTop: 24 }}>
            {tagFiltro ? 'Nenhuma foto nesta categoria.' : 'Vitrine ainda sem fotos.'}
          </p>
        )}

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

