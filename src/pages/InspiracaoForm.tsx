import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { LimiteModal } from '../components/LimiteModal'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useInspiracoes, type TipoInspiracao } from '../hooks/useInspiracoes'
import { useAssinatura } from '../hooks/useAssinatura'
import { comprimirImagem } from '../lib/imagem'

/**
 * M-007 · Adicionar/editar inspiração.
 * Dois tipos: Imagem (upload + compressão no cliente) ou Link (URL + nota +
 * capa opcional, um print enviado como miniatura via foto_path). Sem preview
 * automático de link. Tags reaproveitam o conjunto do acervo.
 */
export function InspiracaoForm() {
  const { id } = useParams()
  const edicao = !!id
  const navegar = useNavigate()
  const { sessao } = useSessao()
  const avisar = useAviso()

  const {
    inspiracoes,
    carregando,
    todasTags,
    enviando,
    buscarPorId,
    subirImagem,
    criar,
    atualizar,
    criarTag,
  } = useInspiracoes(sessao?.user.id)
  const { podeAdicionar } = useAssinatura(sessao?.user.id)

  const [tipo, setTipo] = useState<TipoInspiracao>('imagem')
  const [url, setUrl] = useState('')
  const [nota, setNota] = useState('')
  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>([])
  const [novaTagTexto, setNovaTagTexto] = useState('')

  // Foto (imagem principal OU capa do link): caminho já salvo + blob novo a subir.
  const [fotoPath, setFotoPath] = useState<string | null>(null)
  const [blobNovo, setBlobNovo] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [processando, setProcessando] = useState(false)
  const [limiteAberto, setLimiteAberto] = useState(false)

  const inputFoto = useRef<HTMLInputElement>(null)
  const prefilled = useRef(false)

  const insp = edicao && id ? buscarPorId(id) : undefined

  // Pré-preenche no modo edição (uma vez, quando a inspiração carrega).
  useEffect(() => {
    if (!edicao || prefilled.current || !insp) return
    prefilled.current = true
    setTipo(insp.tipo)
    setUrl(insp.url ?? '')
    setNota(insp.nota ?? '')
    setTagsSelecionadas(insp.tags.map((t) => t.id))
    setFotoPath(insp.foto_path)
    if (insp.fotoUrl) setPreviewUrl(insp.fotoUrl)
  }, [edicao, insp])

  // Limpa o objectURL do blob novo ao desmontar/trocar.
  useEffect(() => {
    return () => {
      if (blobNovo && previewUrl) URL.revokeObjectURL(previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl])

  // Imagens contam para o limite de 150; links puros não. Bloqueia ao subir foto.
  function abrirFoto() {
    if (!podeAdicionar) {
      setLimiteAberto(true)
      return
    }
    inputFoto.current?.click()
  }
  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setProcessando(true)
    try {
      const { blob } = await comprimirImagem(f)
      if (blobNovo && previewUrl) URL.revokeObjectURL(previewUrl)
      setBlobNovo(blob)
      setPreviewUrl(URL.createObjectURL(blob))
    } catch (err: unknown) {
      avisar((err as Error)?.message ?? 'Não consegui processar a imagem.')
    } finally {
      setProcessando(false)
    }
  }

  function removerFoto() {
    if (blobNovo && previewUrl) URL.revokeObjectURL(previewUrl)
    setBlobNovo(null)
    setPreviewUrl(null)
    setFotoPath(null)
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

  async function salvar() {
    if (tipo === 'imagem' && !blobNovo && !fotoPath) {
      avisar('Escolha uma imagem primeiro.')
      return
    }
    if (tipo === 'link' && !url.trim()) {
      avisar('Cole o link da inspiração.')
      return
    }

    // Sobe a foto nova (imagem ou capa), se houver.
    let caminhoFoto = fotoPath
    if (blobNovo) {
      if (!podeAdicionar) {
        setLimiteAberto(true)
        return
      }
      const up = await subirImagem(blobNovo)
      if ('erro' in up) {
        avisar(up.erro)
        return
      }
      caminhoFoto = up.path
    }

    const campos = {
      tipo,
      foto_path: caminhoFoto, // imagem principal, ou capa opcional do link
      url: tipo === 'link' ? url.trim() : null,
      nota,
      tagIds: tagsSelecionadas,
    }

    if (edicao && id) {
      const erro = await atualizar(id, campos, insp?.foto_path ?? null)
      if (erro) {
        avisar(erro)
        return
      }
      if (blobNovo && previewUrl) URL.revokeObjectURL(previewUrl)
      avisar('Inspiração atualizada ✓')
      navegar(`/inspiracoes/${id}`, { replace: true })
    } else {
      const res = await criar(campos)
      if ('erro' in res) {
        avisar(res.erro)
        return
      }
      if (blobNovo && previewUrl) URL.revokeObjectURL(previewUrl)
      avisar('Inspiração guardada ✓')
      navegar('/inspiracoes', { replace: true })
    }
  }

  // No modo edição, espera carregar.
  if (edicao && carregando) return null
  if (edicao && !carregando && inspiracoes.length > 0 && !insp) {
    return (
      <div className="tela">
        <BarraTopo titulo="Inspiração" />
        <div className="conteudo">
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="busca" size={44} /></div>
            <p>Esta inspiração não foi encontrada.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="tela">
      <BarraTopo titulo={edicao ? 'Editar inspiração' : 'Nova inspiração'} />

      <div className="conteudo">
        <input
          ref={inputFoto}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={aoEscolherFoto}
        />

        {/* Tipo (oculto na edição: não dá pra trocar imagem↔link) */}
        {!edicao && (
          <div className="campo">
            <label>O que você quer guardar?</label>
            <div className="escolha">
              <button
                type="button"
                className={`filtro${tipo === 'imagem' ? ' ativo' : ''}`}
                onClick={() => setTipo('imagem')}
              >
                <Icone nome="imagem" size={15} /> Imagem
              </button>
              <button
                type="button"
                className={`filtro${tipo === 'link' ? ' ativo' : ''}`}
                onClick={() => setTipo('link')}
              >
                <Icone nome="link" size={15} /> Link
              </button>
            </div>
          </div>
        )}

        {/* Link: URL */}
        {tipo === 'link' && (
          <div className="campo">
            <label>Link</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Cole o endereço (ex.: pinterest.com/...)"
              inputMode="url"
              autoCapitalize="none"
            />
          </div>
        )}

        {/* Foto: principal (imagem) ou capa opcional (link) */}
        <div className="campo">
          <label>{tipo === 'imagem' ? 'Imagem' : 'Capa (opcional)'}</label>
          {previewUrl ? (
            <div className="foto-seletor" style={{ borderStyle: 'solid' }}>
              <img
                src={previewUrl}
                alt="Prévia"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }}
              />
            </div>
          ) : (
            <button
              type="button"
              className="origem-botao"
              style={{ width: '100%' }}
              onClick={abrirFoto}
              disabled={processando}
            >
              <span className="origem-emoji"><Icone nome="imagem" size={30} /></span>
              {processando
                ? 'Processando…'
                : tipo === 'imagem'
                  ? 'Escolher imagem'
                  : 'Adicionar um print'}
            </button>
          )}
          {previewUrl && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="btn-secundario"
                style={{ flex: 1 }}
                onClick={abrirFoto}
              >
                Trocar
              </button>
              <button
                type="button"
                className="btn-secundario"
                style={{ flex: 1 }}
                onClick={removerFoto}
              >
                Remover
              </button>
            </div>
          )}
          {tipo === 'link' && (
            <p className="apoio" style={{ marginTop: 6 }}>
              O link não gera prévia sozinho. Se quiser, envie um print como capa.
            </p>
          )}
        </div>

        {/* Nota */}
        <div className="campo">
          <label>Nota (opcional)</label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ex.: paleta de cores, ideia de topo, referência de embalagem…"
            maxLength={300}
          />
        </div>

        {/* Tags */}
        <div className="campo">
          <label>Tags (toque para escolher)</label>
          {todasTags.length > 0 && (
            <div className="tags-area" style={{ marginBottom: 8, padding: '0 0 2px' }}>
              {todasTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={`tag-chip${tagsSelecionadas.includes(tag.id) ? ' selecionada' : ''}`}
                  onClick={() => toggleTag(tag.id)}
                >
                  {tagsSelecionadas.includes(tag.id) && <Icone nome="ok" size={13} strokeWidth={3} style={{ marginRight: 4 }} />}
                  {tag.nome}
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
              autoCapitalize="none"
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
            className="btn-secundario"
            style={{ flex: 1 }}
            onClick={() => navegar(-1)}
            disabled={enviando || processando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="cta"
            style={{ flex: 2 }}
            onClick={salvar}
            disabled={enviando || processando}
          >
            {enviando ? 'Salvando…' : edicao ? 'Salvar' : 'Guardar'}
          </button>
        </div>
      </div>

      {limiteAberto && <LimiteModal onFechar={() => setLimiteAberto(false)} />}
    </div>
  )
}
