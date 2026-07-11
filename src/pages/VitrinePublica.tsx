import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
  codigo_num: number | null
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
  const navigate = useNavigate()

  const [perfil, setPerfil] = useState<PerfilPublico | null>(null)
  const [fotos, setFotos] = useState<FotoPublica[]>([])
  const [cardapio, setCardapio] = useState<ItemCardapioPublico[]>([])
  const [carregando, setCarregando] = useState(true)
  const [tagFiltro, setTagFiltro] = useState<string | null>(null)
  // UX-011 — abas da vitrine pública (Vitrine | Tabela de preços)
  const [aba, setAba] = useState<'vitrine' | 'precos'>('vitrine')
  // UX-009 — legenda em overlay: toque na foto amplia e mostra a legenda
  const [ampliada, setAmpliada] = useState<FotoPublica | null>(null)

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
            codigo_num: x.codigo_num ?? null,
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

  // Voltar de verdade (pop): um push para /vitrine deixava a vitrine no
  // histórico e a seta nativa do Android voltava PARA ela (pingue-pongue).
  // Sem histórico no app (link direto), navigate(-1) sairia do app —
  // fallback para a home substituindo a entrada atual.
  function voltarDoBanner() {
    const podeVoltar = window.history.state?.idx > 0
    if (podeVoltar) navigate(-1)
    else navigate('/', { replace: true })
  }

  return (
    <div className="tela">
      <div className="conteudo" style={{ paddingTop: 16 }}>
        {dona && (
          <button
            type="button"
            onClick={voltarDoBanner}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              width: '100%', border: 'none', cursor: 'pointer',
              padding: '10px 14px', marginBottom: 14, borderRadius: 14,
              background: 'var(--acento-suave)', color: 'var(--acento)',
              fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
            }}
          >
            ← Voltar · você está vendo sua vitrine como a cliente vê
          </button>
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

        {/* UX-011 — abas da vitrine pública. Só aparecem quando existe tabela de
            preços (sem itens não faz sentido uma aba vazia na página pública da
            dona). Usam .escolha/.filtro, que já herdam os tokens dos 3 temas (M-030). */}
        {cardapio.length > 0 && (
          <div className="escolha" style={{ marginTop: 16, justifyContent: 'center' }}>
            <button
              type="button"
              className={`filtro${aba === 'vitrine' ? ' ativo' : ''}`}
              onClick={() => setAba('vitrine')}
            >
              <Icone nome="vitrine" size={15} /> Vitrine
            </button>
            <button
              type="button"
              className={`filtro${aba === 'precos' ? ' ativo' : ''}`}
              onClick={() => setAba('precos')}
            >
              <Icone nome="precos" size={15} /> Tabela de preços
            </button>
          </div>
        )}

        {aba === 'vitrine' || cardapio.length === 0 ? (
          <>
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

            {/* UX-009 — cards só com a imagem; a legenda vira overlay ao tocar. */}
            {fotosFiltradas.length > 0 ? (
              <div className="grade-fotos" style={{ marginTop: 16 }}>
                {fotosFiltradas.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="foto-item foto-item-toque"
                    onClick={() => setAmpliada(f)}
                    aria-label={f.descricao ? `Ver legenda: ${f.descricao}` : 'Ampliar foto'}
                  >
                    <img src={f.url} alt={f.descricao ?? ''} loading="lazy" />
                    {/* UX-015 — código A-{n} para a cliente sinalizar ("gostei da A-3").
                        Mesmo selo da triagem pública (F2b). */}
                    {f.codigo_num != null && (
                      <span className="cod-selo" aria-label={`Código A-${f.codigo_num}`}>
                        A-{f.codigo_num}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="apoio" style={{ textAlign: 'center', marginTop: 24 }}>
                {tagFiltro ? 'Nenhuma foto nesta categoria.' : 'Vitrine ainda sem fotos.'}
              </p>
            )}
          </>
        ) : (
          /* Aba Tabela de preços */
          <div style={{ marginTop: 16 }}>
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

      {/* UX-009 — foto ampliada com a legenda em overlay (toque para fechar). */}
      {ampliada && (
        <div
          className="lightbox-overlay"
          onClick={() => setAmpliada(null)}
          role="dialog"
          aria-label="Foto ampliada"
        >
          <button
            type="button"
            className="lightbox-fechar"
            onClick={() => setAmpliada(null)}
            aria-label="Fechar"
          >
            <Icone nome="fechar" size={18} />
          </button>
          <div className="lightbox-quadro" onClick={(e) => e.stopPropagation()}>
            <img src={ampliada.url} alt={ampliada.descricao ?? ''} />
            {ampliada.descricao && (
              <div className="lightbox-legenda">{ampliada.descricao}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

