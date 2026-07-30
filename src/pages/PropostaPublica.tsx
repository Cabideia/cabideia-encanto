import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { urlPublica } from '../lib/storage'
import { aplicarTema } from '../lib/tema'
import { formatarReal } from '../hooks/useCardapio'
import { formatarDataNumerica } from '../lib/datas'
import { Icone } from '../components/Icone'
import { TelaCarregandoPublica } from '../components/TelaCarregando'

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

// M-052 · preco é o valor POR UNIDADE (snapshot do cardápio) — o total da
// linha é quantidade × preco, calculado na hora (mesma conta do privado, sem
// persistir). unidade só aparece quando a dona preencheu (itens antigos podem
// não ter).
type ItemPublico = { nome: string; preco: number | null; quantidade: number; unidade: string | null }

/** Ex.: 2 → "2" · 1.5 → "1,5" — mesma regra do form privado (LinhaItemEditavel). */
function fmtQuantidade(q: number): string {
  return Number.isInteger(q) ? String(q) : String(q).replace('.', ',')
}

type DadosProposta = {
  titulo: string | null
  descricao: string | null
  detalhes: string | null // UX-031/032 · observacoes, separadas da mensagem
  valor: number | null
  validade: string | null
  condicoes: string | null
  modoPreco: ModoPreco
  capaUrl: string | null
  negocio: string | null
  whatsapp: string | null
  logoUrl: string | null
  // UX-032 · saudacao e assinatura do cabecalho. A RPC ainda pode nao devolver
  // estes dois (DDL apresentada a parte) — o layout degrada sem eles.
  clientePrimeiroNome: string | null
  arroba: string | null
  fotos: FotoPublica[]
  itens: ItemPublico[]
  cardapioUrl: string | null // M-045 · arte de recheios/sabores (se incluída)
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
        quantidade: it.quantidade != null ? Number(it.quantidade) : 1,
        unidade: it.unidade ?? null,
      }))

      setDados({
        titulo: linha.titulo ?? null,
        descricao: linha.descricao ?? null,
        detalhes: linha.detalhes ?? null,
        valor: linha.valor != null ? Number(linha.valor) : null,
        validade: linha.validade ?? null,
        condicoes: linha.condicoes ?? null,
        modoPreco: (linha.modo_preco as ModoPreco) ?? 'fechado',
        capaUrl: linha.foto_path ? urlPublica(linha.foto_path) : null,
        negocio: linha.negocio ?? null,
        whatsapp: linha.whatsapp ?? null,
        logoUrl: linha.logo_path ? urlPublica(linha.logo_path) : null,
        clientePrimeiroNome: linha.cliente_primeiro_nome ?? null,
        arroba: linha.arroba ?? null,
        fotos,
        itens,
        cardapioUrl: linha.cardapio_path ? urlPublica(linha.cardapio_path) : null,
      })
      setEstado('ok')
    }
    carregar()
  }, [token])

  // M-049 · Favoritas da cliente (Decisão #40 = A): seleção 100% local (zero
  // escrita anônima); a cliente marca 🤍 e responde com os CÓDIGOS no WhatsApp.
  const [amadas, setAmadas] = useState<Set<number>>(new Set())
  function alternarAmei(i: number) {
    setAmadas((prev) => {
      const n = new Set(prev)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })
  }
  const codigosAmados = (dados?.fotos ?? [])
    .map((f, i) => (amadas.has(i) && f.codigo ? f.codigo : null))
    .filter((c): c is string => !!c)

  function enviarEscolhas() {
    if (!dados?.whatsapp || codigosAmados.length === 0) return
    let num = dados.whatsapp.replace(/\D/g, '')
    if (num.length <= 11) num = '55' + num
    const texto = encodeURIComponent(`Oi! Das opções, amei: ${codigosAmados.join(', ')} 💛`)
    window.open(`https://wa.me/${num}?text=${texto}`, '_blank')
  }

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
    return <TelaCarregandoPublica />
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
        {/* UX-032 (D1/P0) · mesmo cabecalho do PedidoPublico (.pub-cabecalho +
            .babado-ondas): a pagina da PROPOSTA e a peca de venda e estava
            visualmente inferior a do pedido. Titulo = nome do negocio;
            subtitulo = so o @arroba. */}
        <div className="pub-cabecalho">
          <div className="pub-avatar">
            {dados.logoUrl ? (
              <img src={dados.logoUrl} alt="" />
            ) : (
              dados.negocio ? dados.negocio.trim().charAt(0).toUpperCase() : <Icone nome="brilho" size={28} />
            )}
          </div>
          <h1>{dados.negocio || 'Uma proposta pra você'}</h1>
          {dados.arroba && <div className="pub-sub">@{dados.arroba}</div>}
          <div className="babado-ondas" />
        </div>

        {/* UX-032 · card de ABERTURA: saudacao + titulo da proposta + a
            mensagem que a doceira escreveu. E a primeira coisa que a cliente le. */}
        <div className="card" style={{ marginTop: 18 }}>
          <div
            style={{
              fontSize: 14, fontWeight: 800, color: 'var(--cor-primaria)', marginBottom: 6,
            }}
          >
            {dados.clientePrimeiroNome
              ? `Uma proposta pra você, ${dados.clientePrimeiroNome} 💛`
              : 'Uma proposta pra você 💛'}
          </div>
          <div
            className="card-nome"
            style={{ fontFamily: 'var(--fonte-titulo)', fontSize: 20, whiteSpace: 'normal' }}
          >
            {dados.titulo || 'Proposta'}
          </div>
          {dados.descricao && (
            <p style={{ marginTop: 8, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{dados.descricao}</p>
          )}
        </div>

        {/* UX-032 · "O que esta incluido" (era "Tabela de precos"): a validade
            sai do texto de apoio e vira CHIP no canto; o Total ganha destaque. */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div className="secao" style={{ margin: 0, flex: 1 }}>
              <span className="confeito" /><h2>O que está incluído</h2>
            </div>
            {validadeTexto && (
              <span
                className="chip"
                style={{
                  background: 'var(--st-producao-fundo)', color: 'var(--st-producao-texto)', flexShrink: 0,
                }}
              >
                válida até {formatarDataNumerica(dados.validade as string)}
              </span>
            )}
          </div>

          {dados.modoPreco === 'itens' && dados.itens.length > 0 ? (
            <>
              {dados.itens.map((it, i) => {
                // M-052 · preco (snapshot) é POR UNIDADE — o total da linha é
                // quantidade × preco, mesma conta do form privado (nunca
                // persistida; a cliente só vê o resultado).
                const totalLinha = it.preco != null ? it.preco * it.quantidade : null
                const prefixoQtd = it.quantidade !== 1 ? `${fmtQuantidade(it.quantidade)}× ` : ''
                const sufixoUnidade = it.unidade ? ` (${it.unidade})` : ''
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                      borderBottom: i < dados.itens.length - 1 ? '1px solid var(--linha)' : 'none',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 700 }}>
                      {prefixoQtd}{it.nome}{sufixoUnidade}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--framboesa)', flexShrink: 0 }}>
                      {totalLinha != null ? formatarReal(totalLinha) : 'sob consulta'}
                    </span>
                  </div>
                )
              })}
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--linha)',
                }}
              >
                <span style={{ fontWeight: 700 }}>Total</span>
                <b style={{ fontSize: 18, fontWeight: 800, color: 'var(--cor-primaria)' }}>{valorTexto}</b>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontWeight: 700 }}>Valor</span>
              <b style={{ fontSize: 18, fontWeight: 800, color: 'var(--cor-primaria)' }}>{valorTexto}</b>
            </div>
          )}
        </div>

        {/* UX-032 · espelho do campo novo do formulario (UX-031) */}
        {dados.detalhes && (
          <div className="card">
            <div className="secao" style={{ margin: '0 0 8px' }}>
              <span className="confeito" /><h2>Detalhes e outros itens</h2>
            </div>
            <p style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{dados.detalhes}</p>
          </div>
        )}

        {/* UX-032 · a capa desceu: primeiro o que ela precisa saber (preco e
            detalhes), depois a imagem, logo antes das favoritas. */}
        {dados.capaUrl && (
          <img
            src={dados.capaUrl}
            alt=""
            loading="lazy"
            style={{
              width: '100%',
              borderRadius: 'var(--raio-card)',
              marginTop: 4,
              border: '1px solid var(--linha)',
              display: 'block',
            }}
          />
        )}

        {/* Galeria das fotos de referência */}
        {dados.fotos.length > 0 && (
          <>
            <div className="secao" style={{ marginTop: 18 }}>
              <span className="confeito" /><h2>Escolha suas preferidas</h2>
            </div>
            <p className="apoio" style={{ textAlign: 'center', marginTop: 4 }}>
              Toque no 🤍 das opções que amar e me conte no WhatsApp
            </p>
            <div className="grade-fotos" style={{ marginTop: 8, alignItems: 'start', gridTemplateColumns: 'repeat(2, 1fr)' }}>
              {dados.fotos.map((f, i) => (
                <div key={i} className={`foto-item${amadas.has(i) ? ' foto-amada' : ''}`}>
                  <div className="acervo-img-wrap" style={{ position: 'relative' }}>
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
                    {/* M-049 · 🤍 vira 🧡 */}
                    {f.codigo && dados.whatsapp && (
                      <button
                        type="button"
                        className="btn-amei"
                        aria-label={amadas.has(i) ? 'Desmarcar favorita' : 'Marcar favorita'}
                        aria-pressed={amadas.has(i)}
                        onClick={() => alternarAmei(i)}
                      >
                        {amadas.has(i) ? '🧡' : '🤍'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* M-049 · barra flutuante com as escolhas (zero escrita no banco) */}
            {codigosAmados.length > 0 && (
              <div className="barra-favoritas">
                <button type="button" className="cta" onClick={enviarEscolhas}>
                  🧡 Enviar favoritas no WhatsApp ({codigosAmados.length})
                </button>
              </div>
            )}
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

        {/* M-045 · Recheios e sabores: a arte do cardápio da doceira (quando a
            proposta está com o interruptor ligado) */}
        {dados.cardapioUrl && (
          <>
            <div className="secao" style={{ marginTop: 18 }}>
              <span className="confeito" /><h2>Recheios e sabores</h2>
            </div>
            <img
              src={dados.cardapioUrl}
              alt="Recheios e sabores"
              loading="lazy"
              style={{ width: '100%', borderRadius: 'var(--raio-card)', display: 'block', marginTop: 8, border: '1px solid var(--linha)' }}
            />
          </>
        )}

        <p className="apoio" style={{ textAlign: 'center', marginTop: 20 }}>
          feito com <b style={{ color: 'var(--framboesa)' }}>Cabideia Encanto</b>
        </p>
      </div>

      {dados.whatsapp && (
        <div className="cta-area">
          <button className="cta" onClick={abrirWhatsApp}>
            <Icone nome="whatsapp" /> {dados.negocio ? `Falar com ${dados.negocio}` : 'Falar no WhatsApp'}
          </button>
        </div>
      )}
    </div>
  )
}
