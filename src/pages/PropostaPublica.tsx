import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { urlPublica } from '../lib/storage'
import { aplicarTema } from '../lib/tema'
import { formatarReal } from '../hooks/useCardapio'
import { formatarDataNumerica } from '../lib/datas'
import { Icone } from '../components/Icone'

/**
 * M-042 F2b — Página pública de uma PROPOSTA (cabideia.com.br/encanto/proposta/:token).
 *
 * Sem login. A cliente abre pelo link e vê a proposta inteira: logo + nome da
 * dona, título/mensagem, galeria das fotos de referência, preço (nos 3 modos),
 * condições e "válido até". Espelha a /s/:token do M-022.
 *
 * Lê via RPC `proposta_publica` (security definer), que devolve só o necessário
 * a partir de um token válido, checa `resolvida=false` (defesa em profundidade,
 * além da RLS) e resolve o caminho PÚBLICO das fotos (cópias das imagens que
 * vivem em bucket privado). Proposta resolvida (encerrada / virada pedido) ou
 * token inexistente → a página não abre; mostra um estado amigável.
 */
type ModoPreco = 'fechado' | 'itens' | 'sem'

// A RPC devolve cada foto de referência com o essencial para triagem: caminho
// público resolvido (ou url do link), origem e o CÓDIGO curto (A-{n}/I-{n}) —
// a cliente responde referenciando o código. Sem legenda (decisão da Josiane).
type FotoPublica = {
  origem: 'trabalho' | 'inspiracao'
  codigo: string | null // "A-12" (trabalho) / "I-7" (inspiração)
  url: string | null // imagem (público) já resolvida
  link: string | null // inspiração-link sem imagem
}

type ItemPublico = { nome: string; preco: number | null }

type DadosProposta = {
  titulo: string | null
  descricao: string | null
  valor: number | null
  validade: string | null
  condicoes: string | null
  modoPreco: ModoPreco
  capaUrl: string | null
  negocio: string | null
  whatsapp: string | null
  logoUrl: string | null
  fotos: FotoPublica[]
  itens: ItemPublico[]
}

function dominioDe(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function PropostaPublica() {
  const { token } = useParams()
  const [dados, setDados] = useState<DadosProposta | null>(null)
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'invalida'>('carregando')

  useEffect(() => {
    if (!token) {
      setEstado('invalida')
      return
    }
    async function carregar() {
      const { data, error } = await supabase.rpc('proposta_publica', { p_token: token })
      const linha = Array.isArray(data) ? data[0] : data
      if (error || !linha) {
        setEstado('invalida')
        return
      }

      // Página pública: pinta com o tema da dona (default oficina se vier vazio).
      aplicarTema(linha.tema, false)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fotos: FotoPublica[] = ((linha.fotos ?? []) as any[]).map((r) => {
        const prefixo = r.origem === 'trabalho' ? 'A' : 'I'
        return {
          origem: r.origem,
          codigo: r.codigo_num != null ? `${prefixo}-${r.codigo_num}` : null,
          url: r.foto_publica_path ? urlPublica(r.foto_publica_path) : null,
          link: !r.foto_publica_path && r.url ? r.url : null,
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itens: ItemPublico[] = ((linha.itens ?? []) as any[]).map((it) => ({
        nome: it.nome ?? '',
        preco: it.preco != null ? Number(it.preco) : null,
      }))

      setDados({
        titulo: linha.titulo ?? null,
        descricao: linha.descricao ?? null,
        valor: linha.valor != null ? Number(linha.valor) : null,
        validade: linha.validade ?? null,
        condicoes: linha.condicoes ?? null,
        modoPreco: (linha.modo_preco as ModoPreco) ?? 'fechado',
        capaUrl: linha.foto_path ? urlPublica(linha.foto_path) : null,
        negocio: linha.negocio ?? null,
        whatsapp: linha.whatsapp ?? null,
        logoUrl: linha.logo_path ? urlPublica(linha.logo_path) : null,
        fotos,
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
    const texto = encodeURIComponent(
      dados.titulo
        ? `Olá! Vi a proposta "${dados.titulo}" que você me enviou e gostaria de conversar`
        : 'Olá! Vi a proposta que você me enviou e gostaria de conversar'
    )
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
          <div className="logo-redonda" style={{ margin: '0 auto 16px' }}>
            <Icone nome="brilho" size={26} />
          </div>
          <div className="nome-negocio">Proposta encerrada</div>
          <p className="apoio" style={{ marginTop: 8 }}>
            Esta proposta não está mais disponível. Se ainda tiver interesse, fale com quem te enviou —
            é rapidinho reabrir.
          </p>
          <p className="apoio" style={{ textAlign: 'center', marginTop: 24 }}>
            feito com <b style={{ color: 'var(--framboesa)' }}>Cabideia Encanto</b>
          </p>
        </div>
      </div>
    )
  }

  // Preço conforme o modo (espelha o valorTexto do PropostaForm).
  const temValor = dados.modoPreco !== 'sem' && dados.valor != null
  const valorTexto = temValor ? formatarReal(dados.valor as number) : 'A combinar'
  const validadeTexto = dados.validade ? `Válido até ${formatarDataNumerica(dados.validade)}` : ''

  return (
    <div className="tela">
      <div className="conteudo" style={{ paddingTop: 16 }}>
        <div className="vitrine-moldura">
          <div className="babado" />
          <div className="vitrine-corpo">
            {dados.logoUrl ? (
              <img className="logo-redonda" src={dados.logoUrl} alt="" />
            ) : (
              <div className="logo-redonda">
                {dados.negocio ? dados.negocio.trim().charAt(0).toUpperCase() : <Icone nome="brilho" size={24} />}
              </div>
            )}
            <div className="nome-negocio">{dados.titulo || 'Uma proposta especial pra você'}</div>
            {dados.negocio && <div className="apoio">por {dados.negocio}</div>}
            {dados.descricao && (
              <p className="apoio" style={{ marginTop: 8, textAlign: 'center' }}>
                {dados.descricao}
              </p>
            )}
          </div>
        </div>

        {/* Capa (foto principal da proposta), se houver */}
        {dados.capaUrl && (
          <img
            src={dados.capaUrl}
            alt=""
            loading="lazy"
            style={{
              width: '100%',
              borderRadius: 16,
              marginTop: 14,
              border: '1px solid var(--linha)',
              display: 'block',
            }}
          />
        )}

        {/* Preço */}
        <div className="vitrine-moldura" style={{ marginTop: 14 }}>
          <div className="vitrine-corpo" style={{ paddingTop: 18, paddingBottom: 18 }}>
            {dados.modoPreco === 'itens' && dados.itens.length > 0 ? (
              <>
                <div className="secao" style={{ justifyContent: 'center' }}>
                  <span className="confeito" /><h2>Tabela de preços</h2>
                </div>
                <div style={{ marginTop: 6 }}>
                  {dados.itens.map((it, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 0',
                        borderBottom: i < dados.itens.length - 1 ? '1px solid var(--linha)' : 'none',
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0, fontWeight: 700 }}>{it.nome}</span>
                      <span style={{ fontWeight: 700, color: 'var(--framboesa)', flexShrink: 0 }}>
                        {it.preco != null ? formatarReal(it.preco) : 'sob consulta'}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="apoio" style={{ textAlign: 'center', marginTop: 12, marginBottom: 0 }}>
                  Total: <b style={{ color: 'var(--framboesa)' }}>{valorTexto}</b>
                </p>
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div className="apoio" style={{ marginBottom: 4 }}>Valor</div>
                <div className="nome-negocio" style={{ color: 'var(--framboesa)' }}>{valorTexto}</div>
              </div>
            )}
            {validadeTexto && (
              <p className="apoio" style={{ textAlign: 'center', marginTop: 10, marginBottom: 0 }}>
                {validadeTexto}
              </p>
            )}
          </div>
        </div>

        {/* Galeria das fotos de referência */}
        {dados.fotos.length > 0 && (
          <>
            <div className="secao" style={{ marginTop: 18 }}>
              <span className="confeito" /><h2>Referências</h2>
            </div>
            <p className="apoio" style={{ textAlign: 'center', marginTop: 4 }}>
              Cada foto tem um código (ex.: <b>I-12</b>). É só me dizer qual você gostou.
            </p>
            <div className="grade-fotos" style={{ marginTop: 8, alignItems: 'start' }}>
              {dados.fotos.map((f, i) => (
                <div key={i} className="foto-item">
                  <div className="acervo-img-wrap">
                    {f.url ? (
                      <img src={f.url} alt="" loading="lazy" />
                    ) : (
                      <a
                        className="insp-link-capa"
                        href={f.link ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: 'none' }}
                      >
                        <span className="insp-link-emoji" aria-hidden><Icone nome="link" size={30} /></span>
                        <span className="insp-link-dominio">{f.link ? dominioDe(f.link) : 'link'}</span>
                      </a>
                    )}
                    {f.codigo && (
                      <span className="cod-selo" aria-label={`Código ${f.codigo}`}>{f.codigo}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Condições */}
        {dados.condicoes && (
          <>
            <div className="secao" style={{ marginTop: 18 }}>
              <span className="confeito" /><h2>Condições</h2>
            </div>
            <p className="apoio" style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{dados.condicoes}</p>
          </>
        )}

        <p className="apoio" style={{ textAlign: 'center', marginTop: 20 }}>
          feito com <b style={{ color: 'var(--framboesa)' }}>Cabideia Encanto</b>
        </p>
      </div>

      {dados.whatsapp && (
        <div className="cta-area">
          <button className="cta" onClick={abrirWhatsApp}>
            <Icone nome="whatsapp" /> Falar no WhatsApp
          </button>
        </div>
      )}
    </div>
  )
}
