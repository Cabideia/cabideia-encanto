import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Confirmar } from '../components/Confirmar'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useClientes } from '../hooks/useClientes'
import { usePedidos, STATUS_INFO, type CamposPedido, type StatusPedido } from '../hooks/usePedidos'
import { comprimirImagem } from '../lib/imagem'

const ORDEM_STATUS: StatusPedido[] = ['a_fazer', 'em_producao', 'entregue', 'cancelado']

type DadosForm = {
  cliente_id: string | null
  nome: string
  tema: string
  data_entrega: string
  status: StatusPedido
}

/** M-002 · Formulário de pedido (cria em /pedidos/novo, edita em /pedidos/:id/editar). */
export function PedidoForm() {
  const { id } = useParams()
  const edicao = !!id
  const navegar = useNavigate()
  const { sessao } = useSessao()
  const avisar = useAviso()

  const { clientes, criar: criarCliente, salvando: salvandoCliente } = useClientes(sessao?.user.id)
  const {
    carregando,
    salvando,
    buscarPorId,
    criar,
    atualizar,
    excluir,
    subirReferencia,
    urlReferencia,
  } = usePedidos(sessao?.user.id)

  const [form, setForm] = useState<DadosForm>({
    cliente_id: null,
    nome: '',
    tema: '',
    data_entrega: '',
    status: 'a_fazer',
  })
  const [aExcluir, setAExcluir] = useState(false)
  const [fotoPath, setFotoPath] = useState<string | null>(null) // referência já salva
  const [blobNovo, setBlobNovo] = useState<Blob | null>(null) // referência nova a subir
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [processando, setProcessando] = useState(false)

  // Atalho "novo cliente"
  const [novoClienteAberto, setNovoClienteAberto] = useState(false)
  const [novoNome, setNovoNome] = useState('')

  const inputFoto = useRef<HTMLInputElement>(null)
  const prefilled = useRef(false)

  // Pré-preenche no modo edição quando o pedido carrega (uma vez).
  const pedido = edicao && id ? buscarPorId(id) : undefined
  useEffect(() => {
    if (!edicao || prefilled.current || !pedido) return
    prefilled.current = true
    setForm({
      cliente_id: pedido.cliente_id,
      nome: pedido.nome ?? '',
      tema: pedido.tema ?? '',
      data_entrega: pedido.data_entrega ?? '',
      status: pedido.status,
    })
    setFotoPath(pedido.foto_referencia_path)
    if (pedido.foto_referencia_path) {
      urlReferencia(pedido.foto_referencia_path).then((u) => {
        if (u) setPreviewUrl(u)
      })
    }
  }, [edicao, pedido, urlReferencia])

  // Limpa o objectURL da foto nova ao desmontar/trocar.
  useEffect(() => {
    return () => {
      if (blobNovo && previewUrl) URL.revokeObjectURL(previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl])

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
      avisar((err as Error)?.message ?? 'Não consegui processar a foto.')
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

  async function criarClienteRapido() {
    const nome = novoNome.trim()
    if (!nome) return
    const res = await criarCliente({ nome, whatsapp: '', nota: '' })
    if ('erro' in res) {
      avisar(res.erro)
      return
    }
    setForm((f) => ({ ...f, cliente_id: res.cliente.id }))
    setNovoNome('')
    setNovoClienteAberto(false)
    avisar('Cliente criada ✓')
  }

  async function salvar() {
    if (!form.nome.trim()) {
      avisar('Dê um nome ao pedido.')
      return
    }
    // Sobe a foto nova, se houver.
    let caminhoFoto = fotoPath
    if (blobNovo) {
      const up = await subirReferencia(blobNovo)
      if ('erro' in up) {
        avisar(up.erro)
        return
      }
      caminhoFoto = up.path
    }

    const campos: CamposPedido = {
      cliente_id: form.cliente_id,
      nome: form.nome,
      tema: form.tema,
      data_entrega: form.data_entrega || null,
      status: form.status,
      foto_referencia_path: caminhoFoto,
    }

    if (edicao && id) {
      const erro = await atualizar(id, campos)
      if (erro) {
        avisar(erro)
        return
      }
      avisar('Pedido atualizado ✓')
      navegar(`/pedidos/${id}`, { replace: true })
    } else {
      const res = await criar(campos)
      if ('erro' in res) {
        avisar(res.erro)
        return
      }
      avisar('Pedido salvo ✓')
      navegar(`/pedidos/${res.id}`, { replace: true })
    }
  }

  async function confirmarExcluir() {
    if (!id) return
    const erro = await excluir(id)
    if (erro) {
      avisar(erro)
      setAExcluir(false)
      return
    }
    avisar('Pedido excluído')
    navegar('/pedidos', { replace: true })
  }

  // No modo edição, espera o pedido carregar.
  if (edicao && carregando) return null
  if (edicao && !carregando && !pedido) {
    return (
      <div className="tela">
        <BarraTopo titulo="Pedido" />
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
      <BarraTopo titulo={edicao ? 'Editar pedido' : 'Novo pedido'} />

      <div className="conteudo">
        {/* Cliente */}
        <div className="campo">
          <label>Cliente (opcional)</label>
          <select
            value={form.cliente_id ?? ''}
            onChange={(e) => setForm({ ...form, cliente_id: e.target.value || null })}
          >
            <option value="">Sem cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          {!novoClienteAberto ? (
            <button
              type="button"
              className="tag-criar"
              style={{ marginTop: 8 }}
              onClick={() => setNovoClienteAberto(true)}
            >
              ＋ Nova cliente
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                autoFocus
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    criarClienteRapido()
                  }
                  if (e.key === 'Escape') {
                    setNovoClienteAberto(false)
                    setNovoNome('')
                  }
                }}
                placeholder="Nome da cliente"
                maxLength={80}
                style={{ flex: 1, minHeight: 44, padding: '10px 14px', border: '1px solid var(--linha)', borderRadius: 12, font: 'inherit', fontSize: 'var(--t-base)', outline: 'none', background: 'var(--acucar)', color: 'var(--cacau)' }}
              />
              <button
                type="button"
                className="zap"
                onClick={criarClienteRapido}
                disabled={salvandoCliente || !novoNome.trim()}
              >
                Salvar
              </button>
            </div>
          )}
        </div>

        {/* Nome do pedido (obrigatório, curto) */}
        <div className="campo">
          <label>Nome do pedido</label>
          <input
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex.: Bolo unicórnio da Sofia"
            maxLength={80}
          />
        </div>

        {/* Detalhes do pedido (opcional, longo) */}
        <div className="campo">
          <label>Detalhes do pedido (opcional)</label>
          <textarea
            value={form.tema}
            onChange={(e) => setForm({ ...form, tema: e.target.value })}
            placeholder="Ex.: 100 doces tradicionais, tema unicórnio, entregar montado"
            maxLength={300}
          />
        </div>

        {/* Data de entrega */}
        <div className="campo">
          <label>Data de entrega (opcional)</label>
          <input
            type="date"
            value={form.data_entrega}
            onChange={(e) => setForm({ ...form, data_entrega: e.target.value })}
          />
        </div>

        {/* Status */}
        <div className="campo">
          <label>Status</label>
          <div className="escolha">
            {ORDEM_STATUS.map((s) => (
              <button
                key={s}
                type="button"
                className={`filtro${form.status === s ? ' ativo' : ''}`}
                onClick={() => setForm({ ...form, status: s })}
              >
                {STATUS_INFO[s].rotulo}
              </button>
            ))}
          </div>
        </div>

        {/* Foto de referência */}
        <div className="campo">
          <label>Foto de referência (opcional)</label>
          <input
            ref={inputFoto}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={aoEscolherFoto}
          />
          {previewUrl ? (
            <div className="foto-seletor" style={{ borderStyle: 'solid' }}>
              <img src={previewUrl} alt="Referência" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} />
            </div>
          ) : (
            <button
              type="button"
              className="origem-botao"
              style={{ width: '100%' }}
              onClick={() => inputFoto.current?.click()}
              disabled={processando}
            >
              <span className="origem-emoji">🖼️</span>
              {processando ? 'Processando…' : 'Adicionar foto'}
            </button>
          )}
          {previewUrl && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" className="btn-secundario" style={{ flex: 1 }} onClick={() => inputFoto.current?.click()}>
                Trocar
              </button>
              <button type="button" className="btn-secundario" style={{ flex: 1 }} onClick={removerFoto}>
                Remover
              </button>
            </div>
          )}
        </div>

        {/* Excluir (só na edição) */}
        {edicao && (
          <button
            className="btn-secundario"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            onClick={() => setAExcluir(true)}
          >
            🗑️ Excluir pedido
          </button>
        )}
      </div>

      {/* CTA primário fixo */}
      <div className="cta-area">
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn-secundario"
            style={{ flex: 1 }}
            onClick={() => navegar(-1)}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="cta"
            style={{ flex: 2 }}
            onClick={salvar}
            disabled={salvando || processando || !form.nome.trim()}
          >
            {salvando ? 'Salvando…' : edicao ? 'Salvar' : 'Criar pedido'}
          </button>
        </div>
      </div>

      {aExcluir && (
        <Confirmar
          titulo="Excluir este pedido?"
          descricao="Esta ação não pode ser desfeita. As fotos que já foram para o acervo continuam lá."
          rotuloConfirmar="Excluir pedido"
          onConfirmar={confirmarExcluir}
          onCancelar={() => setAExcluir(false)}
        />
      )}
    </div>
  )
}
