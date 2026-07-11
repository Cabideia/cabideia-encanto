import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { urlPublica } from '../lib/storage'
import { aplicarTema } from '../lib/tema'
import { formatarReal } from '../hooks/useCardapio'
import { formatarDataLonga } from '../lib/datas'
import { STATUS_INFO, PAGAMENTO_CURTO, type StatusPedido, type StatusPagamento } from '../hooks/usePedidos'
import { Icone } from '../components/Icone'

/**
 * M-047 · Página pública de um PEDIDO (cabideia.com.br/encanto/pedido/:token).
 *
 * Sem login. A cliente abre pelo link e vê o resumo VIVO do pedido — espelho
 * fiel da página da proposta (F2b): logo + nome da dona, título, "Pedido de
 * {nome}", data de entrega, detalhes, valor, status e pagamento, galeria das
 * fotos de referência com os códigos A-{n}/I-{n}.
 *
 * Lê SÓ via RPC `pedido_publico` (security definer) — NUNCA select direto em
 * tabela na rota pública (padrão da auditoria). A RPC filtra pelo token, checa
 * status <> 'cancelado' e resolve o caminho PÚBLICO das fotos (cópias das
 * imagens que vivem em bucket privado). O status/pagamento são VIVOS: a página
 * reflete o estado atual do pedido a cada acesso (a RPC suprime 'nao_pago').
 * Pedido cancelado ou token inexistente → a página não abre; mostra um estado
 * amigável ("Link indisponível").
 */
type FotoPublica = {
  origem: 'trabalho' | 'inspiracao'
  codigo: string | null // "A-12" (trabalho) / "I-7" (inspiração)
  url: string | null // imagem (público) já resolvida
  link: string | null // inspiração-link sem imagem
}

type DadosPedido = {
  titulo: string | null
  detalhes: string | null
  dataEntrega: string | null
  valor: number | null
  status: StatusPedido | null
  statusPagamento: StatusPagamento | null // null quando 'nao_pago' (RPC suprime)
  clientePrimeiroNome: string | null
  negocio: string | null
  whatsapp: string | null
  logoUrl: string | null
  fotoReferenciaUrl: string | null // legado (foto_referencia_path)
  fotos: FotoPublica[]
}

function dominioDe(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Rótulo/cor do chip de pagamento na página pública (só sinal/pago). */
const PAGAMENTO_CHIP: Record<'sinal' | 'pago', string> = {
  sinal: 'producao', // caramelo
  pago: 'entregue', // pistache
}

export function PedidoPublico() {
  const { token } = useParams()
  const [dados, setDados] = useState<DadosPedido | null>(null)
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'invalida'>('carregando')

  useEffect(() => {
    if (!token) {
      setEstado('invalida')
      return
    }
    async function carregar() {
      const { data, error } = await supabase.rpc('pedido_publico', { p_token: token })
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

      setDados({
        titulo: linha.titulo ?? null,
        detalhes: linha.detalhes ?? null,
        dataEntrega: linha.data_entrega ?? null,
        valor: linha.valor != null ? Number(linha.valor) : null,
        status: (linha.status as StatusPedido) ?? null,
        statusPagamento: (linha.status_pagamento as StatusPagamento) ?? null,
        clientePrimeiroNome: linha.cliente_primeiro_nome ?? null,
        negocio: linha.negocio ?? null,
        whatsapp: linha.whatsapp ?? null,
        logoUrl: linha.logo_path ? urlPublica(linha.logo_path) : null,
        fotoReferenciaUrl: linha.foto_referencia_path ? urlPublica(linha.foto_referencia_path) : null,
        fotos,
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
        ? `Olá! Estou vendo o meu pedido "${dados.titulo}" e gostaria de conversar`
        : 'Olá! Estou vendo o meu pedido e gostaria de conversar'
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
          <div className="nome-negocio">Link indisponível</div>
          <p className="apoio" style={{ marginTop: 8 }}>
            Este pedido não está mais disponível. Se ainda tiver dúvidas, fale com quem te enviou —
            é rapidinho reabrir.
          </p>
          <p className="apoio" style={{ textAlign: 'center', marginTop: 24 }}>
            feito com <b style={{ color: 'var(--framboesa)' }}>Cabideia Encanto</b>
          </p>
        </div>
      </div>
    )
  }

  const statusInfo = dados.status ? STATUS_INFO[dados.status] : null
  const pagto =
    dados.statusPagamento === 'sinal' || dados.statusPagamento === 'pago'
      ? dados.statusPagamento
      : null

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
            <div className="nome-negocio">{dados.titulo || 'Seu pedido'}</div>
            {dados.clientePrimeiroNome && (
              <div className="apoio">Pedido de {dados.clientePrimeiroNome}</div>
            )}
            {dados.negocio && <div className="apoio">por {dados.negocio}</div>}
          </div>
        </div>

        {/* Resumo: status vivo, pagamento (só sinal/pago), entrega, valor, detalhes */}
        <div className="vitrine-moldura" style={{ marginTop: 14 }}>
          <div className="vitrine-corpo" style={{ paddingTop: 18, paddingBottom: 18 }}>
            <div
              style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 6 }}
            >
              {statusInfo && <span className={`chip ${statusInfo.chip}`}>{statusInfo.rotulo}</span>}
              {pagto && <span className={`chip ${PAGAMENTO_CHIP[pagto]}`}>{PAGAMENTO_CURTO[pagto]}</span>}
            </div>

            {dados.dataEntrega && (
              <p
                className="apoio"
                style={{ textAlign: 'center', marginTop: 6, marginBottom: 0, display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}
              >
                <Icone nome="calendario" size={14} /> Entrega em {formatarDataLonga(dados.dataEntrega)}
              </p>
            )}

            {dados.valor != null && (
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <div className="apoio" style={{ marginBottom: 4 }}>Valor</div>
                <div className="nome-negocio" style={{ color: 'var(--framboesa)' }}>
                  {formatarReal(dados.valor)}
                </div>
              </div>
            )}

            {dados.detalhes && (
              <p className="apoio" style={{ whiteSpace: 'pre-wrap', marginTop: 12, marginBottom: 0, textAlign: 'center' }}>
                {dados.detalhes}
              </p>
            )}
          </div>
        </div>

        {/* Galeria das fotos de referência (mesmo padrão da proposta) */}
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

        {/* Foto de referência legada (pedidos antigos, sem referências novas) */}
        {dados.fotos.length === 0 && dados.fotoReferenciaUrl && (
          <>
            <div className="secao" style={{ marginTop: 18 }}>
              <span className="confeito" /><h2>Referência</h2>
            </div>
            <img
              src={dados.fotoReferenciaUrl}
              alt=""
              loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              style={{
                width: '100%',
                borderRadius: 16,
                marginTop: 8,
                border: '1px solid var(--linha)',
                display: 'block',
              }}
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
            <Icone nome="whatsapp" /> Falar no WhatsApp
          </button>
        </div>
      )}
    </div>
  )
}
