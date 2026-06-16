import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Confirmar } from '../components/Confirmar'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useClientes, type CamposCliente } from '../hooks/useClientes'
import { usePedidos, STATUS_INFO, type CamposPedido, type StatusPedido } from '../hooks/usePedidos'
import { useInspiracoes, dominioDe } from '../hooks/useInspiracoes'
import { comprimirImagem } from '../lib/imagem'

const ORDEM_STATUS: StatusPedido[] = ['a_fazer', 'em_producao', 'entregue', 'cancelado']

type DadosForm = {
  cliente_id: string | null
  nome: string
  tema: string
  data_entrega: string
  status: StatusPedido
  inspiracao_id: string | null
}

/** M-002 · Formulário de pedido (cria em /pedidos/novo, edita em /pedidos/:id/editar). */
export function PedidoForm() {
  const { id } = useParams()
  const edicao = !!id
  const navegar = useNavigate()
  const { sessao } = useSessao()
  const avisar = useAviso()

  const { clientes, criar: criarCliente, salvando: salvandoCliente } = useClientes(sessao?.user.id)
  const { inspiracoes } = useInspiracoes(sessao?.user.id)
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
    inspiracao_id: null,
  })
  const [pickerInsp, setPickerInsp] = useState(false)
  const [aExcluir, setAExcluir] = useState(false)
  const [fotoPath, setFotoPath] = useState<string | null>(null) // referência já salva
  const [blobNovo, setBlobNovo] = useState<Blob | null>(null) // referência nova a subir
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [processando, setProcessando] = useState(false)

  // Atalho "novo cliente" — formulário completo num sheet por cima do pedido
  const [novoClienteAberto, setNovoClienteAberto] = useState(false)
  const [novoCliente, setNovoCliente] = useState<CamposCliente>({ nome: '', whatsapp: '', nota: '' })

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
      inspiracao_id: pedido.inspiracao_id,
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

  function abrirNovoCliente() {
    setNovoCliente({ nome: '', whatsapp: '', nota: '' })
    setNovoClienteAberto(true)
  }
  function fecharNovoCliente() {
    if (salvandoCliente) return
    setNovoClienteAberto(false)
    setNovoCliente({ nome: '', whatsapp: '', nota: '' })
  }

  async function criarClienteRapido() {
    if (!novoCliente.nome.trim()) return
    const semZap = !novoCliente.whatsapp.trim()
    const res = await criarCliente(novoCliente)
    if ('erro' in res) {
      avisar(res.erro)
      return
    }
    // Seleciona a recém-criada no rascunho do pedido (que ficou preservado).
    setForm((f) => ({ ...f, cliente_id: res.cliente.id }))
    setNovoClienteAberto(false)
    setNovoCliente({ nome: '', whatsapp: '', nota: '' })
    avisar(semZap ? 'Cliente salvo · sem WhatsApp, o botão de conversa não aparece' : 'Cliente salvo ✓')
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
      inspiracao_id: form.inspiracao_id,
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
          <button
            type="button"
            className="tag-criar"
            style={{ marginTop: 8 }}
            onClick={abrirNovoCliente}
          >
            ＋ Novo cliente
          </button>
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

        {/* Inspiração (opcional) — escolher uma da galeria */}
        <div className="campo">
          <label>Inspiração (opcional)</label>
          {(() => {
            const sel = form.inspiracao_id
              ? inspiracoes.find((i) => i.id === form.inspiracao_id)
              : undefined
            if (sel) {
              return (
                <div className="card card-linha" style={{ gap: 10 }}>
                  {sel.fotoUrl ? (
                    <img
                      src={sel.fotoUrl}
                      alt=""
                      style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flex: 'none' }}
                    />
                  ) : (
                    <div className="bola" aria-hidden>🔗</div>
                  )}
                  <div className="card-info">
                    <div className="card-nome">
                      {sel.tipo === 'link' && sel.url ? dominioDe(sel.url) : sel.nota || 'Imagem'}
                    </div>
                    {sel.nota && sel.tipo === 'link' && <div className="apoio">{sel.nota}</div>}
                  </div>
                  <button
                    type="button"
                    className="btn-icone"
                    onClick={() => setForm({ ...form, inspiracao_id: null })}
                    aria-label="Tirar inspiração"
                  >
                    ✕
                  </button>
                </div>
              )
            }
            return (
              <button
                type="button"
                className="origem-botao"
                style={{ width: '100%' }}
                onClick={() => setPickerInsp(true)}
              >
                <span className="origem-emoji">💡</span>
                Anexar uma inspiração
              </button>
            )
          })()}
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

      {/* Sheet: cadastro completo de cliente, por cima do rascunho do pedido */}
      {novoClienteAberto && (
        <div className="painel-overlay" onClick={fecharNovoCliente}>
          <div className="painel" onClick={(e) => e.stopPropagation()}>
            <div className="painel-puxador" />
            <div className="form-acervo-titulo">Novo cliente</div>
            <div className="campo">
              <label>Nome</label>
              <input
                autoFocus
                value={novoCliente.nome}
                onChange={(e) => setNovoCliente({ ...novoCliente, nome: e.target.value })}
                placeholder="Ex.: Maria Silva"
                maxLength={80}
              />
            </div>
            <div className="campo">
              <label>WhatsApp (opcional)</label>
              <input
                value={novoCliente.whatsapp}
                onChange={(e) => setNovoCliente({ ...novoCliente, whatsapp: e.target.value })}
                placeholder="Ex.: +55 11 99999-9999"
                inputMode="tel"
                maxLength={20}
              />
            </div>
            <div className="campo">
              <label>Nota (opcional)</label>
              <textarea
                value={novoCliente.nota}
                onChange={(e) => setNovoCliente({ ...novoCliente, nota: e.target.value })}
                placeholder="Ex.: prefere entregas pela manhã"
                maxLength={300}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                className="btn-secundario"
                style={{ flex: 1 }}
                onClick={fecharNovoCliente}
                disabled={salvandoCliente}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="cta"
                style={{ flex: 2, height: 48 }}
                onClick={criarClienteRapido}
                disabled={salvandoCliente || !novoCliente.nome.trim()}
              >
                {salvandoCliente ? 'Salvando…' : 'Salvar cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sheet: escolher inspiração da galeria */}
      {pickerInsp && (
        <div className="painel-overlay" onClick={() => setPickerInsp(false)}>
          <div className="painel" onClick={(e) => e.stopPropagation()}>
            <div className="painel-puxador" />
            <button className="painel-fechar" onClick={() => setPickerInsp(false)} aria-label="Fechar">✕</button>
            <div className="form-acervo-titulo">Anexar inspiração</div>
            {inspiracoes.length === 0 ? (
              <p className="apoio" style={{ marginTop: 8 }}>
                Você ainda não guardou inspirações. Crie uma em Inspirações, na home.
              </p>
            ) : (
              <div className="grade-fotos" style={{ marginTop: 8, alignItems: 'start' }}>
                {inspiracoes.map((i) => (
                  <div
                    key={i.id}
                    className="foto-item"
                    role="button"
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setForm({ ...form, inspiracao_id: i.id })
                      setPickerInsp(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setForm({ ...form, inspiracao_id: i.id })
                        setPickerInsp(false)
                      }
                    }}
                  >
                    {i.fotoUrl ? (
                      <img src={i.fotoUrl} alt={i.nota ?? ''} loading="lazy" />
                    ) : (
                      <div className="insp-link-capa">
                        <span className="insp-link-emoji" aria-hidden>🔗</span>
                        <span className="insp-link-dominio">{i.url ? dominioDe(i.url) : 'link'}</span>
                      </div>
                    )}
                    {i.nota && <div className="foto-legenda">{i.nota}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {aExcluir && (
        <Confirmar
          titulo="Excluir este pedido?"
          descricao="Esta ação não pode ser desfeita. As fotos que já foram para Meus Trabalhos continuam lá."
          rotuloConfirmar="Excluir pedido"
          onConfirmar={confirmarExcluir}
          onCancelar={() => setAExcluir(false)}
        />
      )}
    </div>
  )
}
