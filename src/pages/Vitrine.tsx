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
    e.target.value = '' // permite reescolher a mesma foto depois
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

        {/* Bloco editar perfil */}
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

        <p className="apoio" style={{ textAlign: 'center', marginTop: 16 }}>
          Em breve: publicar/despublicar sua vitrine pelo app.
        </p>
      </div>
    </div>
  )
}

