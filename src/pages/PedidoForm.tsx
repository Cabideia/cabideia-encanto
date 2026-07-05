import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Confirmar } from '../components/Confirmar'
import { LimiteModal } from '../components/LimiteModal'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useClientes, type CamposCliente } from '../hooks/useClientes'
import { usePedidos, STATUS_INFO, type CamposPedido, type StatusPedido } from '../hooks/usePedidos'
import { usePropostas } from '../hooks/usePropostas'
import { useInspiracoes, dominioDe } from '../hooks/useInspiracoes'
import { useAssinatura } from '../hooks/useAssinatura'
import { useCardapio, textoItemCardapio, formatarReal, precoParaNumero } from '../hooks/useCardapio'
import { comprimirImagem } from '../lib/imagem'
import { supabase } from '../lib/supabase'

const ORDEM_STATUS: StatusPedido[] = ['a_fazer', 'em_producao', 'entregue', 'cancelado']

type DadosForm = {
  cliente_id: string | null
  nome: string
  tema: string
  valor: string // texto BR ("120,00"); vazio = sem valor
  data_entrega: string
  status: StatusPedido
  inspiracao_id: string | null
}

/**
 * M-002 · Formulário de pedido (cria em /pedidos/novo, edita em /pedidos/:id/editar).
 * M-039 · Conversão proposta → pedido: /pedidos/novo?proposta=<id> pré-preenche
 * tudo da proposta (100% editável), exige a data de entrega e, ao salvar, copia
 * a foto para o acervo, grava proposta_id e marca a proposta como resolvida.
 */
export function PedidoForm() {
  const { id } = useParams()
  const edicao = !!id
  const [searchParams] = useSearchParams()
  const navegar = useNavigate()
  const { sessao } = useSessao()
  const avisar = useAviso()

  const { clientes, criar: criarCliente, salvando: salvandoCliente } = useClientes(sessao?.user.id)
  const { inspiracoes } = useInspiracoes(sessao?.user.id)
  const { itens: itensCardapio } = useCardapio(sessao?.user.id)
  const {
    carregando,
    salvando,
    buscarPorId,
    pedidoDaProposta,
    criar,
    atualizar,
    excluir,
    subirReferencia,
    urlReferencia,
  } = usePedidos(sessao?.user.id)
  const {
    carregando: carregandoPropostas,
    buscarPorId: buscarProposta,
    marcarResolvida,
  } = usePropostas(sessao?.user.id)
  const { podeAdicionar } = useAssinatura(sessao?.user.id)

  // M-039 · modo conversão (?proposta=<id>) — só na criação.
  const propostaId = !edicao ? searchParams.get('proposta') : null
  const conversao = !!propostaId
  const proposta = propostaId ? buscarProposta(propostaId) : undefined

  const [form, setForm] = useState<DadosForm>({
    cliente_id: null,
    nome: '',
    tema: '',
    valor: '',
    data_entrega: '',
    status: 'a_fazer',
    inspiracao_id: null,
  })
  const [pickerInsp, setPickerInsp] = useState(false)
  const [pickerTabela, setPickerTabela] = useState(false)
  const [aExcluir, setAExcluir] = useState(false)
  const [fotoPath, setFotoPath] = useState<string | null>(null) // referência já salva
  const [blobNovo, setBlobNovo] = useState<Blob | null>(null) // referência nova a subir
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [processando, setProcessando] = useState(false)
  const [limiteAberto, setLimiteAberto] = useState(false)

  // Atalho "novo cliente" — formulário completo num sheet por cima do pedido
  const [novoClienteAberto, setNovoClienteAberto] = useState(false)
  const [novoCliente, setNovoCliente] = useState<CamposCliente>({ nome: '', whatsapp: '', nota: '' })

  const inputFoto = useRef<HTMLInputElement>(null)
  const temaRef = useRef<HTMLTextAreaElement>(null)
  const caretTema = useRef<number | null>(null) // ponto de inserção da Tabela de preços
  const prefilled = useRef(false)
  const prefilledNovo = useRef(false)
  const prefilledProposta = useRef(false)

  // UX-002 · Abre o atalho guardando onde está o cursor (ou o fim, se o campo
  // não estiver em foco) — assim os itens entram no ponto certo.
  function abrirTabela() {
    const ta = temaRef.current
    caretTema.current =
      ta && document.activeElement === ta ? ta.selectionStart : form.tema.length
    setPickerTabela(true)
  }

  // UX-002 · Insere o texto pronto de um item da Tabela de preços no ponto do
  // cursor do campo Detalhes (texto livre — sem vínculo estrutural). Permite vários.
  function inserirDaTabela(item: (typeof itensCardapio)[number]) {
    const trecho = textoItemCardapio(item)
    const atual = form.tema
    const pos = Math.min(caretTema.current ?? atual.length, atual.length)
    const antes = atual.slice(0, pos)
    const depois = atual.slice(pos)
    const precisaQuebra = antes.length > 0 && !antes.endsWith('\n')
    const inserido = (precisaQuebra ? '\n' : '') + trecho
    const novo = antes + inserido + depois
    if (novo.length > 300) {
      avisar('Não cabe mais texto nos detalhes.')
      return
    }
    setForm((f) => ({ ...f, tema: novo }))
    caretTema.current = antes.length + inserido.length // avança p/ o próximo item
    avisar('Item inserido ✓')
  }

  // Pré-preenche no modo edição quando o pedido carrega (uma vez).
  const pedido = edicao && id ? buscarPorId(id) : undefined
  useEffect(() => {
    if (!edicao || prefilled.current || !pedido) return
    prefilled.current = true
    setForm({
      cliente_id: pedido.cliente_id,
      nome: pedido.nome ?? '',
      tema: pedido.tema ?? '',
      valor: pedido.valor != null ? String(pedido.valor).replace('.', ',') : '',
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

  // Criação a partir do calendário: pré-preenche a data de entrega (?data=YYYY-MM-DD).
  useEffect(() => {
    if (edicao || prefilledNovo.current) return
    const data = searchParams.get('data')
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return
    prefilledNovo.current = true
    setForm((f) => ({ ...f, data_entrega: data }))
  }, [edicao, searchParams])

  // M-039 · Conversão: pré-preenche da proposta (uma vez, quando as listas carregam).
  // Data de entrega fica VAZIA de propósito (validade da proposta ≠ data de entrega).
  useEffect(() => {
    if (!conversao || !propostaId || prefilledProposta.current) return
    if (carregando || carregandoPropostas) return
    prefilledProposta.current = true
    // Se a proposta já virou pedido, nunca duplica: vai direto ao pedido.
    const existente = pedidoDaProposta(propostaId)
    if (existente) {
      navegar(`/pedidos/${existente.id}`, { replace: true })
      return
    }
    if (!proposta) return // id inválido → segue como pedido novo em branco
    setForm((f) => ({
      ...f,
      cliente_id: proposta.cliente_id,
      nome: proposta.titulo ?? '',
      tema: proposta.descricao ?? '',
      valor: proposta.valor != null ? String(proposta.valor).replace('.', ',') : '',
      data_entrega: '',
      status: 'a_fazer',
    }))
    // A foto entra como "foto nova" (blob): ao salvar, sobe uma CÓPIA no acervo
    // (arquivo novo em {uid}/referencias/ — nunca a mesma URL da proposta).
    if (proposta.foto_path) {
      supabase.storage
        .from('publico')
        .download(proposta.foto_path)
        .then(({ data }) => {
          if (!data) return
          setBlobNovo(data)
          setPreviewUrl(URL.createObjectURL(data))
        })
    }
  }, [conversao, propostaId, carregando, carregandoPropostas, pedidoDaProposta, proposta, navegar])

  // Limpa o objectURL da foto nova ao desmontar/trocar.
  useEffect(() => {
    return () => {
      if (blobNovo && previewUrl) URL.revokeObjectURL(previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl])

  // A foto de referência conta para o limite de 150 imagens do plano Grátis.
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
    // M-039 · na conversão a data de entrega é obrigatória.
    if (conversao && !form.data_entrega) {
      avisar('Escolha a data de entrega.')
      return
    }
    // Sobe a foto nova, se houver. Na conversão, se o limite de 150 estourar,
    // o pedido é criado SEM a foto (a conversão nunca falha por causa dela —
    // o gate server-side barraria o upload de qualquer forma).
    let caminhoFoto = fotoPath
    let fotoPulada = false
    if (blobNovo) {
      if (!podeAdicionar) {
        if (!conversao) {
          setLimiteAberto(true)
          return
        }
        fotoPulada = true
      } else {
        const up = await subirReferencia(blobNovo)
        if ('erro' in up) {
          if (!conversao) {
            avisar(up.erro)
            return
          }
          fotoPulada = true
        } else {
          caminhoFoto = up.path
        }
      }
    }
    if (fotoPulada) caminhoFoto = null

    const campos: CamposPedido = {
      cliente_id: form.cliente_id,
      nome: form.nome,
      tema: form.tema,
      valor: precoParaNumero(form.valor),
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
      if (conversao && propostaId) campos.proposta_id = propostaId
      const res = await criar(campos)
      if ('erro' in res) {
        avisar(res.erro)
        return
      }
      if (conversao && propostaId) {
        // Auto-arquiva a proposta na aba ativa do Acompanhar (padrão M-037).
        await marcarResolvida(propostaId, true)
        avisar(
          fotoPulada
            ? 'Pedido criado sem a foto — você chegou ao limite de 150 imagens do plano Grátis.'
            : 'Proposta virou pedido ✓'
        )
      } else {
        avisar('Pedido salvo ✓')
      }
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
            <div className="icone"><Icone nome="busca" size={44} /></div>
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
          <div className="campo-rotulo-linha">
            <label>Detalhes do pedido (opcional)</label>
            <button
              type="button"
              className="atalho-tabela"
              onClick={abrirTabela}
              aria-label="Inserir item da Tabela de preços"
            >
              <Icone nome="precos" size={14} /> Tabela de preços
            </button>
          </div>
          <textarea
            ref={temaRef}
            value={form.tema}
            onChange={(e) => setForm({ ...form, tema: e.target.value })}
            placeholder="Ex.: 100 doces tradicionais, tema unicórnio, entregar montado"
            maxLength={300}
          />
        </div>

        {/* Valor (M-039 · Decisão #22 — só exibição, sem somas/totais) */}
        <div className="campo">
          <label>Valor (R$) (opcional)</label>
          <input
            value={form.valor}
            onChange={(e) => setForm({ ...form, valor: e.target.value })}
            placeholder="Ex.: 120,00"
            inputMode="decimal"
          />
        </div>

        {/* Data de entrega (obrigatória na conversão de proposta) */}
        <div className="campo">
          <label>{conversao ? 'Data de entrega' : 'Data de entrega (opcional)'}</label>
          <input
            type="date"
            value={form.data_entrega}
            onChange={(e) => setForm({ ...form, data_entrega: e.target.value })}
          />
          {conversao && !form.data_entrega && (
            <div className="apoio" style={{ marginTop: 6 }}>
              Escolha a data de entrega — a validade da proposta não vale como entrega.
            </div>
          )}
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
              onClick={abrirFoto}
              disabled={processando}
            >
              <span className="origem-emoji"><Icone nome="imagem" size={30} /></span>
              {processando ? 'Processando…' : 'Adicionar foto'}
            </button>
          )}
          {previewUrl && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" className="btn-secundario" style={{ flex: 1 }} onClick={abrirFoto}>
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
                    <div className="bola" aria-hidden><Icone nome="link" size={18} /></div>
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
                    <Icone nome="fechar" />
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
                <span className="origem-emoji"><Icone nome="inspiracoes" size={30} /></span>
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
            <Icone nome="lixo" size={16} /> Excluir pedido
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
            disabled={salvando || processando || !form.nome.trim() || (conversao && !form.data_entrega)}
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
            <button className="painel-fechar" onClick={() => setPickerInsp(false)} aria-label="Fechar"><Icone nome="fechar" size={16} /></button>
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
                        <span className="insp-link-emoji" aria-hidden><Icone nome="link" size={30} /></span>
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

      {/* Sheet: inserir item da Tabela de preços (UX-002) — fica aberto p/ inserir vários */}
      {pickerTabela && (
        <div className="painel-overlay" onClick={() => setPickerTabela(false)}>
          <div className="painel" onClick={(e) => e.stopPropagation()}>
            <div className="painel-puxador" />
            <button className="painel-fechar" onClick={() => setPickerTabela(false)} aria-label="Fechar"><Icone nome="fechar" size={16} /></button>
            <div className="form-acervo-titulo">Inserir da Tabela de preços</div>
            {itensCardapio.length === 0 ? (
              <p className="apoio" style={{ marginTop: 8 }}>
                Sua Tabela de preços está vazia. Cadastre seus itens em Tabela de preços, na home.
              </p>
            ) : (
              <>
                <p className="apoio" style={{ marginBottom: 12 }}>
                  Toque para inserir no texto. Pode inserir vários.
                </p>
                {itensCardapio.map((i) => {
                  const preco =
                    i.preco_base != null
                      ? formatarReal(i.preco_base)
                      : i.preco_sob_consulta
                      ? 'sob consulta'
                      : null
                  const apoio = [preco, i.unidade ? `por ${i.unidade}` : '']
                    .filter(Boolean)
                    .join(' · ')
                  return (
                    <button
                      key={i.id}
                      type="button"
                      className="tabela-item"
                      onClick={() => inserirDaTabela(i)}
                    >
                      <div className="card-info">
                        <div className="card-nome">{i.nome}</div>
                        {apoio && <div className="apoio">{apoio}</div>}
                      </div>
                      <span className="mais" aria-hidden><Icone nome="mais" size={18} /></span>
                    </button>
                  )
                })}
              </>
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

      {limiteAberto && <LimiteModal onFechar={() => setLimiteAberto(false)} />}
    </div>
  )
}
