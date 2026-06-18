import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Recorte } from '../components/Recorte'
import { LimiteModal } from '../components/LimiteModal'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useAcervo } from '../hooks/useAcervo'
import { useAssinatura } from '../hooks/useAssinatura'
import { recortarEComprimir, type AreaRecorte } from '../lib/imagem'

/**
 * M-009 · Tela separada para guardar um trabalho.
 *
 * Antes era um formulário embaixo da lista em "Meus trabalhos"; agora é uma
 * rota própria (/acervo/novo). A lógica de upload/compressão é a mesma do hook
 * useAcervo — aqui só mudou onde o formulário mora. Ao salvar, volta para a
 * lista de Meus trabalhos.
 */
export function GuardarTrabalho() {
  const { sessao } = useSessao()
  const avisar = useAviso()
  const navegar = useNavigate()
  const { todasTags, enviando, adicionarBlob, criarTag } = useAcervo(sessao?.user.id)
  const { podeAdicionar } = useAssinatura(sessao?.user.id)

  const [descricao, setDescricao] = useState('')
  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>([])
  const [novaTagTexto, setNovaTagTexto] = useState('')
  const [limiteAberto, setLimiteAberto] = useState(false)

  // Fluxo de adição (recorte → compressão no cliente → blob pronto p/ subir)
  const [arquivoBruto, setArquivoBruto] = useState<File | null>(null)
  const [blobPronto, setBlobPronto] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const inputCamera = useRef<HTMLInputElement>(null)
  const inputGaleria = useRef<HTMLInputElement>(null)

  function abrirSeletor(ref: React.RefObject<HTMLInputElement>) {
    if (!podeAdicionar) {
      setLimiteAberto(true)
      return
    }
    ref.current?.click()
  }
  function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setArquivoBruto(f)
  }
  async function aoConfirmarRecorte(area: AreaRecorte) {
    if (!arquivoBruto) return
    try {
      const { blob } = await recortarEComprimir(arquivoBruto, area)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setBlobPronto(blob)
      setPreviewUrl(URL.createObjectURL(blob))
    } catch (e: unknown) {
      avisar((e as Error)?.message ?? 'Não consegui processar a foto.')
    } finally {
      setArquivoBruto(null)
    }
  }
  function toggleTagForm(id: string) {
    setTagsSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }
  async function aoAdicionarNovaTag() {
    if (!novaTagTexto.trim()) return
    const tag = await criarTag(novaTagTexto)
    if (tag && !tagsSelecionadas.includes(tag.id))
      setTagsSelecionadas((prev) => [...prev, tag.id])
    setNovaTagTexto('')
  }
  async function aoEnviar() {
    if (!blobPronto) return avisar('Escolha uma foto primeiro')
    if (!podeAdicionar) {
      setLimiteAberto(true)
      return
    }
    const erro = await adicionarBlob(blobPronto, descricao, tagsSelecionadas)
    if (erro) {
      avisar(erro)
      return
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    avisar('Trabalho guardado ✓')
    navegar('/acervo', { replace: true })
  }

  return (
    <div className="tela">
      <BarraTopo titulo="Guardar trabalho" />

      <div className="conteudo">
        <input ref={inputCamera} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={aoEscolher} />
        <input ref={inputGaleria} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={aoEscolher} />

        {previewUrl ? (
          <div className="foto-seletor" style={{ borderStyle: 'solid' }}>
            <img src={previewUrl} alt="Foto recortada" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} />
          </div>
        ) : (
          <div className="seletor-origem">
            <button type="button" className="origem-botao" onClick={() => abrirSeletor(inputCamera)}>
              <span className="origem-emoji"><Icone nome="camera" size={30} /></span>
              Tirar foto
            </button>
            <button type="button" className="origem-botao" onClick={() => abrirSeletor(inputGaleria)}>
              <span className="origem-emoji"><Icone nome="imagem" size={30} /></span>
              Da galeria
            </button>
          </div>
        )}

        {previewUrl && (
          <button type="button" className="btn-secundario" style={{ width: '100%', marginTop: 10 }} onClick={() => abrirSeletor(inputGaleria)}>
            Trocar foto
          </button>
        )}

        <div className="campo" style={{ marginTop: 14 }}>
          <label>Legenda (opcional)</label>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Bolo de casamento 3 andares" maxLength={80} />
        </div>

        <div className="campo">
          <label>Tags (toque para escolher)</label>
          {todasTags.length > 0 && (
            <div className="tags-area" style={{ marginBottom: 8, padding: '0 0 2px' }}>
              {todasTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={`tag-chip${tagsSelecionadas.includes(tag.id) ? ' selecionada' : ''}`}
                  onClick={() => toggleTagForm(tag.id)}
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
            onClick={() => navegar('/acervo')}
            className="btn-secundario"
            style={{ flex: 1 }}
            disabled={enviando}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={aoEnviar}
            disabled={enviando || !blobPronto}
            className="cta"
            style={{ flex: 2 }}
          >
            {enviando ? 'Enviando…' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Recorte */}
      {arquivoBruto && (
        <Recorte arquivo={arquivoBruto} onConfirmar={aoConfirmarRecorte} onCancelar={() => setArquivoBruto(null)} />
      )}

      {limiteAberto && <LimiteModal onFechar={() => setLimiteAberto(false)} />}
    </div>
  )
}
