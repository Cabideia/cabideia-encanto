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
import { usePedidoItens, type NovoItemPedido } from '../hooks/usePedidoItens'
import { usePropostaItens } from '../hooks/usePropostaItens'
import { LinhaItemEditavel, avisoItensForaTabela, type PatchItemEditavel } from '../components/LinhaItemEditavel'
import { useCardapio, formatarReal, precoParaNumero } from '../hooks/useCardapio'

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
 * M-044 (regra de 17/07) · item lançado em /pedidos/novo ANTES de o pedido
 * existir: vive no estado local do form (com snapshot já congelado) e só vira
 * linha de `pedido_itens` ao salvar. `chave` identifica a linha na lista local
 * (o id do cardápio quando há, ou o id do item da proposta na conversão).
 */
type ItemLocal = NovoItemPedido & { chave: string; quantidade: number }

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
  // M-044 · itens do pedido: na edição vêm do banco (pedido_itens); na criação
  // vivem no estado local (itensLocais) e são persistidos por `adicionar` ao
  // salvar (regra de 17/07 — sem exigir salvar antes de lançar itens).
  const {
    itens: itensPedido,
    adicionar: adicionarItensPedido,
    atualizar: atualizarItemPedido,
    remover: removerItemPedido,
  } = usePedidoItens(sessao?.user.id, id)

  // M-039 · modo conversão (?proposta=<id>) — só na criação.
  const propostaId = !edicao ? searchParams.get('proposta') : null
  const conversao = !!propostaId
  const proposta = propostaId ? buscarProposta(propostaId) : undefined
  // Na conversão, os itens da proposta entram no bloco local (editáveis antes de
  // salvar); fora dela o hook fica ocioso (proposta indefinida → lista vazia).
  const { itens: itensProposta, carregando: carregandoItensProposta } = usePropostaItens(
    sessao?.user.id,
    propostaId ?? undefined
  )
  // Cardápio para o picker local da criação (na edição o picker é a rota filha).
  const {
    itens: cardapio,
    criar: criarItemCardapio,
    salvando: salvandoCardapio,
  } = useCardapio(sessao?.user.id)

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
  // M-044 (regra de 17/07) · itens lançados na criação, antes de o pedido existir.
  const [itensLocais, setItensLocais] = useState<ItemLocal[]>([])
  const [pickerItens, setPickerItens] = useState(false)
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  // Criar um item do cardápio sem sair do picker (mesmo atalho de PedidoItens).
  const [criandoItem, setCriandoItem] = useState(false)
  const [novoNomeItem, setNovoNomeItem] = useState('')
  const [novoPrecoItem, setNovoPrecoItem] = useState('')
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
    if (carregando || carregandoPropostas || carregandoItensProposta) return
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
    // O total da proposta pode ter sido ajustado à mão acima da soma dos itens —
    // vindo preenchido, a soma não sobrescreve (mesma regra da edição).
    setValorTocado(proposta.valor != null)
    // M-044 (regra de 17/07) · os itens da proposta entram no bloco local,
    // editáveis antes de salvar; viram linhas de pedido_itens ao criar o pedido
    // (Decisão #45 — snapshot copiado; listas independentes daí em diante).
    setItensLocais(
      itensProposta.map((it) => ({
        chave: it.id,
        cardapio_item_id: it.cardapio_item_id,
        nome_snapshot: it.nome_snapshot,
        preco_snapshot: it.preco_snapshot,
        unidade_snapshot: it.unidade_snapshot,
        quantidade: it.quantidade,
      }))
    )
    // M-048 · as referências vêm da coleção da proposta (proposta_referencias),
    // copiadas ao salvar — não a capa avulsa da proposta na coluna legado.
  }, [conversao, propostaId, carregando, carregandoPropostas, carregandoItensProposta, itensProposta, pedidoDaProposta, proposta, navegar])

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
      // M-044 (regra de 17/07) · persiste os itens lançados no form — tanto os
      // escolhidos na criação quanto os herdados (e editados) da conversão.
      const erroItens =
        itensLocais.length > 0
          ? await adicionarItensPedido(
              res.id,
              itensLocais.map((it) => ({
                cardapio_item_id: it.cardapio_item_id,
                nome_snapshot: it.nome_snapshot,
                preco_snapshot: it.preco_snapshot,
                unidade_snapshot: it.unidade_snapshot,
                quantidade: it.quantidade,
              }))
            )
          : null
      if (conversao && propostaId) {
        // M-048 · leva a coleção de referências da proposta para o pedido novo.
        const erroRefs = await copiarDaProposta(res.id, propostaId)
        // Auto-arquiva a proposta na aba ativa do Acompanhar (padrão M-037).
        await marcarResolvida(propostaId, true)
        avisar(
          erroRefs || erroItens
            ? 'Pedido criado, mas algo não veio junto (referências ou itens) — abra o pedido e confira.'
            : 'Proposta virou pedido ✓'
        )
      } else {
        avisar(
          erroItens
            ? 'Pedido salvo, mas os itens não entraram — abra o pedido e confira.'
            : 'Pedido salvo ✓'
        )
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
  // dona já digitou. Na criação a lista é a local; na edição, a do banco.
  const itensDoForm = edicao ? itensPedido : itensLocais
  const somaItens = itensDoForm.reduce(
    (acc, it) => acc + (it.preco_snapshot ?? 0) * it.quantidade,
    0
  )
  useEffect(() => {
    if (valorTocado || somaItens <= 0) return
    setForm((f) => ({ ...f, valor: somaItens.toFixed(2).replace('.', ',') }))
  }, [valorTocado, somaItens])

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

  // ── M-044 (regra de 17/07) · itens locais da criação ──
  // Edita/tira SÓ na lista local; nada vai ao banco antes de "Criar pedido".
  function aoAtualizarItemLocal(chave: string, patch: PatchItemEditavel) {
    setItensLocais((prev) => prev.map((it) => (it.chave === chave ? { ...it, ...patch } : it)))
  }
  function aoRemoverItemLocal(chave: string) {
    setItensLocais((prev) => prev.filter((it) => it.chave !== chave))
  }

  // Itens do cardápio ainda fora da lista local (o picker só mostra esses).
  const disponiveis = cardapio.filter(
    (c) => !itensLocais.some((it) => it.cardapio_item_id === c.id)
  )

  function abrirPickerItensLocal() {
    setMarcados(new Set())
    setCriandoItem(false)
    setPickerItens(true)
  }

  function alternarMarcado(itemId: string) {
    setMarcados((prev) => {
      const n = new Set(prev)
      if (n.has(itemId)) n.delete(itemId)
      else n.add(itemId)
      return n
    })
  }

  // Congela o snapshot AGORA (nome/preço/unidade do cardápio) na lista local.
  function adicionarMarcados() {
    if (marcados.size === 0) {
      avisar('Escolha ao menos um item.')
      return
    }
    const novos: ItemLocal[] = disponiveis
      .filter((c) => marcados.has(c.id))
      .map((c) => ({
        chave: c.id,
        cardapio_item_id: c.id,
        nome_snapshot: c.nome,
        preco_snapshot: c.preco_base,
        unidade_snapshot: c.unidade ?? null,
        quantidade: 1,
      }))
    setItensLocais((prev) => [...prev, ...novos])
    setPickerItens(false)
  }

  // Cria um item do cardápio sem sair do picker (reusa o CRUD de cardapio_itens;
  // mesmo atalho de PedidoItens). O item já entra marcado.
  async function criarItemNoPicker() {
    const nome = novoNomeItem.trim()
    if (!nome) {
      avisar('Dê um nome ao item.')
      return
    }
    const res = await criarItemCardapio({
      nome,
      preco_base: novoPrecoItem,
      unidade: '',
      detalhes: '',
      na_vitrine: false,
      preco_sob_consulta: false,
    })
    if ('erro' in res) {
      avisar(res.erro)
      return
    }
    setMarcados((prev) => new Set(prev).add(res.item.id))
    setNovoNomeItem('')
    setNovoPrecoItem('')
    setCriandoItem(false)
    avisar('Item criado na tabela de preços ✓')
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

        {/* M-044 · Itens da tabela de preços (opcional). Na criação (regra de
            17/07) os itens ficam no estado local — escolhidos num picker em sheet
            (sem sair do form) e persistidos ao "Criar pedido". Na edição, o
            picker segue sendo a rota filha, gravando direto em pedido_itens. */}
        <div className="campo">
          <label>Itens da tabela de preços (opcional)</label>
          {!edicao ? (
            <>
              {itensLocais.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  {itensLocais.map((it) => (
                    <LinhaItemEditavel
                      key={it.chave}
                      item={it}
                      onAtualizar={(patch) => aoAtualizarItemLocal(it.chave, patch)}
                      onRemover={() => aoRemoverItemLocal(it.chave)}
                      desabilitado={salvando}
                    />
                  ))}
                </div>
              )}
              <button
                type="button"
                className="btn-secundario"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={abrirPickerItensLocal}
                disabled={salvando}
              >
                <Icone nome="precos" size={16} />{' '}
                {itensLocais.length > 0 ? 'Adicionar mais itens' : 'Selecionar itens'}
              </button>
            </>
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
          {itensDoForm.length > 0 && (
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
            disabled={
              salvando ||
              !form.nome.trim() ||
              (conversao && !form.data_entrega) ||
              // Conversão: espera o pré-preenchimento (inclusive dos itens) para
              // não criar o pedido sem o que veio da proposta.
              (conversao && (carregando || carregandoPropostas || carregandoItensProposta))
            }
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

      {/* Sheet: escolher itens da tabela de preços (só na criação — M-044,
          regra de 17/07). Tudo acontece por cima do form, sem navegar, para o
          rascunho do pedido não se perder. Espelha a tela PedidoItens. */}
      {pickerItens && (
        <div className="painel-overlay" onClick={() => setPickerItens(false)}>
          <div className="painel" onClick={(e) => e.stopPropagation()}>
            <div className="painel-puxador" />
            <button className="painel-fechar" onClick={() => setPickerItens(false)} aria-label="Fechar"><Icone nome="fechar" size={16} /></button>
            <div className="form-acervo-titulo">Escolher itens</div>

            {/* Criar item do cardápio sem sair (mesmo atalho de PedidoItens). */}
            {criandoItem ? (
              <div
                className="campo"
                style={{
                  border: '1px solid var(--linha)',
                  borderRadius: 12,
                  padding: 12,
                  marginTop: 8,
                  marginBottom: 12,
                  background: 'var(--acucar)',
                }}
              >
                <label>Novo item da tabela de preços</label>
                <input
                  value={novoNomeItem}
                  onChange={(e) => setNovoNomeItem(e.target.value)}
                  placeholder="Ex.: Brigadeiro"
                  maxLength={80}
                  autoFocus
                />
                <input
                  value={novoPrecoItem}
                  onChange={(e) => setNovoPrecoItem(e.target.value)}
                  placeholder="Preço (ex.: 3,50) — opcional"
                  inputMode="decimal"
                  style={{ marginTop: 8 }}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn-secundario"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setCriandoItem(false)
                      setNovoNomeItem('')
                      setNovoPrecoItem('')
                    }}
                    disabled={salvandoCardapio}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="cta"
                    style={{ flex: 1 }}
                    onClick={criarItemNoPicker}
                    disabled={salvandoCardapio || !novoNomeItem.trim()}
                  >
                    {salvandoCardapio ? 'Criando…' : 'Criar item'}
                  </button>
                </div>
                <p className="apoio" style={{ marginTop: 8, marginBottom: 0 }}>
                  O item fica salvo na sua Tabela de preços e já entra neste pedido.
                </p>
              </div>
            ) : (
              <button
                type="button"
                className="btn-secundario"
                style={{ width: '100%', justifyContent: 'center', marginTop: 8, marginBottom: 12 }}
                onClick={() => setCriandoItem(true)}
              >
                <Icone nome="mais" size={16} /> Criar item da tabela de preços
              </button>
            )}

            {cardapio.length === 0 ? (
              <div className="vazio" style={{ marginTop: 8 }}>
                <div className="icone"><Icone nome="precos" size={44} /></div>
                <p>Você ainda não tem itens na Tabela de preços. Crie um aqui em cima.</p>
              </div>
            ) : disponiveis.length === 0 ? (
              <div className="vazio" style={{ marginTop: 8 }}>
                <div className="icone"><Icone nome="ok" size={44} /></div>
                <p>Todos os itens da sua tabela de preços já estão neste pedido.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <p className="apoio" style={{ margin: 0 }}>
                    Toque para escolher. O preço é congelado agora.
                  </p>
                  <button
                    type="button"
                    className="tag-criar"
                    onClick={() => setMarcados(new Set(disponiveis.map((c) => c.id)))}
                  >
                    Trazer todos
                  </button>
                </div>

                <div className="lista">
                  {disponiveis.map((c) => {
                    const marcado = marcados.has(c.id)
                    const preco =
                      c.preco_base != null
                        ? formatarReal(c.preco_base)
                        : c.preco_sob_consulta
                        ? 'sob consulta'
                        : 'sem preço'
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`linha-selecao${marcado ? ' marcado' : ''}`}
                        onClick={() => alternarMarcado(c.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          width: '100%',
                          textAlign: 'left',
                          padding: '12px 14px',
                          border: `1px solid ${marcado ? 'var(--framboesa)' : 'var(--linha)'}`,
                          borderRadius: 12,
                          background: marcado ? 'var(--framboesa-suave)' : 'var(--acucar)',
                          color: 'var(--cacau)',
                          marginBottom: 8,
                          cursor: 'pointer',
                        }}
                      >
                        <span
                          className={`sel-check${marcado ? ' on' : ''}`}
                          aria-hidden
                          style={{ position: 'static', flexShrink: 0 }}
                        >
                          {marcado ? <Icone nome="ok" size={15} strokeWidth={3} /> : null}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 700, display: 'block' }}>{c.nome}</span>
                          {c.unidade && (
                            <span className="apoio" style={{ display: 'block' }}>por {c.unidade}</span>
                          )}
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--framboesa)', flexShrink: 0 }}>{preco}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button
                type="button"
                className="btn-secundario"
                style={{ flex: 1 }}
                onClick={() => setPickerItens(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="cta"
                style={{ flex: 2, height: 48 }}
                onClick={adicionarMarcados}
                disabled={marcados.size === 0}
              >
                {`Adicionar ${marcados.size || ''}`.trim()}
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
