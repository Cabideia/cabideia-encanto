import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { PerfilForm } from '../components/PerfilForm'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { supabase } from '../lib/supabase'
import { SEM_CONEXAO, estaOffline } from '../lib/conexao'

/**
 * M-017 (herói) — gestão da vitrine.
 *
 * Caminho único de fotos (decisão de produto): a usuária NÃO sobe fotos aqui.
 * Toda foto entra em "Meus trabalhos" (acervo) e é marcada para a vitrine pelo
 * botão 🛍️. Esta tela cuida só de: editar perfil, publicar/ocultar, link e
 * compartilhar.
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
  const [editarPerfil, setEditarPerfil] = useState(false)

  const carregar = useCallback(async () => {
    if (!sessao) return
    const { data } = await supabase
      .from('perfis')
      .select('nome_negocio, arroba, vitrine_publicada')
      .eq('id', sessao.user.id)
      .maybeSingle()
    setPerfil(data)

    // Conta quantas fotos estão marcadas para a vitrine (informativo)
    const { count } = await supabase
      .from('trabalhos')
      .select('id', { count: 'exact', head: true })
      .eq('usuaria_id', sessao.user.id)
      .eq('na_vitrine', true)
    setQtdNaVitrine(count ?? 0)

    setCarregando(false)
  }, [sessao])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function alternarPublicacao() {
    if (!sessao || !perfil || salvando) return
    if (estaOffline()) return avisar(SEM_CONEXAO)
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
    const texto = `Veja os trabalhos de ${nome}`
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

  /** Copia o link público da vitrine. Usada no endereço da moldura (toque e
      Enter) e no botão "Copiar link" — uma regra só, três gatilhos. */
  function copiarLink() {
    if (!perfil?.arroba) return
    navigator.clipboard?.writeText(`https://cabideia.com.br/encanto/@${perfil.arroba}`)
    avisar('Link copiado ✓')
  }

  if (carregando) return null

  const temArroba = !!perfil?.arroba
  const link = temArroba ? `cabideia.com.br/encanto/@${perfil!.arroba}` : ''
  const publicada = perfil?.vitrine_publicada ?? false

  return (
    <div className="tela">
      <BarraTopo
        titulo="Minha vitrine"
        acao={
          <>
            {/* O compartilhar entra só quando publicada; quando escondido, o
                .vaga segura o lugar para a barra não saltar (UX-039). */}
            {publicada && temArroba ? (
              <button
                className="btn-icone"
                aria-label="Compartilhar vitrine"
                onClick={compartilhar}
              >
                <Icone nome="compartilhar" />
              </button>
            ) : (
              <span className="vaga" />
            )}
            <button
              className="btn-icone"
              aria-label="Editar perfil"
              onClick={() => setEditarPerfil(true)}
            >
              <Icone nome="editar" />
            </button>
          </>
        }
      />
      <div className="conteudo">
        {/* 1 · Moldura só de exibição — edição vai pelo lápis da barra (M-017) */}
        <div className="vitrine-moldura">
          <div className="babado" />
          <div className="vitrine-corpo">
            <div className="logo-redonda">
              {perfil?.nome_negocio ? perfil.nome_negocio.trim().charAt(0).toUpperCase() : <Icone nome="brilho" size={24} />}
            </div>
            <div className="nome-negocio">{perfil?.nome_negocio || 'Seu negócio'}</div>
            {temArroba ? (
              <>
                <div className="apoio">@{perfil!.arroba}</div>
                <div
                  className="link-vitrine"
                  role="button"
                  tabIndex={0}
                  onClick={copiarLink}
                  onKeyDown={(e) => { if (e.key === 'Enter') copiarLink() }}
                >
                  <Icone nome="link" size={16} /> {link} · copiar
                </div>
              </>
            ) : (
              <div className="apoio">Complete seu perfil para abrir a vitrine</div>
            )}
          </div>
        </div>

        {/* 2 · Ações duplas — copiar o link e ver como a cliente vê (só publicada) */}
        {publicada && temArroba && (
          <div className="acoes-duplas">
            <button className="btn-secundario" onClick={copiarLink}>
              <Icone nome="link" /> Copiar link
            </button>
            {/* Link interno (mesma aba): no TWA, target=_blank abria fora do app
                e sem sessão não havia caminho de volta. A rota /@arroba é do
                próprio router (basename /encanto), então funciona igual em
                cabideia.com.br e no preview .pages.dev. NÃO trocar por <a>. */}
            <Link to={`/@${perfil!.arroba}`} className="btn-secundario">
              <Icone nome="olho" /> Ver como cliente
            </Link>
          </div>
        )}

        {/* 3 · Publicação — interruptor (copiado do "Incluir meu cardápio") */}
        <div className="card" style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Vitrine publicada</div>
            {/* O rótulo é fixo (o estado é dito pelo interruptor), mas o apoio
                acompanha o estado: com a vitrine oculta, dizer "qualquer pessoa
                com o link pode ver" seria falso (UX-026 / Decisão #64). */}
            <div className="apoio" style={{ marginTop: 2 }}>
              {publicada
                ? 'Qualquer pessoa com o link pode ver.'
                : 'Só você vê. Publique quando estiver pronta.'}
            </div>
          </div>
          <label className="interruptor">
            {/* O label não contém texto (só a pista), então o nome acessível
                precisa vir do aria-label — senão o leitor de tela anuncia
                "caixa de seleção" sem dizer do quê. */}
            <input
              type="checkbox"
              aria-label="Vitrine publicada"
              checked={publicada}
              disabled={salvando || !temArroba}
              onChange={alternarPublicacao}
            />
            <span className="pista" />
          </label>
        </div>

        {!temArroba && (
          <p className="apoio" style={{ textAlign: 'center', marginBottom: 8 }}>
            Complete seu perfil para poder publicar a vitrine.
          </p>
        )}

        {/* 4 · xx Fotos na vitrine — origem das fotos: Meus trabalhos. Caminho único. */}
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="emoji" style={{ width: 42, height: 42, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--acento-suave)', color: 'var(--acento)' }}>
              <Icone nome="vitrine" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--t-base)' }}>
                {qtdNaVitrine > 0
                  ? `${qtdNaVitrine} foto${qtdNaVitrine !== 1 ? 's' : ''} na vitrine`
                  : 'Nenhuma foto na vitrine ainda'}
              </div>
              <div className="apoio" style={{ marginTop: 2 }}>
                As fotos da vitrine vêm dos seus trabalhos. Em “Meus trabalhos”,
                toque no ícone de sacola da foto para mostrá-la aqui.
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
      </div>

      {/* Sheet de edição do perfil (reaproveita <PerfilForm>) */}
      {editarPerfil && (
        <div className="painel-overlay" onClick={() => setEditarPerfil(false)}>
          <div className="painel" onClick={(e) => e.stopPropagation()}>
            <div className="painel-puxador" />
            <div className="form-acervo-titulo">Editar perfil</div>
            <PerfilForm
              onCancelar={() => setEditarPerfil(false)}
              onSalvo={() => {
                setEditarPerfil(false)
                carregar()
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
