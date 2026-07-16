import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Confirmar } from '../components/Confirmar'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useClientes, type CamposCliente } from '../hooks/useClientes'
import { usePedidos, STATUS_INFO, type CamposPedido, type StatusPedido } from '../hooks/usePedidos'
import { usePropostas } from '../hooks/usePropostas'
import { useInspiracoes, dominioDe } from '../hooks/useInspiracoes'
import { usePedidoReferencias } from '../hooks/usePedidoReferencias'
import { usePedidoItens } from '../hooks/usePedidoItens'
import { LinhaItemEditavel, avisoItensForaTabela } from '../components/LinhaItemEditavel'
import { formatarReal, precoParaNumero } from '../hooks/useCardapio'

const ORDEM_STATUS: StatusPedido[] = ['a_fazer', 'em_producao', 'entregue', 'cancelado']

type DadosForm = {
  cliente_id: string | null
  nome: string
  tema: string
  valor: string // texto BR ("120,00"); vazio = sem valor
  data_entrega: string
  status: StatusPedido
  inspiracao_id: string | null
  link_inspiracao: string // M-040 · URL de inspiração da cliente (texto livre)
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
  const {
    carregando,
    salvando,
    buscarPorId,
    pedidoDaProposta,
    criar,
    atualizar,
    excluir,
  } = usePedidos(sessao?.user.id)
  const {
    carregando: carregandoPropostas,
    buscarPorId: buscarProposta,
    marcarResolvida,
  } = usePropostas(sessao?.user.id)
  // M-048 · na conversão, copia as referências da proposta para o pedido novo.
  // Sem pedido carregado aqui (o alvo é passado explícito em copiarDaProposta).
  const { copiarDaProposta } = usePedidoReferencias(sessao?.user.id, undefined)
  // M-044 · itens do pedido (só na edição — /pedidos/novo ainda não tem id).
  // Na conversão, os itens são copiados por copiarItensDaProposta (não por aqui).
  const {
    itens: itensPedido,
    atualizar: atualizarItemPedido,
    remover: removerItemPedido,
    copiarDaProposta: copiarItensDaProposta,
  } = usePedidoItens(sessao?.user.id, id)

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
    link_inspiracao: '',
  })
  const [pickerInsp, setPickerInsp] = useState(false)
  const [aExcluir, setAExcluir] = useState(false)
  // M-044 · o total foi tocado pela dona? (guia o pré-preenchimento pela soma dos
  // itens — só age enquanto o campo está vazio/não-tocado, sem sobrescrever).
  const [valorTocado, setValorTocado] = useState(false)
  // I4 · a captura/troca/remoção da foto de referência saiu do formulário: a
  // coluna `foto_referencia_path` é legado (só exibida, somente-leitura, no
  // detalhe). fotoPath preserva o valor já salvo na edição — não zera a coluna
  // ao salvar. M-048 · a conversão não copia mais a capa da proposta para essa
  // coluna: leva as referências de verdade (proposta_referencias → pedido).
  const [fotoPath, setFotoPath] = useState<string | null>(null) // referência já salva (legado)

  // Atalho "novo cliente" — formulário completo num sheet por cima do pedido
  const [novoClienteAberto, setNovoClienteAberto] = useState(false)
  const [novoCliente, setNovoCliente] = useState<CamposCliente>({ nome: '', whatsapp: '', nota: '' })

  const prefilled = useRef(false)
  const prefilledNovo = useRef(false)
  const prefilledProposta = useRef(false)

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
      link_inspiracao: pedido.link_inspiracao ?? '',
    })
    setValorTocado(pedido.valor != null) // já tem total salvo → não pré-preencher por cima
    // Preserva a referência legada (só p/ não zerar a coluna ao salvar a edição).
    setFotoPath(pedido.foto_referencia_path)
  }, [edicao, pedido])

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
    // M-048 · as referências vêm da coleção da proposta (proposta_referencias),
    // copiadas ao salvar — não a capa avulsa da proposta na coluna legado.
  }, [conversao, propostaId, carregando, carregandoPropostas, pedidoDaProposta, proposta, navegar])

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

  // M-044 · monta os campos do pedido a partir do form (reusado por salvar() e
  // por abrirPickerItens(), que persiste as edições antes de ir ao picker).
  // `foto_referencia_path` é coluna legado: preserva o já salvo, nunca cria novo.
  function montarCampos(): CamposPedido {
    return {
      cliente_id: form.cliente_id,
      nome: form.nome,
      tema: form.tema,
      valor: precoParaNumero(form.valor),
      data_entrega: form.data_entrega || null,
      status: form.status,
      foto_referencia_path: fotoPath,
      inspiracao_id: form.inspiracao_id,
      link_inspiracao: form.link_inspiracao,
    }
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
    const campos = montarCampos()

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
        // M-048 · leva a coleção de referências da proposta para o pedido novo.
        const erroRefs = await copiarDaProposta(res.id, propostaId)
        // M-044 · e leva os itens da proposta (nome/preço/unidade/qtd/ordem);
        // a partir daqui as listas são independentes.
        const erroItens = await copiarItensDaProposta(res.id, propostaId)
        // Auto-arquiva a proposta na aba ativa do Acompanhar (padrão M-037).
        await marcarResolvida(propostaId, true)
        avisar(
          erroRefs || erroItens
            ? 'Pedido criado, mas algo não veio junto (referências ou itens) — abra o pedido e confira.'
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

  // M-044 · soma dos itens (qtd × preço; item sem preço conta como 0). Base do
  // total no pedido: pré-preenche o campo Valor, mas nunca sobrescreve o que a
  // dona já digitou.
  const somaItens = itensPedido.reduce(
    (acc, it) => acc + (it.preco_snapshot ?? 0) * it.quantidade,
    0
  )
  useEffect(() => {
    if (!edicao || valorTocado || somaItens <= 0) return
    setForm((f) => ({ ...f, valor: somaItens.toFixed(2).replace('.', ',') }))
  }, [edicao, valorTocado, somaItens])

  // Marca o total como "tocado" ao digitar (trava o pré-preenchimento pela soma).
  function aoDigitarValor(v: string) {
    setForm((f) => ({ ...f, valor: v }))
    setValorTocado(true)
  }

  // M-044 · abre o picker de itens (só na edição). Persiste as edições atuais do
  // form ANTES de navegar — assim, ao voltar (que remonta e relê do banco), nada
  // do que a dona digitou se perde.
  async function abrirPickerItens() {
    if (!id) return
    if (!form.nome.trim()) {
      avisar('Dê um nome ao pedido antes de escolher itens.')
      return
    }
    const erro = await atualizar(id, montarCampos())
    if (erro) {
      avisar(erro)
      return
    }
    navegar(`/pedidos/${id}/itens`)
  }

  // Tira o item do pedido (não mexe no cardápio).
  async function aoRemoverItem(itemId: string) {
    const erro = await removerItemPedido(itemId)
    if (erro) avisar(erro)
  }

  // Edita qtd/preço/unidade do item SÓ neste pedido (não mexe no cardápio).
  async function aoAtualizarItem(
    itemId: string,
    patch: { quantidade?: number; preco_snapshot?: number | null; unidade_snapshot?: string | null }
  ) {
    const erro = await atualizarItemPedido(itemId, patch)
    if (erro) avisar(erro)
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

        {/* Detalhes do pedido (opcional, longo) — texto livre. Itens da tabela de
            preços vão na seção estruturada abaixo (M-044); aqui ficam só as notas
            e itens eventuais que não estão na tabela. */}
        <div className="campo">
          <label>Detalhes do pedido (opcional)</label>
          <textarea
            value={form.tema}
            onChange={(e) => setForm({ ...form, tema: e.target.value })}
            placeholder="Ex.: 100 doces tradicionais, tema unicórnio, entregar montado"
            maxLength={300}
          />
        </div>

        {/* M-044 · Itens da tabela de preços (opcional) — só na edição, porque o
            picker grava em pedido_itens e precisa de um pedido já salvo. */}
        <div className="campo">
          <label>Itens da tabela de preços (opcional)</label>
          {!edicao ? (
            <p className="apoio" style={{ marginTop: 2 }}>
              Salve o pedido para escolher itens da sua tabela de preços.
            </p>
          ) : (
            <>
              {itensPedido.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  {itensPedido.map((it) => (
                    <LinhaItemEditavel
                      key={it.id}
                      item={it}
                      onAtualizar={(patch) => aoAtualizarItem(it.id, patch)}
                      onRemover={() => aoRemoverItem(it.id)}
                      desabilitado={salvando}
                    />
                  ))}
                </div>
              )}
              <button
                type="button"
                className="btn-secundario"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={abrirPickerItens}
                disabled={salvando}
              >
                <Icone nome="precos" size={16} />{' '}
                {itensPedido.length > 0 ? 'Adicionar mais itens' : 'Selecionar itens'}
              </button>
            </>
          )}
        </div>

        {/* Valor total (M-044 · reusa pedidos.valor; a soma dos itens pré-preenche
            mas nunca sobrescreve o que a dona digitou). */}
        <div className="campo">
          <label>Valor total (R$) (opcional)</label>
          <input
            value={form.valor}
            onChange={(e) => aoDigitarValor(e.target.value)}
            placeholder="Ex.: 120,00"
            inputMode="decimal"
          />
          {somaItens > 0 && (
            <div className="apoio" style={{ marginTop: 6 }}>
              Soma dos itens: <b>{formatarReal(somaItens)}</b>
            </div>
          )}
          {edicao && itensPedido.length > 0 && (
            <p className="aviso-itens" style={{ marginTop: 8, marginBottom: 0 }}>
              {avisoItensForaTabela('pedido')}
            </p>
          )}
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

        {/* Link de inspiração da cliente (M-040) — texto livre, abre no navegador */}
        <div className="campo">
          <label>Link de inspiração da cliente (opcional)</label>
          <input
            value={form.link_inspiracao}
            onChange={(e) => setForm({ ...form, link_inspiracao: e.target.value })}
            placeholder="Cole o link que a cliente mandou (Pinterest, Instagram…)"
            inputMode="url"
            autoCapitalize="none"
          />
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
            disabled={salvando || !form.nome.trim() || (conversao && !form.data_entrega)}
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
