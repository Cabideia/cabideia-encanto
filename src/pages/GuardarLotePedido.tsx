import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { LimiteModal } from '../components/LimiteModal'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useAcervo } from '../hooks/useAcervo'
import { usePedidos, tituloPedido } from '../hooks/usePedidos'
import { useAssinatura } from '../hooks/useAssinatura'
import { comprimirImagem } from '../lib/imagem'

/**
 * M-028 · Upload em LOTE das fotos de um pedido entregue.
 *
 * Cada foto vira 1 registro em `trabalhos` com o mesmo `pedido_id`. Legenda e
 * tags são as MESMAS para todo o lote (a edição individual fica para depois,
 * pelo detalhe do trabalho — M-026). Compressão obrigatória em todas (M-009);
 * o recorte manual é pulado no lote (só existe no upload de 1 foto, em M-009).
 *
 * Gate do plano Grátis (150 imagens): pré-checa o saldo e, se o lote estourar,
 * sobe só até o teto e avisa — nunca falha o lote inteiro.
 */
export function GuardarLotePedido() {
  const { id } = useParams()
  const { sessao } = useSessao()
  const avisar = useAviso()
  const navegar = useNavigate()

  const { todasTags, enviando, criarTrabalhoDeBlob, criarTag } = useAcervo(sessao?.user.id)
  const { buscarPorId, carregando } = usePedidos(sessao?.user.id)
  const { total, limite, ilimitado, recarregar } = useAssinatura(sessao?.user.id)

  const pedido = id ? buscarPorId(id) : undefined

  const [descricao, setDescricao] = useState('')
  const [legendaTocada, setLegendaTocada] = useState(false)
  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>([])
  const [novaTagTexto, setNovaTagTexto] = useState('')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [limiteAberto, setLimiteAberto] = useState(false)
  // UX-007 · Captura contínua: depois da 1ª foto de câmera, um sheet oferece
  // "Nova foto" (tira e continua) e "Concluir" (volta ao lote com tudo anexado).
  const [capturaContinua, setCapturaContinua] = useState(false)

  const inputCamera = useRef<HTMLInputElement>(null)
  const inputGaleria = useRef<HTMLInputElement>(null)

  // Legenda começa com o nome curto do pedido (a dona pode trocar).
  useEffect(() => {
    if (pedido && !legendaTocada && !descricao) setDescricao(tituloPedido(pedido))
  }, [pedido, legendaTocada, descricao])

  // Limpa as URLs de preview ao desmontar.
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  const restante = ilimitado ? Infinity : Math.max(0, limite - total)

  function adicionarArquivos(e: React.ChangeEvent<HTMLInputElement>) {
    const novos = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (novos.length === 0) return
    setArquivos((prev) => [...prev, ...novos])
    setPreviews((prev) => [...prev, ...novos.map((f) => URL.createObjectURL(f))])
  }
  function adicionarDaCamera(e: React.ChangeEvent<HTMLInputElement>) {
    const veioFoto = (e.target.files?.length ?? 0) > 0
    adicionarArquivos(e)
    if (veioFoto) setCapturaContinua(true)
  }
  function removerArquivo(i: number) {
    URL.revokeObjectURL(previews[i])
    setArquivos((prev) => prev.filter((_, idx) => idx !== i))
    setPreviews((prev) => prev.filter((_, idx) => idx !== i))
  }

  function toggleTag(tagId: string) {
    setTagsSelecionadas((prev) =>
      prev.includes(tagId) ? prev.filter((x) => x !== tagId) : [...prev, tagId]
    )
  }
  async function aoAdicionarNovaTag() {
    if (!novaTagTexto.trim()) return
    const tag = await criarTag(novaTagTexto)
    if (tag && !tagsSelecionadas.includes(tag.id))
      setTagsSelecionadas((prev) => [...prev, tag.id])
    setNovaTagTexto('')
  }

  async function aoGuardar() {
    if (arquivos.length === 0) return avisar('Escolha ao menos uma foto.')
    if (restante <= 0) {
      setLimiteAberto(true)
      return
    }

    // Pré-checa o saldo: sobe só até o teto do plano (não falha o lote inteiro).
    const aSubir = ilimitado ? arquivos : arquivos.slice(0, restante)
    const sobraram = arquivos.length - aSubir.length

    let ok = 0
    let falhas = 0
    for (const arq of aSubir) {
      try {
        const { blob } = await comprimirImagem(arq)
        const res = await criarTrabalhoDeBlob(blob, descricao, tagsSelecionadas, id)
        if ('erro' in res) falhas++
        else ok++
      } catch {
        falhas++
      }
    }

    await recarregar()

    if (ok > 0 && sobraram > 0) {
      avisar(
        `Subi ${ok} foto${ok !== 1 ? 's' : ''}. As outras ${sobraram} passaram do limite de ${limite} imagens do plano Grátis.`
      )
    } else if (ok > 0 && falhas > 0) {
      avisar(`Subi ${ok} foto${ok !== 1 ? 's' : ''}; ${falhas} falharam.`)
    } else if (ok > 0) {
      avisar(`${ok} foto${ok !== 1 ? 's' : ''} guardada${ok !== 1 ? 's' : ''} ✓`)
    } else {
      avisar('Não consegui guardar as fotos. Tente de novo.')
      return
    }
    navegar(`/pedidos/${id}`, { replace: true })
  }

  if (carregando) return null

  return (
    <div className="tela">
      <BarraTopo titulo="Fotos do pedido" />

      <div className="conteudo">
        <input ref={inputCamera} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={adicionarDaCamera} />
        <input ref={inputGaleria} type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }} onChange={adicionarArquivos} />

        <p className="apoio" style={{ marginBottom: 12 }}>
          Cada foto vira um trabalho ligado a este pedido. A legenda e as tags
          valem para todas — depois você ajusta cada uma no detalhe.
        </p>

        <div className="seletor-origem">
          <button type="button" className="origem-botao" onClick={() => inputCamera.current?.click()}>
            <span className="origem-emoji"><Icone nome="camera" size={30} /></span>
            Tirar foto
          </button>
          <button type="button" className="origem-botao" onClick={() => inputGaleria.current?.click()}>
            <span className="origem-emoji"><Icone nome="imagem" size={30} /></span>
            Da galeria
          </button>
        </div>

        {previews.length > 0 && (
          <>
            <div className="apoio" style={{ marginTop: 12, fontWeight: 700 }}>
              {arquivos.length} foto{arquivos.length !== 1 ? 's' : ''} escolhida{arquivos.length !== 1 ? 's' : ''}
              {!ilimitado && arquivos.length > restante && (
                <span style={{ color: 'var(--caramelo)' }}>
                  {' '}· só {restante} cabe{restante !== 1 ? 'm' : ''} no plano Grátis
                </span>
              )}
            </div>
            <div className="grade-fotos" style={{ marginTop: 8, alignItems: 'start' }}>
              {previews.map((src, i) => (
                <div className="foto-item" key={src}>
                  <div className="acervo-img-wrap">
                    <img src={src} alt={`Foto ${i + 1}`} loading="lazy" />
                    <button
                      className="foto-remover"
                      onClick={() => removerArquivo(i)}
                      aria-label="Tirar esta foto do lote"
                    >
                      <Icone nome="fechar" size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="campo" style={{ marginTop: 14 }}>
          <label>Legenda (vale para todas)</label>
          <input
            value={descricao}
            onChange={(e) => { setLegendaTocada(true); setDescricao(e.target.value) }}
            placeholder="Ex.: Bolo de casamento 3 andares"
            maxLength={80}
          />
        </div>

        <div className="campo">
          <label>Tags (valem para todas)</label>
          {todasTags.length > 0 && (
            <div className="tags-area" style={{ marginBottom: 8, padding: '0 0 2px' }}>
              {todasTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={`tag-chip${tagsSelecionadas.includes(tag.id) ? ' selecionada' : ''}`}
                  onClick={() => toggleTag(tag.id)}
                >
                  {tagsSelecionadas.includes(tag.id) && <Icone nome="ok" size={13} strokeWidth={3} style={{ marginRight: 4 }} />}{tag.nome}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={novaTagTexto}
              onChange={(e) => setNovaTagTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  aoAdicionarNovaTag()
                }
              }}
              placeholder="Nova tag… Enter para criar"
              style={{ flex: 1, minHeight: 44, padding: '10px 14px', border: '1px solid var(--linha)', borderRadius: 12, font: 'inherit', fontSize: 'var(--t-base)', outline: 'none', background: 'var(--acucar)', color: 'var(--cacau)' }}
            />
            <button
              type="button"
              onClick={aoAdicionarNovaTag}
              style={{ height: 44, padding: '0 16px', border: '1px solid var(--linha)', borderRadius: 12, background: 'var(--pistache-suave)', color: 'var(--pistache)', fontWeight: 700, cursor: 'pointer', fontSize: 18 }}
            >
              ＋
            </button>
          </div>
        </div>
      </div>

      {/* CTA primário fixo */}
      <div className="cta-area">
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => navegar(`/pedidos/${id}`)}
            className="btn-secundario"
            style={{ flex: 1 }}
            disabled={enviando}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={aoGuardar}
            disabled={enviando || arquivos.length === 0}
            className="cta"
            style={{ flex: 2 }}
          >
            {enviando ? 'Enviando…' : `Guardar ${arquivos.length || ''}`.trim()}
          </button>
        </div>
      </div>

      {/* Sheet da captura contínua (UX-007): tirar várias sem sair do fluxo */}
      {capturaContinua && (
        <div className="painel-overlay" onClick={() => setCapturaContinua(false)}>
          <div className="painel" onClick={(e) => e.stopPropagation()}>
            <div className="painel-puxador" />
            <div className="form-acervo-titulo">
              {arquivos.length} foto{arquivos.length !== 1 ? 's' : ''} no lote ✓
            </div>
            <p className="apoio" style={{ marginBottom: 14 }}>
              Tire quantas quiser em sequência. Ao concluir, você revisa tudo antes de guardar.
            </p>
            <button
              className="cta"
              style={{ marginBottom: 10 }}
              onClick={() => inputCamera.current?.click()}
            >
              <Icone nome="camera" size={16} /> Nova foto
            </button>
            <button
              className="btn-secundario"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setCapturaContinua(false)}
            >
              <Icone nome="ok" size={16} /> Concluir
            </button>
          </div>
        </div>
      )}

      {limiteAberto && <LimiteModal onFechar={() => setLimiteAberto(false)} />}
    </div>
  )
}
