import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useClientes } from '../hooks/useClientes'
import { usePedidos, tituloPedido } from '../hooks/usePedidos'
import { formatarReal, precoParaNumero } from '../hooks/useCardapio'
import { comprimirImagem } from '../lib/imagem'
import { supabase } from '../lib/supabase'
import { cartaoParaPng, desenharProposta } from '../lib/proposta'

/** Carrega um Blob como ImageBitmap (null em caso de falha — o cartão segue sem ele). */
async function bitmapDeBlob(blob: Blob | null): Promise<ImageBitmap | null> {
  if (!blob) return null
  try {
    return await createImageBitmap(blob)
  } catch {
    return null
  }
}

/**
 * M-021 · Proposta encantadora — monta, a partir de um pedido, um cartão (PNG)
 * com foto + descrição + valor + a logo do perfil. Tudo no cliente; nada é
 * salvo no acervo (não conta no limite de 150). Compartilha no WhatsApp / baixa.
 */
export function PropostaForm() {
  const { id } = useParams()
  const { sessao } = useSessao()
  const avisar = useAviso()

  const { carregando, buscarPorId, baixarReferencia } = usePedidos(sessao?.user.id)
  const { buscarPorId: buscarCliente } = useClientes(sessao?.user.id)

  const pedido = id ? buscarPorId(id) : undefined
  const cliente = pedido?.cliente_id ? buscarCliente(pedido.cliente_id) : undefined

  // Campos editáveis pré-preenchidos
  const [descricao, setDescricao] = useState('')
  const [clienteNome, setClienteNome] = useState('')
  const [valor, setValor] = useState('')

  // Imagens (como bitmaps, p/ desenhar sem manchar o canvas / sem CORS)
  const [fotoBitmap, setFotoBitmap] = useState<ImageBitmap | null>(null)
  const [logoBitmap, setLogoBitmap] = useState<ImageBitmap | null>(null)
  const [nomeNegocio, setNomeNegocio] = useState('')

  const [fontesProntas, setFontesProntas] = useState(false)
  const [processandoFoto, setProcessandoFoto] = useState(false)
  const [compartilhando, setCompartilhando] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputFoto = useRef<HTMLInputElement>(null)
  const prefilled = useRef(false)

  // Garante as fontes (Fraunces / Nunito Sans) antes de desenhar texto no canvas.
  useEffect(() => {
    let vivo = true
    document.fonts.ready.then(() => vivo && setFontesProntas(true))
    return () => {
      vivo = false
    }
  }, [])

  // Pré-preenche a partir do pedido + carrega logo do perfil (uma vez).
  useEffect(() => {
    if (prefilled.current || !pedido || !sessao) return
    // Se o pedido tem cliente vinculada, espera ela carregar p/ pré-preencher o nome.
    if (pedido.cliente_id && !cliente) return
    prefilled.current = true

    setDescricao([pedido.nome, pedido.tema].filter(Boolean).join('\n'))
    setClienteNome(cliente?.nome ?? '')

    // Foto de referência do pedido (bucket privado) → bitmap
    if (pedido.foto_referencia_path) {
      baixarReferencia(pedido.foto_referencia_path)
        .then(bitmapDeBlob)
        .then((bmp) => bmp && setFotoBitmap(bmp))
    }

    // Perfil: nome do negócio + logo (bucket público)
    supabase
      .from('perfis')
      .select('nome_negocio, logo_path')
      .eq('id', sessao.user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) return
        setNomeNegocio(data.nome_negocio ?? '')
        if (data.logo_path) {
          const { data: arquivo } = await supabase.storage.from('publico').download(data.logo_path)
          const bmp = await bitmapDeBlob(arquivo ?? null)
          if (bmp) setLogoBitmap(bmp)
        }
      })
  }, [pedido, cliente, sessao, baixarReferencia])

  const valorNum = precoParaNumero(valor)
  const valorTexto = valorNum != null ? formatarReal(valorNum) : 'A combinar'

  // Redesenha o cartão sempre que algo muda (e quando as fontes carregam).
  useEffect(() => {
    if (!fontesProntas || !canvasRef.current) return
    desenharProposta(canvasRef.current, {
      fotoBitmap,
      logoBitmap,
      nomeNegocio,
      descricao,
      cliente: clienteNome,
      valorTexto,
    })
  }, [fontesProntas, fotoBitmap, logoBitmap, nomeNegocio, descricao, clienteNome, valorTexto])

  const semFoto = !fotoBitmap

  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setProcessandoFoto(true)
    try {
      // Reusa a compressão do M-009 (a foto NÃO é enviada a lugar nenhum).
      const { blob } = await comprimirImagem(f)
      const bmp = await bitmapDeBlob(blob)
      if (bmp) {
        setFotoBitmap((antigo) => {
          antigo?.close()
          return bmp
        })
      } else {
        avisar('Não consegui usar essa foto. Tente outra.')
      }
    } catch (err: unknown) {
      avisar((err as Error)?.message ?? 'Não consegui processar a foto.')
    } finally {
      setProcessandoFoto(false)
    }
  }

  const gerarPng = useCallback(async (): Promise<Blob | null> => {
    if (!canvasRef.current) return null
    try {
      return await cartaoParaPng(canvasRef.current)
    } catch {
      avisar('Não consegui gerar a imagem. Tente de novo.')
      return null
    }
  }, [avisar])

  function baixar(blob: Blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `proposta-${(nomeNegocio || 'cabideia').toLowerCase().replace(/\s+/g, '-')}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  async function compartilhar() {
    if (semFoto) {
      avisar('Adicione uma foto à proposta.')
      return
    }
    setCompartilhando(true)
    try {
      const blob = await gerarPng()
      if (!blob) return
      const arquivo = new File([blob], 'proposta.png', { type: 'image/png' })
      const texto = `Proposta — ${valorTexto}`
      // Web Share com arquivo: a forma de enviar a IMAGEM no WhatsApp pelo celular.
      if (navigator.canShare?.({ files: [arquivo] })) {
        try {
          await navigator.share({ files: [arquivo], title: 'Proposta', text: texto })
        } catch {
          /* usuária cancelou */
        }
      } else {
        baixar(blob)
        avisar('Imagem baixada ✓ — agora é só anexar no WhatsApp')
      }
    } finally {
      setCompartilhando(false)
    }
  }

  async function baixarImagem() {
    if (semFoto) {
      avisar('Adicione uma foto à proposta.')
      return
    }
    const blob = await gerarPng()
    if (!blob) return
    baixar(blob)
    avisar('Imagem baixada ✓')
  }

  function abrirWhatsAppCliente() {
    const numero = (cliente?.whatsapp ?? '').replace(/\D/g, '')
    if (!numero) return
    const nome = clienteNome.trim() || cliente?.nome || ''
    const linhas = [
      nome ? `Oi, ${nome}! 💛` : 'Oi! 💛',
      'Preparei sua proposta:',
      descricao.trim(),
      `Valor: ${valorTexto}`,
      'Já te envio a imagem ✨',
    ].filter(Boolean)
    const texto = encodeURIComponent(linhas.join('\n'))
    window.open(`https://wa.me/${numero}?text=${texto}`, '_blank', 'noopener')
  }

  if (carregando) return null

  if (!pedido) {
    return (
      <div className="tela">
        <BarraTopo titulo="Proposta" />
        <div className="conteudo">
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone">🔍</div>
            <p>Este pedido não foi encontrado.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="tela">
      <BarraTopo titulo="Gerar proposta" />

      <div className="conteudo">
        {/* Prévia do cartão (canvas 1080×1440 exibido reduzido) */}
        <canvas ref={canvasRef} className="proposta-previa" aria-label="Prévia da proposta" />

        {semFoto && (
          <p className="apoio" style={{ textAlign: 'center', marginTop: 10, color: 'var(--framboesa)', fontWeight: 700 }}>
            Adicione uma foto para deixar a proposta encantadora.
          </p>
        )}

        {/* Foto */}
        <input
          ref={inputFoto}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={aoEscolherFoto}
        />
        <button
          type="button"
          className="btn-secundario"
          style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}
          onClick={() => inputFoto.current?.click()}
          disabled={processandoFoto}
        >
          {processandoFoto ? 'Processando…' : semFoto ? '🖼️ Adicionar foto' : '🖼️ Trocar foto'}
        </button>

        {/* Descrição */}
        <div className="campo" style={{ marginTop: 14 }}>
          <label>Descrição</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={`Ex.: ${tituloPedido(pedido)}`}
            maxLength={200}
          />
        </div>

        {/* Cliente */}
        <div className="campo">
          <label>Cliente (opcional)</label>
          <input
            value={clienteNome}
            onChange={(e) => setClienteNome(e.target.value)}
            placeholder="Ex.: Maria"
            maxLength={60}
          />
        </div>

        {/* Valor */}
        <div className="campo">
          <label>Valor</label>
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Ex.: 120,00"
            inputMode="decimal"
          />
          <div className="apoio" style={{ marginTop: 6 }}>
            No cartão: <b>{valorTexto}</b>
          </div>
        </div>

        {/* Baixar imagem (secundário) */}
        <button
          type="button"
          className="btn-secundario"
          style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
          onClick={baixarImagem}
          disabled={semFoto}
        >
          ⬇️ Baixar imagem
        </button>

        {/* WhatsApp da cliente (se houver número) */}
        {cliente?.whatsapp && (
          <button
            type="button"
            className="btn-secundario"
            style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
            onClick={abrirWhatsAppCliente}
          >
            💬 Abrir conversa de {cliente.nome.split(' ')[0]}
          </button>
        )}

        <p className="apoio" style={{ textAlign: 'center', marginTop: 14 }}>
          A proposta é gerada na hora e compartilhada — não fica salva no acervo.
        </p>
      </div>

      {/* CTA primário: compartilhar (envia a imagem no WhatsApp pelo celular) */}
      <div className="cta-area">
        <button type="button" className="cta" onClick={compartilhar} disabled={semFoto || compartilhando}>
          {compartilhando ? 'Gerando…' : '📤 Compartilhar proposta'}
        </button>
      </div>
    </div>
  )
}
