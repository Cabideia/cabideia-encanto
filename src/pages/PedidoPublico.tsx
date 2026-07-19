import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { urlPublica } from '../lib/storage'
import { aplicarTema } from '../lib/tema'
import { formatarReal } from '../hooks/useCardapio'
import { formatarDataLonga } from '../lib/datas'
import type { StatusPedido, StatusPagamento } from '../hooks/usePedidos'
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
  arroba: string | null // M-048 · cabeçalho "com {negócio} · @arroba"
  criadoEm: string | null // M-048 · data do passo "Pedido confirmado"
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
        arroba: linha.arroba ?? null,
        criadoEm: linha.criado_em ?? null,
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

  // M-048 · linha do tempo com o vocabulário travado (Decisão #48 = A):
  // Pedido confirmado (sempre feito) → Em produção → Entregue.
  const emProducao = dados.status === 'em_producao'
  const entregue = dados.status === 'entregue'
  const pagto =
    dados.statusPagamento === 'sinal' || dados.statusPagamento === 'pago'
      ? dados.statusPagamento
      : null

  return (
    <div className="tela">
      <div className="conteudo">
        {/* Cabeçalho público do mockup v7.2: tema da dona + babado ondulado */}
        <div className="pub-cabecalho">
          <div className="pub-avatar">
            {dados.logoUrl ? (
              <img src={dados.logoUrl} alt="" />
            ) : (
              dados.negocio ? dados.negocio.trim().charAt(0).toUpperCase() : <Icone nome="brilho" size={28} />
            )}
          </div>
          <h1>
            {dados.clientePrimeiroNome
              ? `Sua encomenda, ${dados.clientePrimeiroNome} 🧁`
              : 'Sua encomenda 🧁'}
          </h1>
          {(dados.negocio || dados.arroba) && (
            <div className="pub-sub">
              {dados.negocio ? `com ${dados.negocio}` : ''}
              {dados.negocio && dados.arroba ? ' · ' : ''}
              {dados.arroba ? `@${dados.arroba}` : ''}
            </div>
          )}
          <div className="babado-ondas" />
        </div>

        {/* O pedido + entrega */}
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-nome" style={{ fontFamily: 'var(--fonte-titulo)', whiteSpace: 'normal' }}>
            {dados.titulo || 'Seu pedido'}
          </div>
          {dados.dataEntrega && (
            <p className="apoio" style={{ marginTop: 4 }}>
              Entrega: <b style={{ color: 'var(--cacau)' }}>{formatarDataLonga(dados.dataEntrega)}</b>
            </p>
          )}
        </div>

        {/* Andamento — linha do tempo viva */}
        <div className="card">
          <div className="card-nome" style={{ fontSize: 'var(--t-base)', marginBottom: 14 }}>Andamento</div>
          <div className="linha-tempo">
            <div className="lt-passo feito">
              <div className="lt-bola"><Icone nome="ok" size={14} strokeWidth={3} /></div>
              <h4>Pedido confirmado</h4>
              {(dados.criadoEm || pagto === 'sinal') && (
                <p>
                  {dados.criadoEm ? formatarDataLonga(dados.criadoEm) : ''}
                  {dados.criadoEm && pagto === 'sinal' ? ' · ' : ''}
                  {pagto === 'sinal' ? 'sinal recebido' : ''}
                </p>
              )}
            </div>
            <div className={`lt-passo${entregue ? ' feito' : emProducao ? ' atual' : ''}`}>
              <div className="lt-bola">{entregue ? <Icone nome="ok" size={14} strokeWidth={3} /> : '2'}</div>
              <h4>Em produção</h4>
              {emProducao && <p>Seu pedido está sendo feito com carinho</p>}
            </div>
            <div className={`lt-passo${entregue ? ' feito' : ''}`}>
              <div className="lt-bola">{entregue ? <Icone nome="ok" size={14} strokeWidth={3} /> : '3'}</div>
              <h4>Entregue</h4>
              {dados.dataEntrega && !entregue && <p>previsto para {formatarDataLonga(dados.dataEntrega)}</p>}
              {entregue && <p>Prontinho! Obrigada pela confiança 💛</p>}
            </div>
          </div>
        </div>

        {/* O que combinamos: detalhes + referências acordadas */}
        {(dados.detalhes || dados.fotos.length > 0 || dados.fotoReferenciaUrl) && (
          <>
            <div className="secao" style={{ marginTop: 6 }}>
              <span className="confeito" /><h2>O que combinamos</h2>
            </div>
            {dados.detalhes && (
              <p className="apoio" style={{ whiteSpace: 'pre-wrap', margin: '6px 0 10px' }}>{dados.detalhes}</p>
            )}
            {dados.fotos.length > 0 && (
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
            )}
            {dados.fotos.length === 0 && dados.fotoReferenciaUrl && (
              <img
                src={dados.fotoReferenciaUrl}
                alt=""
                loading="lazy"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                style={{ width: '100%', borderRadius: 16, marginTop: 8, border: '1px solid var(--linha)', display: 'block' }}
              />
            )}
          </>
        )}

        {/* Pagamento (só quando há valor ou estado a mostrar; 'não pago' é suprimido) */}
        {(dados.valor != null || pagto) && (
          <div className="card" style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="card-nome" style={{ fontSize: 'var(--t-base)' }}>Pagamento</div>
              {dados.valor != null && <div className="apoio">{formatarReal(dados.valor)}</div>}
            </div>
            {pagto && (
              <span className={`chip ${PAGAMENTO_CHIP[pagto]}`}>
                {pagto === 'sinal' ? 'Sinal recebido' : 'Pago'}
              </span>
            )}
          </div>
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
