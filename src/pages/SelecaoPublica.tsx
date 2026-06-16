import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * M-020/M-022 — Página pública de uma seleção (cabideia.com.br/encanto/s/:token).
 *
 * Sem login. Mostra os itens que a boleira escolheu — de Meus Trabalhos (A-{n})
 * e de Inspirações (I-{n}) — para a cliente referenciar ("gostei da A-12").
 * Lê via RPC `selecao_publica` (security definer), que devolve só o necessário a
 * partir de um token válido e resolve o caminho público das imagens (inclusive a
 * cópia pública das inspirações, que vivem em bucket privado).
 */
type ItemPublico = {
  id: string
  origem: 'trabalho' | 'inspiracao'
  codigo: string | null // "A-12" / "I-7"
  descricao: string | null
  url: string | null // imagem (público) já resolvida
  link: string | null // inspiração-link sem imagem
}

type DadosSelecao = {
  titulo: string | null
  mensagem: string | null
  negocio: string | null
  whatsapp: string | null
  logoUrl: string | null
  itens: ItemPublico[]
}

function dominioDe(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function SelecaoPublica() {
  const { token } = useParams()
  const [dados, setDados] = useState<DadosSelecao | null>(null)
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'invalida'>('carregando')

  useEffect(() => {
    if (!token) {
      setEstado('invalida')
      return
    }
    async function carregar() {
      const { data, error } = await supabase.rpc('selecao_publica', { p_token: token })
      const linha = Array.isArray(data) ? data[0] : data
      if (error || !linha) {
        setEstado('invalida')
        return
      }

      const urlPublica = (path: string) =>
        supabase.storage.from('publico').getPublicUrl(path).data.publicUrl

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itens: ItemPublico[] = ((linha.itens ?? []) as any[]).map((it) => {
        const prefixo = it.origem === 'trabalho' ? 'A' : 'I'
        return {
          id: it.id,
          origem: it.origem,
          codigo: it.codigo_num != null ? `${prefixo}-${it.codigo_num}` : null,
          descricao: it.descricao ?? null,
          url: it.foto_publica_path ? urlPublica(it.foto_publica_path) : null,
          link: !it.foto_publica_path && it.url ? it.url : null,
        }
      })

      setDados({
        titulo: linha.titulo ?? null,
        mensagem: linha.mensagem ?? null,
        negocio: linha.negocio ?? null,
        whatsapp: linha.whatsapp ?? null,
        logoUrl: linha.logo_path ? urlPublica(linha.logo_path) : null,
        itens,
      })
      setEstado('ok')
    }
    carregar()
  }, [token])

  function abrirWhatsApp() {
    if (!dados?.whatsapp) return
    let num = dados.whatsapp.replace(/\D/g, '')
    if (num.length <= 11) num = '55' + num
    const texto = encodeURIComponent('Olá! Vi a seleção que você me enviou e gostaria de conversar 💕')
    window.open(`https://wa.me/${num}?text=${texto}`, '_blank')
  }

  if (estado === 'carregando') {
    return (
      <div className="tela">
        <div className="conteudo" style={{ paddingTop: 40, textAlign: 'center' }}>
          <p className="apoio">Carregando…</p>
        </div>
      </div>
    )
  }

  if (estado === 'invalida' || !dados) {
    return (
      <div className="tela">
        <div className="conteudo" style={{ paddingTop: 40, textAlign: 'center' }}>
          <div className="logo-redonda" style={{ margin: '0 auto 16px' }}>✨</div>
          <div className="nome-negocio">Seleção indisponível</div>
          <p className="apoio" style={{ marginTop: 8 }}>
            Este link expirou ou não existe mais. Peça um novo à pessoa que te enviou.
          </p>
          <p className="apoio" style={{ textAlign: 'center', marginTop: 24 }}>
            feito com <b style={{ color: 'var(--framboesa)' }}>Cabideia Encanto</b> ✨
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="tela">
      <div className="conteudo" style={{ paddingTop: 16 }}>
        <div className="vitrine-moldura">
          <div className="babado" />
          <div className="vitrine-corpo">
            {dados.logoUrl ? (
              <img className="logo-redonda" src={dados.logoUrl} alt="" />
            ) : (
              <div className="logo-redonda">✨</div>
            )}
            <div className="nome-negocio">{dados.titulo || 'Seleção especial pra você'}</div>
            {dados.negocio && <div className="apoio">por {dados.negocio}</div>}
            {dados.mensagem && (
              <p className="apoio" style={{ marginTop: 8, textAlign: 'center' }}>
                {dados.mensagem}
              </p>
            )}
          </div>
        </div>

        {dados.itens.length > 0 ? (
          <>
            <p className="apoio" style={{ textAlign: 'center', marginTop: 12 }}>
              Cada item tem um código (ex.: <b>A-12</b>). É só me dizer qual você gostou 💕
            </p>
            <div className="grade-fotos" style={{ marginTop: 12, alignItems: 'start' }}>
              {dados.itens.map((it) => (
                <div key={it.id} className="foto-item">
                  <div className="acervo-img-wrap">
                    {it.url ? (
                      <img src={it.url} alt={it.descricao ?? ''} loading="lazy" />
                    ) : (
                      <a
                        className="insp-link-capa"
                        href={it.link ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: 'none' }}
                      >
                        <span className="insp-link-emoji" aria-hidden>🔗</span>
                        <span className="insp-link-dominio">
                          {it.link ? dominioDe(it.link) : 'link'}
                        </span>
                      </a>
                    )}
                    {it.codigo && (
                      <span className="cod-selo" aria-label={`Código ${it.codigo}`}>{it.codigo}</span>
                    )}
                  </div>
                  {it.descricao && <div className="foto-legenda">{it.descricao}</div>}
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="apoio" style={{ textAlign: 'center', marginTop: 24 }}>
            Esta seleção está sem itens.
          </p>
        )}

        <p className="apoio" style={{ textAlign: 'center', marginTop: 16 }}>
          feito com <b style={{ color: 'var(--framboesa)' }}>Cabideia Encanto</b> ✨
        </p>
      </div>

      {dados.whatsapp && (
        <div className="cta-area">
          <button className="cta" onClick={abrirWhatsApp}>
            💬 Falar no WhatsApp
          </button>
        </div>
      )}
    </div>
  )
}
