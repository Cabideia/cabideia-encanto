import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { urlPublica } from '../lib/storage'
import { aplicarTema } from '../lib/tema'
import { Icone } from '../components/Icone'
import { useSessao } from '../hooks/useSessao'

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
  tema: string | null
}

type FotoPublica = {
  id: string
  url: string
  descricao: string | null
  tags: { id: string; nome: string }[]
}

type ItemCardapioPublico = {
  id: string
  nome: string
  detalhes: string | null
  unidade: string | null
  preco_base: number | null
  preco_sob_consulta: boolean
}

/** Preço exibido na vitrine: R$ valor (se houver e não for sob consulta) ou texto. */
function precoVitrine(item: ItemCardapioPublico): string {
  if (item.preco_base != null && !item.preco_sob_consulta) {
    const valor = item.preco_base.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    return item.unidade ? `${valor} · ${item.unidade}` : valor
  }
  return 'Preço sob consulta'
}

const MSG_WHATSAPP = 'Olá! Vi seus trabalhos e gostaria de um orçamento'

export function VitrinePublica() {
  const { arroba } = useParams()
  const usuaria = (arroba ?? '').replace(/^@/, '')
  const { sessao } = useSessao()

  const [perfil, setPerfil] = useState<PerfilPublico | null>(null)
  const [fotos, setFotos] = useState<FotoPublica[]>([])
  const [cardapio, setCardapio] = useState<ItemCardapioPublico[]>([])
  const [carregando, setCarregando] = useState(true)
  const [tagFiltro, setTagFiltro] = useState<string | null>(null)

  useEffect(() => {
    if (!usuaria) {
      setCarregando(false)
      return
    }
    async function carregar() {
      // Cabeçalho da vitrine via RPC SECURITY DEFINER: devolve só as colunas
      // públicas de um perfil PUBLICADO. O anon não tem SELECT direto em `perfis`
      // (evita raspagem em massa de telefones/dados das vitrines).
      const { data: rows } = await supabase.rpc('perfil_vitrine', { arroba: usuaria })
      const p = ((rows ?? []) as PerfilPublico[])[0] ?? null

      setPerfil(p)
      // Página pública: pinta com o tema da dona (default oficina se vier vazio).
      aplicarTema(p?.tema, false)

      if (p) {
        // O corte por plano (slots_vitrine_publica) é SERVER-SIDE: a cliente é
        // anônima, então a RPC `vitrine_publica` devolve só os N trabalhos mais
        // recentes na vitrine (N = NULL ⇒ sem limite para Fundadora/Vitrine).
        const { data: t } = await supabase.rpc('vitrine_publica', { arroba: usuaria })

        setFotos(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((t ?? []) as any[]).map((x) => ({
            id: x.id,
            descricao: x.descricao,
            url: urlPublica(x.foto_publica_path),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tags: ((x.tags ?? []) as any[]).map((tg) => ({ id: tg.id, nome: tg.nome })),
          }))
        )

        // Cardápio público (server-side, anônimo): só itens marcados na vitrine.
        const { data: c } = await supabase.rpc('cardapio_publico', { arroba: usuaria })
        setCardapio((c ?? []) as ItemCardapioPublico[])
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
          <div className="logo-redonda" style={{ margin: '0 auto 16px' }}>
            <Icone nome="brilho" size={26} />
          </div>
          <div className="nome-negocio">Vitrine não encontrada</div>
          <p className="apoio" style={{ marginTop: 8 }}>
            Esta vitrine não existe ou ainda não foi publicada.
          </p>
          <p className="apoio" style={{ textAlign: 'center', marginTop: 24 }}>
            feito com <b style={{ color: 'var(--framboesa)' }}>Cabideia Encanto</b>
          </p>
        </div>
      </div>
    )
  }

  const logoUrl = perfil.logo_path ? urlPublica(perfil.logo_path) : null

  // Só a dona logada vê o banner de volta — para a cliente a página é 100% pública.
  const dona = sessao?.user.id === perfil.id

  return (
    <div className="tela">
      <div className="conteudo" style={{ paddingTop: 16 }}>
        {dona && (
          <Link
            to="/vitrine"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 14px', marginBottom: 14, borderRadius: 14,
              background: 'var(--acento-suave)', color: 'var(--acento)',
              fontWeight: 600, fontSize: 14, textDecoration: 'none',
            }}
          >
            ← Voltar · você está vendo sua vitrine como a cliente vê
          </Link>
        )}
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
                (perfil.nome_negocio || usuaria).trim().charAt(0).toUpperCase()
              )}
            </div>
            <div className="nome-negocio">{perfil.nome_negocio || `@${usuaria}`}</div>
            {perfil.cidade && (
              <div className="apoio" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icone nome="local" size={14} /> {perfil.cidade}
              </div>
            )}
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

        {/* Cardápio público — só aparece se houver ao menos 1 item na vitrine */}
        {cardapio.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div className="nome-negocio" style={{ textAlign: 'center', fontSize: 'var(--t-card)' }}>
              Tabela de preços
            </div>
            <div style={{ marginTop: 12 }}>
              {cardapio.map((item) => (
                <div key={item.id} className="card">
                  <div className="card-linha">
                    <div className="card-info">
                      <div className="card-nome">{item.nome}</div>
                      {item.detalhes && (
                        <div className="apoio" style={{ marginTop: 2 }}>{item.detalhes}</div>
                      )}
                    </div>
                    <div className="cardapio-preco">{precoVitrine(item)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="apoio" style={{ textAlign: 'center', marginTop: 16 }}>
          feito com <b style={{ color: 'var(--framboesa)' }}>Cabideia Encanto</b>
        </p>
      </div>

      {perfil.whatsapp && (
        <div className="cta-area">
          <button className="cta" onClick={abrirWhatsApp}>
            <Icone nome="whatsapp" /> Pedir pelo WhatsApp
          </button>
        </div>
      )}
    </div>
  )
}

