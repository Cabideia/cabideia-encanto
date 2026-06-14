import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useFotosVitrine } from '../hooks/useFotosVitrine'
import { supabase } from '../lib/supabase'

/**
 * M-017 (herói) — gestão da vitrine.
 * Etapa 1: perfil. Etapa 2: fotos (adicionar com compressão / remover).
 * Etapa 4: publicar/despublicar vitrine pelo app.
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
  const inputFoto = useRef<HTMLInputElement>(null)
  const [legenda, setLegenda] = useState('')

  const { fotos, enviando, adicionar, remover } = useFotosVitrine(sessao?.user.id)

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

  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    const erro = await adicionar(arquivo, legenda)
    if (erro) avisar(erro)
    else {
      avisar('Foto adicionada ✓')
      setLegenda('')
    }
  }

  async function aoRemover(id: string) {
    const foto = fotos.find((f) => f.id === id)
    if (!foto) return
    const erro = await remover(foto)
    avisar(erro ?? 'Foto removida')
  }

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

        {/* Toggle publicar/despublicar — M-017 Etapa 4 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            margin: '16px 0',
            padding: '14px 16px',
            background: 'var(--branco)',
            borderRadius: 16,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              {publicada ? '🟢 Vitrine publicada' : '⚫ Vitrine oculta'}
            </div>
            <div className="apoio" style={{ marginTop: 2 }}>
              {publicada
                ? 'Clientes podem ver sua vitrine'
                : 'Só você vê. Publique quando estiver pronta.'}
            </div>
          </div>
          <button
            onClick={alternarPublicacao}
            disabled={salvando || !temArroba}
            style={{
              flexShrink: 0,
              marginLeft: 12,
              padding: '8px 18px',
              borderRadius: 20,
              border: 'none',
              fontWeight: 600,
              fontSize: 14,
              cursor: salvando || !temArroba ? 'not-allowed' : 'pointer',
              background: publicada ? 'var(--cinza-claro, #eee)' : 'var(--framboesa)',
              color: publicada ? 'var(--texto)' : '#fff',
              opacity: salvando ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
          >
            {salvando ? '…' : publicada ? 'Ocultar' : 'Publicar'}
          </button>
        </div>

        {/* Aviso se não tem arroba */}
        {!temArroba && (
          <p className="apoio" style={{ textAlign: 'center', marginBottom: 8 }}>
            Complete seu perfil para poder publicar a vitrine.
          </p>
        )}

        {/* Bloco editar perfil */}
        <div style={{ marginTop: 8 }}>
          <Link to="/perfil" className="bloco">
            <div className="emoji" aria-hidden>📝</div>
            <div className="texto">
              <div className="nome">{temArroba ? 'Editar perfil' : 'Completar perfil'}</div>
              <div className="conta">nome, @, WhatsApp, bio e nicho</div>
            </div>
            <span aria-hidden>›</span>
          </Link>
        </div>

        {/* Fotos da vitrine */}
        <h3 style={{ margin: '22px 0 10px', fontSize: 16 }}>
          Fotos da vitrine {fotos.length > 0 && `(${fotos.length})`}
        </h3>

        <div className="campo">
          <label>Legenda da próxima foto (opcional)</label>
          <input
            value={legenda}
            onChange={(e) => setLegenda(e.target.value)}
            placeholder="Ex.: Bolo de casamento 3 andares"
            maxLength={80}
          />
        </div>

        <input
          ref={inputFoto}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={aoEscolherFoto}
        />
        <button
          className="cta"
          style={{ marginBottom: 16 }}
          onClick={() => inputFoto.current?.click()}
          disabled={enviando}
        >
          {enviando ? 'Enviando…' : '+ Adicionar foto'}
        </button>

        {fotos.length === 0 ? (
          <p className="apoio" style={{ textAlign: 'center' }}>
            Nenhuma foto ainda. Adicione seus trabalhos para encantar clientes. 🍓
          </p>
        ) : (
          <div className="grade-fotos">
            {fotos.map((f) => (
              <div key={f.id} className="foto-item">
                <img src={f.url} alt={f.descricao ?? ''} loading="lazy" />
                <button
                  className="foto-remover"
                  onClick={() => aoRemover(f.id)}
                  aria-label="Remover foto"
                >
                  ✕
                </button>
                {f.descricao && <div className="foto-legenda">{f.descricao}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

