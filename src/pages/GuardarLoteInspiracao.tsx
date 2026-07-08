import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { LimiteModal } from '../components/LimiteModal'
import { Icone } from '../components/Icone'
import { SeletorTag } from '../components/SeletorTag'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useInspiracoes } from '../hooks/useInspiracoes'
import { usePedidos, tituloPedido } from '../hooks/usePedidos'
import { useAssinatura } from '../hooks/useAssinatura'
import { comprimirImagem } from '../lib/imagem'

/**
 * M-040 · Lote de inspirações de um PEDIDO (rota /inspiracoes/lote?pedido=<id>).
 *
 * A ponte pedido↔inspirações é uma TAG (tabela `tags`, a mesma do acervo):
 * a "tag deste pedido" vem sugerida do nome do pedido (editável), é criada/
 * reusada via criarTag (que normaliza igual às tags de hoje) e, ao guardar,
 * fica gravada em pedidos.tag_id — daí o "Ver inspirações do pedido".
 *
 * Mesmas regras do lote de trabalhos (M-028): compressão obrigatória em todas,
 * pré-checagem do limite de 150 (sobe só até o teto, nunca falha o lote) e
 * captura contínua da câmera (UX-007).
 */
export function GuardarLoteInspiracao() {
  const [searchParams] = useSearchParams()
  const pedidoId = searchParams.get('pedido')
  const { sessao } = useSessao()
  const avisar = useAviso()
  const navegar = useNavigate()

  const { todasTags, subirImagem, criar, criarTag } = useInspiracoes(sessao?.user.id)
  const { buscarPorId, atualizar, carregando } = usePedidos(sessao?.user.id)
  const { total, limite, ilimitado, recarregar } = useAssinatura(sessao?.user.id)

  const pedido = pedidoId ? buscarPorId(pedidoId) : undefined

  const [tagTexto, setTagTexto] = useState('')
  const [nota, setNota] = useState('')
  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>([])
  const [arquivos, setArquivos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)
  const [limiteAberto, setLimiteAberto] = useState(false)
  const [capturaContinua, setCapturaContinua] = useState(false)

  const inputCamera = useRef<HTMLInputElement>(null)
  const inputGaleria = useRef<HTMLInputElement>(null)

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

  function adicionarTag(tagId: string) {
    setTagsSelecionadas((prev) => (prev.includes(tagId) ? prev : [...prev, tagId]))
  }
  function removerTag(tagId: string) {
    setTagsSelecionadas((prev) => prev.filter((x) => x !== tagId))
  }

  async function aoGuardar() {
    if (!pedidoId) return
    if (arquivos.length === 0) return avisar('Escolha ao menos uma foto.')
    if (restante <= 0) {
      setLimiteAberto(true)
      return
    }
    setSalvando(true)
    try {
      // Cria/reusa a tag-ponte antes do lote (criarTag deduplica e normaliza).
      const tagPonte = tagTexto.trim() ? await criarTag(tagTexto) : null
      const tagIds = [
        ...(tagPonte ? [tagPonte.id] : []),
        ...tagsSelecionadas.filter((t) => t !== tagPonte?.id),
      ]

      // Pré-checa o saldo: sobe só até o teto do plano (não falha o lote inteiro).
      const aSubir = ilimitado ? arquivos : arquivos.slice(0, restante)
      const sobraram = arquivos.length - aSubir.length

      let ok = 0
      let falhas = 0
      for (const arq of aSubir) {
        try {
          const { blob } = await comprimirImagem(arq)
          const up = await subirImagem(blob)
          if ('erro' in up) {
            falhas++
            continue
          }
          const res = await criar({
            tipo: 'imagem',
            foto_path: up.path,
            url: null,
            nota: nota.trim() || null,
            tagIds,
          })
          if ('erro' in res) falhas++
          else ok++
        } catch {
          falhas++
        }
      }

      await recarregar()

      if (ok === 0) {
        avisar('Não consegui guardar as inspirações. Tente de novo.')
        return
      }

      // Grava a ponte no pedido — é ela que liga "Ver inspirações do pedido".
      if (tagPonte) await atualizar(pedidoId, { tag_id: tagPonte.id })

      if (sobraram > 0) {
        avisar(
          `Guardei ${ok} inspiraç${ok !== 1 ? 'ões' : 'ão'}. As outras ${sobraram} passaram do limite de ${limite} imagens do plano Grátis.`
        )
      } else if (falhas > 0) {
        avisar(`Guardei ${ok} inspiraç${ok !== 1 ? 'ões' : 'ão'}; ${falhas} falharam.`)
      } else {
        avisar(`${ok} inspiraç${ok !== 1 ? 'ões guardadas' : 'ão guardada'} ✓`)
      }
      navegar(`/pedidos/${pedidoId}`, { replace: true })
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return null

  if (!pedidoId || !pedido) {
    return (
      <div className="tela">
        <BarraTopo titulo="Inspirações do pedido" />
        <div className="conteudo">
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="busca" size={44} /></div>
            <p>Este pedido não foi encontrado.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="tela">
      <BarraTopo titulo="Inspirações do pedido" />

      <div className="conteudo">
        <input ref={inputCamera} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={adicionarDaCamera} />
        <input ref={inputGaleria} type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }} onChange={adicionarArquivos} />

        <p className="apoio" style={{ marginBottom: 12 }}>
          Guarde prints e fotos de referência de “{tituloPedido(pedido)}”. Todas
          entram na galeria de Inspirações com a tag do pedido — para achar em
          segundos quando precisar.
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
          <label>Tag deste pedido (vale para todas)</label>
          <input
            value={tagTexto}
            onChange={(e) => setTagTexto(e.target.value)}
            placeholder="ex.: naruto, casamento rústico"
            autoCapitalize="none"
            maxLength={40}
          />
          <p className="apoio" style={{ marginTop: 6 }}>
            É por essa tag que o pedido acha as inspirações depois. Pode encurtar
            (ex.: só o tema da festa).
          </p>
        </div>

        <div className="campo">
          <label>Outras tags (opcional)</label>
          {tagsSelecionadas.length > 0 && (
            <div className="tags-area" style={{ padding: '0 0 8px' }}>
              {tagsSelecionadas.map((tagId) => {
                const tag = todasTags.find((t) => t.id === tagId)
                if (!tag) return null
                return (
                  <button
                    key={tagId}
                    type="button"
                    className="tag-chip aplicada"
                    onClick={() => removerTag(tagId)}
                    title="Toque para tirar esta tag"
                  >
                    {tag.nome} <Icone nome="fechar" size={13} />
                  </button>
                )
              })}
            </div>
          )}
          <SeletorTag
            todasTags={todasTags}
            selecionadas={tagsSelecionadas}
            onSelecionar={(tag) => adicionarTag(tag.id)}
            onCriar={criarTag}
          />
        </div>

        <div className="campo">
          <label>Nota (opcional, vale para todas)</label>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ex.: referências que a cliente mandou"
            maxLength={80}
          />
        </div>
      </div>

      {/* CTA primário fixo */}
      <div className="cta-area">
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => navegar(`/pedidos/${pedidoId}`)}
            className="btn-secundario"
            style={{ flex: 1 }}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={aoGuardar}
            disabled={salvando || arquivos.length === 0}
            className="cta"
            style={{ flex: 2 }}
          >
            {salvando ? 'Enviando…' : `Guardar ${arquivos.length || ''}`.trim()}
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
