import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Confirmar } from '../components/Confirmar'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useClientes } from '../hooks/useClientes'
import { usePropostas, type CamposProposta } from '../hooks/usePropostas'
import { usePedidos } from '../hooks/usePedidos'
import { formatarReal, precoParaNumero } from '../hooks/useCardapio'
import { formatarDataNumerica } from '../lib/datas'
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
 * Proposta encantadora — agora NASCE da cliente e fica salva (tabela `propostas`).
 *
 * Cria/edita uma proposta (título, descrição, valor, validade, foto opcional) e
 * monta o cartão (PNG) com foto + título + descrição + valor + validade + a logo
 * do perfil, para compartilhar no WhatsApp da cliente. A foto é comprimida no
 * cliente (M-009) e guardada no bucket público — não conta como trabalho.
 */
export function PropostaForm() {
  // /clientes/:clienteId/propostas/nova  (criação)  ·  /propostas/:id  (edição)
  const { clienteId, id } = useParams()
  const edicao = !!id
  const navegar = useNavigate()
  const { sessao } = useSessao()
  const avisar = useAviso()

  const { carregando: carregandoClientes, buscarPorId: buscarCliente } = useClientes(sessao?.user.id)
  const {
    carregando: carregandoPropostas,
    salvando,
    buscarPorId: buscarProposta,
    subirFoto,
    criar,
    atualizar,
    excluir,
  } = usePropostas(sessao?.user.id)

  // M-039/M-042 · o pedido que nasceu desta proposta (base do "Virar/Ver pedido").
  const { pedidoDaProposta } = usePedidos(sessao?.user.id)

  const proposta = edicao && id ? buscarProposta(id) : undefined
  const clienteIdAtivo = clienteId ?? proposta?.cliente_id ?? null
  const cliente = clienteIdAtivo ? buscarCliente(clienteIdAtivo) : undefined
  const pedidoDaEdicao = edicao && id ? pedidoDaProposta(id) : undefined

  // Campos editáveis
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [validade, setValidade] = useState('') // 'YYYY-MM-DD'

  // Foto: caminho já salvo + blob novo a subir (compressão no cliente).
  const [fotoPath, setFotoPath] = useState<string | null>(null)
  const [fotoBitmap, setFotoBitmap] = useState<ImageBitmap | null>(null)
  const [logoBitmap, setLogoBitmap] = useState<ImageBitmap | null>(null)
  const [nomeNegocio, setNomeNegocio] = useState('')
  const blobNovo = useRef<Blob | null>(null)

  const [fontesProntas, setFontesProntas] = useState(false)
  const [processandoFoto, setProcessandoFoto] = useState(false)
  const [compartilhando, setCompartilhando] = useState(false)
  const [aExcluir, setAExcluir] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputFoto = useRef<HTMLInputElement>(null)
  const prefilled = useRef(false)
  const perfilCarregado = useRef(false)

  // Garante as fontes (Fraunces / Nunito Sans) antes de desenhar texto no canvas.
  useEffect(() => {
    let vivo = true
    document.fonts.ready.then(() => vivo && setFontesProntas(true))
    return () => {
      vivo = false
    }
  }, [])

  // Perfil: nome do negócio + logo (bucket público) — uma vez.
  useEffect(() => {
    if (perfilCarregado.current || !sessao) return
    perfilCarregado.current = true
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
  }, [sessao])

  // Pré-preenche no modo edição (uma vez, quando a proposta carrega).
  useEffect(() => {
    if (!edicao || prefilled.current || !proposta) return
    prefilled.current = true
    setTitulo(proposta.titulo ?? '')
    setDescricao(proposta.descricao ?? '')
    setValor(proposta.valor != null ? String(proposta.valor).replace('.', ',') : '')
    setValidade(proposta.validade ?? '')
    setFotoPath(proposta.foto_path)
    if (proposta.foto_path) {
      supabase.storage
        .from('publico')
        .download(proposta.foto_path)
        .then(({ data }) => bitmapDeBlob(data ?? null))
        .then((bmp) => bmp && setFotoBitmap(bmp))
    }
  }, [edicao, proposta])

  const valorNum = precoParaNumero(valor)
  const valorTexto = valorNum != null ? formatarReal(valorNum) : 'A combinar'
  const validadeTexto = validade ? `Válido até ${formatarDataNumerica(validade)}` : ''

  // Redesenha o cartão sempre que algo muda (e quando as fontes carregam).
  useEffect(() => {
    if (!fontesProntas || !canvasRef.current) return
    desenharProposta(canvasRef.current, {
      fotoBitmap,
      logoBitmap,
      nomeNegocio,
      titulo,
      descricao,
      cliente: cliente?.nome ?? '',
      valorTexto,
      validadeTexto,
    })
  }, [fontesProntas, fotoBitmap, logoBitmap, nomeNegocio, titulo, descricao, cliente, valorTexto, validadeTexto])

  const semFoto = !fotoBitmap

  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setProcessandoFoto(true)
    try {
      const { blob } = await comprimirImagem(f)
      blobNovo.current = blob
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

  function campos(caminhoFoto: string | null): CamposProposta {
    return { titulo, descricao, valor: valorNum, validade: validade || null, foto_path: caminhoFoto }
  }

  /** Garante que a foto nova (se houver) esteja no storage; devolve o caminho. */
  async function garantirFoto(): Promise<{ path: string | null } | { erro: string }> {
    if (!blobNovo.current) return { path: fotoPath }
    const up = await subirFoto(blobNovo.current)
    if ('erro' in up) return { erro: up.erro }
    blobNovo.current = null
    setFotoPath(up.path)
    return { path: up.path }
  }

  async function salvar() {
    if (!clienteIdAtivo) {
      avisar('Proposta sem cliente.')
      return
    }
    const foto = await garantirFoto()
    if ('erro' in foto) {
      avisar(foto.erro)
      return
    }
    if (edicao && id) {
      const erro = await atualizar(id, campos(foto.path), proposta?.foto_path ?? null)
      if (erro) {
        avisar(erro)
        return
      }
      avisar('Proposta salva ✓')
    } else {
      const res = await criar(clienteIdAtivo, campos(foto.path))
      if ('erro' in res) {
        avisar(res.erro)
        return
      }
      avisar('Proposta salva ✓')
      navegar(`/propostas/${res.id}`, { replace: true })
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
    a.download = `proposta-${(titulo || nomeNegocio || 'cabideia').toLowerCase().replace(/\s+/g, '-')}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  function mensagemWhats(): string {
    const nome = cliente?.nome?.split(' ')[0]
    return [
      nome ? `Oi, ${nome}! 💛` : 'Oi! 💛',
      titulo.trim() ? `Preparei sua proposta: ${titulo.trim()}` : 'Preparei sua proposta:',
      descricao.trim(),
      `Valor: ${valorTexto}`,
      validadeTexto,
      'Já te envio a imagem!',
    ]
      .filter(Boolean)
      .join('\n')
  }

  /** CTA primário: gera o cartão e compartilha (imagem no WhatsApp pelo celular). */
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
      if (navigator.canShare?.({ files: [arquivo] })) {
        try {
          await navigator.share({ files: [arquivo], title: 'Proposta', text: mensagemWhats() })
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
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensagemWhats())}`, '_blank', 'noopener')
  }

  async function confirmarExcluir() {
    if (!proposta) return
    const erro = await excluir(proposta)
    if (erro) {
      avisar(erro)
      setAExcluir(false)
      return
    }
    avisar('Proposta excluída')
    navegar(clienteIdAtivo ? `/clientes/${clienteIdAtivo}` : '/clientes', { replace: true })
  }

  // Espera carregar os dados necessários.
  if (carregandoClientes || (edicao && carregandoPropostas)) return null

  if (edicao && !carregandoPropostas && !proposta) {
    return (
      <div className="tela">
        <BarraTopo titulo="Proposta" />
        <div className="conteudo">
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="busca" size={44} /></div>
            <p>Esta proposta não foi encontrada.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="tela">
      <BarraTopo
        titulo={edicao ? 'Proposta' : 'Nova proposta'}
        acao={
          edicao ? (
            <button className="btn-icone" onClick={() => setAExcluir(true)} aria-label="Excluir proposta">
              <Icone nome="lixo" />
            </button>
          ) : undefined
        }
      />

      <div className="conteudo">
        {/* M-042 · reuso do M-039: virar pedido (ou ir ao pedido já criado) */}
        {edicao && (
          <button
            type="button"
            className="btn-secundario"
            style={{ width: '100%', justifyContent: 'center', marginBottom: 14 }}
            onClick={() =>
              pedidoDaEdicao
                ? navegar(`/pedidos/${pedidoDaEdicao.id}`)
                : navegar(`/pedidos/novo?proposta=${id}`)
            }
          >
            <Icone nome="pedidos" size={16} /> {pedidoDaEdicao ? 'Ver pedido' : 'Virar pedido'}
          </button>
        )}

        {/* Prévia do cartão (canvas 1080×1440 exibido reduzido) */}
        <canvas ref={canvasRef} className="proposta-previa" aria-label="Prévia da proposta" />

        {semFoto && (
          <p className="apoio" style={{ textAlign: 'center', marginTop: 10, color: 'var(--framboesa)', fontWeight: 700 }}>
            Adicione uma foto para deixar a proposta encantadora.
          </p>
        )}

        {/* Foto */}
        <input ref={inputFoto} type="file" accept="image/*" style={{ display: 'none' }} onChange={aoEscolherFoto} />
        <button
          type="button"
          className="btn-secundario"
          style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}
          onClick={() => inputFoto.current?.click()}
          disabled={processandoFoto}
        >
          {processandoFoto ? 'Processando…' : <><Icone nome="imagem" size={16} /> {semFoto ? 'Adicionar foto' : 'Trocar foto'}</>}
        </button>

        {/* Título */}
        <div className="campo" style={{ marginTop: 14 }}>
          <label>Título</label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Bolo de casamento 3 andares"
            maxLength={80}
          />
        </div>

        {/* Descrição */}
        <div className="campo">
          <label>Descrição</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: massa de baunilha, recheio de brigadeiro, topo personalizado…"
            maxLength={200}
          />
        </div>

        {/* Valor */}
        <div className="campo">
          <label>Valor (R$)</label>
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

        {/* Validade */}
        <div className="campo">
          <label>Validade (opcional)</label>
          <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
        </div>

        {/* Compartilhar / baixar (secundários) */}
        <button
          type="button"
          className="btn-secundario"
          style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
          onClick={compartilhar}
          disabled={semFoto || compartilhando}
        >
          {compartilhando ? 'Gerando…' : <><Icone nome="compartilhar" size={16} /> Compartilhar no WhatsApp</>}
        </button>
        <button
          type="button"
          className="btn-secundario"
          style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
          onClick={baixarImagem}
          disabled={semFoto}
        >
          <Icone nome="baixar" size={16} /> Baixar imagem
        </button>
        {cliente?.whatsapp && (
          <button
            type="button"
            className="btn-secundario"
            style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
            onClick={abrirWhatsAppCliente}
          >
            <Icone nome="whatsapp" size={16} /> Abrir conversa de {cliente.nome.split(' ')[0]}
          </button>
        )}

        <p className="apoio" style={{ textAlign: 'center', marginTop: 14 }}>
          A proposta fica salva na ficha da cliente. A foto não conta como trabalho.
        </p>
      </div>

      {/* CTA primário fixo: salvar */}
      <div className="cta-area">
        <button type="button" className="cta" onClick={salvar} disabled={salvando || processandoFoto}>
          {salvando ? 'Salvando…' : edicao ? 'Salvar alterações' : 'Salvar proposta'}
        </button>
      </div>

      {aExcluir && (
        <Confirmar
          titulo="Excluir esta proposta?"
          descricao="Esta ação não pode ser desfeita."
          rotuloConfirmar="Excluir proposta"
          onConfirmar={confirmarExcluir}
          onCancelar={() => setAExcluir(false)}
        />
      )}
    </div>
  )
}
