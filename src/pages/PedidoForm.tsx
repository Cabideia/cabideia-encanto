import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { TelaCarregando } from '../components/TelaCarregando'
import { Confirmar } from '../components/Confirmar'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useClientes, type CamposCliente } from '../hooks/useClientes'
import { usePedidos, STATUS_INFO, type CamposPedido, type StatusPedido } from '../hooks/usePedidos'
import { usePropostas } from '../hooks/usePropostas'
import { usePedidoReferencias } from '../hooks/usePedidoReferencias'
import { usePedidoItens, type NovoItemPedido } from '../hooks/usePedidoItens'
import { useAcervo } from '../hooks/useAcervo'
import { useInspiracoes } from '../hooks/useInspiracoes'
import { useGuardaSaida } from '../hooks/useGuardaSaida'
import { GradeReferencias, resolverReferencias, type RefVisual } from '../components/GradeReferencias'
import { LinhaItemEditavel, avisoItensForaTabela, type PatchItemEditavel } from '../components/LinhaItemEditavel'
import { ContadorTextoLongo } from '../components/ContadorTextoLongo'
import { useCardapio, formatarReal, precoParaNumero, unidadesParaChips } from '../hooks/useCardapio'
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
 * R2b (Decisões #60/#61) · Rascunhos de CONVERSÃO criados nesta sessão de
 * navegação: pedidos que nasceram ao abrir "Virar pedido" e ainda não foram
 * confirmados pelo Salvar. Sair sem salvar DESCARTA o rascunho (escolha da
 * Josiane na espec da R2b) — a proposta volta a ficar como estava. O Set zera
 * num reload; aí a limpeza de unmount fica inerte, mas o descarte explícito
 * (voltar/Cancelar → confirmação) continua funcionando pelo id da URL.
 */
const rascunhosConversao = new Set<string>()
/** Conversões com rascunho EM CRIAÇÃO — dedupe do efeito (StrictMode/remount). */
const conversoesEmCriacao = new Set<string>()
/**
 * Descartes AGENDADOS no unmount (id do pedido → timer). O descarte espera um
 * instante antes de executar: um remonte imediato da mesma tela (StrictMode em
 * dev; voltar rápido pelo histórico) CANCELA o timer — sem isso, o ciclo
 * mount→cleanup→mount do StrictMode apagaria o rascunho debaixo da usuária.
 */
const descartesAgendados = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * M-002 · Formulário de pedido (cria em /pedidos/novo, edita em /pedidos/:id/editar).
 * M-039/R2b · Conversão proposta → pedido: /pedidos/novo?proposta=<id> agora cria
 * um PEDIDO-RASCUNHO imediato com os itens e as referências da proposta copiados
 * DIRETO NO BANCO (verdade do servidor — mata o BUG-014) e segue para
 * /pedidos/:id/editar?proposta=<id>, onde tudo fica visível e editável ANTES de
 * salvar (UX-024). `proposta_id` e o marcar-resolvida só acontecem no Salvar —
 * assim a proposta não trava (M-053) nem "vira pedido" por um rascunho abandonado.
 */
export function PedidoForm() {
  const { id } = useParams()
  const edicao = !!id
  const [searchParams] = useSearchParams()
  const navegar = useNavigate()
  const { sessao } = useSessao()
  const avisar = useAviso()

  const { clientes, criar: criarCliente, salvando: salvandoCliente } = useClientes(sessao?.user.id)
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
  // R2b (UX-024) · referências do pedido, visíveis e editáveis no form da
  // edição (inclui o rascunho de conversão). Na conversão o alvo da cópia é
  // passado explícito em copiarDaProposta (referências) e no espelho dos itens.
  const {
    referencias,
    remover: removerReferencia,
    copiarDaProposta: copiarRefsDaProposta,
  } = usePedidoReferencias(sessao?.user.id, id)
  // M-044 · itens do pedido: na edição vêm do banco (pedido_itens); na criação
  // do zero vivem no estado local (itensLocais) e são persistidos ao salvar.
  // R2b · na conversão os itens são copiados DIRETO no banco (copiarDaProposta).
  const {
    itens: itensPedido,
    adicionar: adicionarItensPedido,
    atualizar: atualizarItemPedido,
    remover: removerItemPedido,
    copiarDaProposta: copiarItensDaProposta,
  } = usePedidoItens(sessao?.user.id, id)
  // R2b · acervos para resolver as miniaturas das referências no form.
  const { trabalhos } = useAcervo(sessao?.user.id)
  const { inspiracoes } = useInspiracoes(sessao?.user.id)

  // M-039/R2b · conversão (?proposta=<id>): em /pedidos/novo dispara a criação
  // do rascunho; em /pedidos/:id/editar marca o modo "Virar pedido" (rascunho).
  const propostaId = searchParams.get('proposta')
  const conversaoNova = !edicao && !!propostaId
  const conversao = edicao && !!propostaId
  const proposta = propostaId ? buscarProposta(propostaId) : undefined
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
  const [aExcluir, setAExcluir] = useState(false)
  // R2b · re-dispara o efeito de conversão quando outra montagem estava criando.
  const [tickConversao, setTickConversao] = useState(0)
  // R2b · confirmação do descarte do rascunho de conversão (voltar/Cancelar).
  const [confirmarDescarte, setConfirmarDescarte] = useState(false)
  // UX-033 · aviso "sair sem salvar" fora da conversao (paridade c/ PropostaForm).
  const [confirmarSaida, setConfirmarSaida] = useState(false)
  // UX-026 · confirmar antes de tirar uma referência (desvincula, não exclui).
  const [refARemover, setRefARemover] = useState<RefVisual | null>(null)
  // M-044 (regra de 17/07) · itens lançados na criação, antes de o pedido existir.
  const [itensLocais, setItensLocais] = useState<ItemLocal[]>([])
  const [pickerItens, setPickerItens] = useState(false)
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  // Criar um item do cardápio sem sair do picker (mesmo atalho de PedidoItens).
  const [criandoItem, setCriandoItem] = useState(false)
  const [novoNomeItem, setNovoNomeItem] = useState('')
  const [novoPrecoItem, setNovoPrecoItem] = useState('')
  // M-052 · unidade é obrigatória (useCardapio.criar() recusa sem ela) — este
  // atalho não tinha o campo e ficava sempre recusado.
  const [novoUnidadeItem, setNovoUnidadeItem] = useState('')
  const chipsUnidadeItem = unidadesParaChips(cardapio)
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
  // Data que veio pronta do calendario (?data=): nao conta como alteracao.
  const dataInicial = useRef<string | null>(null)

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
    dataInicial.current = data // UX-033 · pre-preenchida != digitada pela dona
    setForm((f) => ({ ...f, data_entrega: data }))
  }, [edicao, searchParams])

  // R2b (BUG-014/UX-024) · Conversão: cria o PEDIDO-RASCUNHO no banco assim que
  // a proposta carrega, copia itens + referências DIRETO de proposta_itens /
  // proposta_referencias (verdade do servidor — nunca estado local, que é onde o
  // BUG-014 perdia dado em silêncio) e segue para a edição do rascunho. A data
  // de entrega fica VAZIA de propósito (validade da proposta ≠ data de entrega).
  // `proposta_id` NÃO é gravado aqui — só o Salvar consolida a conversão.
  useEffect(() => {
    if (!conversaoNova || !propostaId || prefilledProposta.current) return
    if (carregando || carregandoPropostas) return
    // Se a proposta já virou pedido (salvo de verdade), nunca duplica.
    const existente = pedidoDaProposta(propostaId)
    if (existente) {
      prefilledProposta.current = true
      navegar(`/pedidos/${existente.id}`, { replace: true })
      return
    }
    if (!proposta) {
      // id inválido → segue como pedido novo em branco.
      prefilledProposta.current = true
      navegar('/pedidos/novo', { replace: true })
      return
    }
    if (conversoesEmCriacao.has(propostaId)) {
      // Outra montagem ainda está criando (ex.: voltou e reabriu com rede
      // lenta). O Set não é reativo — re-tenta num instante em vez de ficar
      // preso em "Trazendo…" para sempre.
      const t = setTimeout(() => setTickConversao((n) => n + 1), 400)
      return () => clearTimeout(t)
    }
    prefilledProposta.current = true
    conversoesEmCriacao.add(propostaId)
    ;(async () => {
      try {
        const res = await criar({
          cliente_id: proposta.cliente_id,
          nome: (proposta.titulo ?? '').trim() || 'Novo pedido',
          tema: proposta.descricao ?? '',
          valor: proposta.valor,
          data_entrega: null,
          status: 'a_fazer',
          foto_referencia_path: null,
          inspiracao_id: null,
          // proposta_id fica DE FORA de propósito (só o Salvar grava — senão a
          // proposta travaria pelo M-053 e o botão viraria "Ver pedido" por um
          // rascunho que pode ser descartado).
        })
        if ('erro' in res) {
          avisar(res.erro)
          navegar(-1)
          return
        }
        // Se a dona voltou enquanto o rascunho nascia (rede lenta), não deixa
        // órfão: apaga o que acabou de ser criado e para por aqui.
        if (!montado.current) {
          void supabase.from('pedidos').delete().eq('id', res.id).then(() => {})
          return
        }
        const erroItens = await copiarItensDaProposta(res.id, propostaId)
        const erroRefs = await copiarRefsDaProposta(res.id, propostaId)
        if (!montado.current) {
          void supabase.from('pedidos').delete().eq('id', res.id).then(() => {})
          return
        }
        if (erroItens || erroRefs)
          avisar('Parte do que estava na proposta não veio — confira itens e fotos antes de salvar.')
        rascunhosConversao.add(res.id)
        navegar(`/pedidos/${res.id}/editar?proposta=${propostaId}`, { replace: true })
      } finally {
        conversoesEmCriacao.delete(propostaId)
      }
    })()
  }, [conversaoNova, propostaId, carregando, carregandoPropostas, pedidoDaProposta, proposta, navegar, avisar, tickConversao]) // eslint-disable-line react-hooks/exhaustive-deps

  // R2b · Descarta o rascunho de conversão se a tela for desmontada sem salvar
  // e sem estar indo a um filho (picker/origem de referência). Cobre a saída
  // pela barra inferior e atalhos — o CASCADE limpa itens e referências juntos.
  // O descarte é AGENDADO (timer): um remonte imediato cancela (StrictMode /
  // volta rápida); só o timer mexe no Set e no banco. O `.then` é obrigatório —
  // o builder do supabase-js é preguiçoso e sem ele o delete nunca dispara.
  const idRef = useRef<string | undefined>(id)
  const saindoParaFilho = useRef(false)
  const montado = useRef(true)
  // O cleanup só pode agendar descarte quando o unmount é da TELA DE CONVERSÃO
  // — um rascunho que ficou no Set (saída pela barra inferior via filho) e foi
  // reaberto depois pela EDIÇÃO NORMAL é decisão da dona de mantê-lo; sem esta
  // checagem, o salvar da edição normal seria apagado 800ms depois (achado da
  // verificação adversarial).
  const conversaoRef = useRef(false)
  idRef.current = id
  conversaoRef.current = conversao
  useEffect(() => {
    montado.current = true
    const rid = idRef.current
    if (rid) {
      const timer = descartesAgendados.get(rid)
      if (timer) {
        clearTimeout(timer) // remontou a tempo: o rascunho continua vivo
        descartesAgendados.delete(rid)
      }
    }
    return () => {
      montado.current = false
      const rid2 = idRef.current
      if (rid2 && conversaoRef.current && rascunhosConversao.has(rid2) && !saindoParaFilho.current) {
        const timer = setTimeout(() => {
          descartesAgendados.delete(rid2)
          rascunhosConversao.delete(rid2)
          void supabase.from('pedidos').delete().eq('id', rid2).then(() => {})
        }, 800)
        descartesAgendados.set(rid2, timer)
      }
    }
  }, [])

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

  /**
   * UX-033 (D1/P0) · Há conteúdo NÃO salvo? Espelha o `haAlteracoes` do
   * PropostaForm — era a paridade que faltava entre os dois formulários.
   * Itens e referências são gravados ao vivo (não entram aqui); o que depende
   * do "Salvar" são os campos do form. Na criação pura, qualquer conteúdo
   * digitado conta; na edição, comparamos com o que está salvo.
   */
  function haAlteracoes(): boolean {
    const nomeN = form.nome.trim() || null
    const temaN = form.tema.trim() || null
    const valorN = precoParaNumero(form.valor)
    const dataN = form.data_entrega || null
    if (!edicao) {
      // Criação pura: sem registro salvo, qualquer coisa digitada é "não salvo"
      // (os itens locais também — eles só viram linhas ao criar o pedido).
      const dataDigitada = !!dataN && dataN !== dataInicial.current
      return !!nomeN || !!temaN || valorN != null || dataDigitada || itensLocais.length > 0
    }
    if (!pedido) return false
    return (
      nomeN !== (pedido.nome ?? null) ||
      temaN !== (pedido.tema ?? null) ||
      valorN !== (pedido.valor ?? null) ||
      dataN !== (pedido.data_entrega ?? null) ||
      form.status !== pedido.status ||
      form.cliente_id !== pedido.cliente_id
    )
  }

  // Guarda de saída. R2b · no rascunho de CONVERSÃO, sair = descartar, então
  // pergunta sempre. UX-033 · fora da conversão (criação e edição normais) a
  // guarda agora também existe, mas só interrompe quando há algo não salvo —
  // mesma regra e mesmo texto do PropostaForm.
  const { tentarSair, sair, navegarLimpo } = useGuardaSaida({
    ativo: conversao ? !!pedido : !edicao || !!pedido,
    temAlteracoes: () => (conversao ? true : haAlteracoes()),
    aoPedirConfirmacao: () => (conversao ? setConfirmarDescarte(true) : setConfirmarSaida(true)),
  })

  // R2b · descarte confirmado: apaga o rascunho (CASCADE limpa itens e
  // referências) e a proposta segue como estava — nada foi consolidado.
  async function descartarConversao() {
    if (!id) return
    saindoParaFilho.current = true // já estamos apagando; o unmount não repete
    rascunhosConversao.delete(id)
    const erro = await excluir(id)
    if (erro) {
      saindoParaFilho.current = false
      rascunhosConversao.add(id)
      avisar(erro)
      setConfirmarDescarte(false)
      return
    }
    setConfirmarDescarte(false)
    avisar('Tudo bem — a proposta continua como estava.')
    sair()
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
      // R2b · o Salvar é o que CONSOLIDA a conversão: grava proposta_id e marca
      // a proposta como resolvida (auto-arquiva no padrão M-037). Antes disso o
      // rascunho não aponta para a proposta — descartável sem rastro.
      if (conversao && propostaId) campos.proposta_id = propostaId
      const erro = await atualizar(id, campos)
      if (erro) {
        avisar(erro)
        return
      }
      if (conversao && propostaId) {
        await marcarResolvida(propostaId, true)
        rascunhosConversao.delete(id)
        saindoParaFilho.current = true
        avisar('Proposta virou pedido ✓')
        navegarLimpo(() => navegar(`/pedidos/${id}`, { replace: true }))
      } else {
        // Se este pedido um dia foi rascunho de conversão que sobrou no Set
        // (saída pela barra inferior), o salvar explícito o adota de vez.
        rascunhosConversao.delete(id)
        saindoParaFilho.current = true // UX-033 · salvou: a guarda não deve barrar
        avisar('Pedido atualizado ✓')
        navegarLimpo(() => navegar(`/pedidos/${id}`, { replace: true }))
      }
    } else {
      const res = await criar(campos)
      if ('erro' in res) {
        avisar(res.erro)
        return
      }
      // M-044 (regra de 17/07) · persiste os itens lançados no form da criação.
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
      saindoParaFilho.current = true // UX-033 · salvou: a guarda não deve barrar
      avisar(
        erroItens
          ? 'Pedido salvo, mas os itens não entraram — abra o pedido e confira.'
          : 'Pedido salvo ✓'
      )
      navegarLimpo(() => navegar(`/pedidos/${res.id}`, { replace: true }))
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
    saindoParaFilho.current = true
    avisar('Pedido excluído')
    navegarLimpo(() => navegar('/pedidos', { replace: true }))
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
  // do que a dona digitou se perde. R2b · no rascunho de conversão marca a ida
  // ao filho (não descartar) e navega limpando a sentinela da guarda.
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
    irParaFilho(`/pedidos/${id}/itens`)
  }

  // R2b · navegação interna a partir do form: no rascunho de conversão precisa
  // (a) impedir o descarte do unmount e (b) sair pela guarda (navegarLimpo).
  function irParaFilho(rota: string) {
    if (conversao) {
      saindoParaFilho.current = true
      navegarLimpo(() => navegar(rota))
    } else {
      navegar(rota)
    }
  }

  // R2b (UX-024) · abre o picker de referências na edição (inclui conversão),
  // persistindo o form antes — espelho de abrirPickerItens.
  async function abrirPickerReferencias() {
    if (!id) return
    if (!form.nome.trim()) {
      avisar('Dê um nome ao pedido antes de escolher as fotos.')
      return
    }
    const erro = await atualizar(id, montarCampos())
    if (erro) {
      avisar(erro)
      return
    }
    irParaFilho(`/pedidos/${id}/referencias`)
  }

  // R2b (UX-024) · referências na CRIAÇÃO do zero: salva o pedido agora (com os
  // itens locais já lançados) e abre o picker — mesmo espírito do rascunho
  // automático da proposta (Decisão #29/#61). O pedido tem nome dado pela dona,
  // então é trabalho real: fica salvo mesmo se ela voltar sem terminar.
  async function abrirReferenciasCriacao() {
    if (!form.nome.trim()) {
      avisar('Dê um nome ao pedido antes de escolher as fotos.')
      return
    }
    const res = await criar(montarCampos())
    if ('erro' in res) {
      avisar(res.erro)
      return
    }
    if (itensLocais.length > 0) {
      const erroItens = await adicionarItensPedido(
        res.id,
        itensLocais.map((it) => ({
          cardapio_item_id: it.cardapio_item_id,
          nome_snapshot: it.nome_snapshot,
          preco_snapshot: it.preco_snapshot,
          unidade_snapshot: it.unidade_snapshot,
          quantidade: it.quantidade,
        }))
      )
      if (erroItens) avisar(erroItens)
    }
    saindoParaFilho.current = true
    avisar('Pedido salvo ✓')
    navegarLimpo(() => {
      navegar(`/pedidos/${res.id}/editar`, { replace: true })
      navegar(`/pedidos/${res.id}/referencias`)
    })
  }

  // R2b · modelos visuais das referências (miniatura + selo + destino).
  const refsVisuais = resolverReferencias(referencias, trabalhos, inspiracoes)

  // Toque numa referência: foto abre a origem no app; link puro abre no
  // navegador. PERSISTE o form antes de sair (mesma regra dos pickers — sem
  // isso a data de entrega escolhida na conversão se perderia ao voltar) e sai
  // por irParaFilho, que na conversão marca o filho e limpa a sentinela.
  async function aoTocarReferencia(rv: RefVisual) {
    if (!rv.url && rv.linkExterno) {
      window.open(rv.linkExterno, '_blank', 'noopener')
      return
    }
    if (id) {
      const erro = await atualizar(id, montarCampos())
      if (erro) {
        avisar(erro)
        return
      }
    }
    irParaFilho(rv.rotaOrigem)
  }

  // UX-026 · tirar referência = desvincular (a foto continua no acervo dela).
  async function aoRemoverReferencia(refId: string) {
    const erro = await removerReferencia(refId)
    if (erro) avisar(erro)
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
    if (!novoUnidadeItem.trim()) {
      avisar('Escolha uma unidade (ex.: unidade, kg, cento…).')
      return
    }
    const res = await criarItemCardapio({
      nome,
      preco_base: novoPrecoItem,
      unidade: novoUnidadeItem,
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
    setNovoUnidadeItem('')
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

  // R2b · conversão recém-aberta: o rascunho está sendo criado no banco.
  if (conversaoNova) {
    return (
      <div className="tela">
        <BarraTopo titulo="Virar pedido" />
        <div className="conteudo">
          <p className="apoio" style={{ textAlign: 'center', marginTop: 28 }}>
            Trazendo o que estava na proposta…
          </p>
        </div>
      </div>
    )
  }

  // No modo edição, espera o pedido carregar.
  if (edicao && carregando) return <TelaCarregando titulo="Pedido" variante="formulario" />
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
      <BarraTopo
        titulo={conversao ? 'Virar pedido' : edicao ? 'Editar pedido' : 'Novo pedido'}
        aoVoltar={tentarSair}
      />

      <div className="conteudo">
        {/* R2b · aviso do rascunho de conversão: nada é definitivo até salvar. */}
        {conversao && (
          <p className="apoio" style={{ marginTop: 0, marginBottom: 14 }}>
            Confira o que veio da proposta — itens e fotos já estão aqui. Nada
            muda na proposta até você tocar em <b>Criar pedido</b>.
          </p>
        )}
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
          />
          <ContadorTextoLongo atual={form.tema.length} />
        </div>

        {/* R2b (UX-024) · Fotos de referência — visíveis e editáveis no form,
            inclusive na edição e no rascunho de conversão (era o buraco que
            fazia a doceira achar que perdeu as fotos da proposta). Na criação
            do zero, o botão salva o pedido primeiro e abre o picker. Tocar na
            miniatura abre a origem; o × tira só a referência. */}
        <div className="campo">
          <label>Fotos de referência (opcional)</label>
          {edicao ? (
            <>
              {refsVisuais.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <GradeReferencias
                    itens={refsVisuais}
                    aoTocar={aoTocarReferencia}
                    aoRemover={(rv) => setRefARemover(rv)}
                  />
                </div>
              )}
              <button
                type="button"
                className="btn-secundario"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={abrirPickerReferencias}
                disabled={salvando}
              >
                <Icone nome="imagem" size={16} />{' '}
                {refsVisuais.length > 0 ? 'Adicionar mais referências' : 'Selecionar referências'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-secundario"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={abrirReferenciasCriacao}
              disabled={salvando}
            >
              <Icone nome="imagem" size={16} /> Selecionar referências
            </button>
          )}
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

        {/* UX-028 · a captura de "inspiração" saiu do formulário do pedido: as
            referências vivem no picker (Referências) com ＋Nova foto / ＋Colar
            link. As colunas inspiracao_id/link_inspiracao viram legado só-leitura
            (montarCampos preserva o que já estava salvo; o detalhe ainda exibe). */}

        {/* Excluir (só na edição; no rascunho de conversão quem faz esse papel
            é o descarte do voltar/Cancelar — dois caminhos confundiriam) */}
        {edicao && !conversao && (
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
            onClick={tentarSair}
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
              (conversao && !form.data_entrega)
            }
          >
            {salvando ? 'Salvando…' : conversao ? 'Criar pedido' : edicao ? 'Salvar' : 'Criar pedido'}
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
                <input
                  value={novoUnidadeItem}
                  onChange={(e) => setNovoUnidadeItem(e.target.value)}
                  placeholder="Unidade (ex.: kg, cento…)"
                  maxLength={40}
                  style={{ marginTop: 8 }}
                />
                <div className="escolha" style={{ marginTop: 8 }}>
                  {chipsUnidadeItem.map((u) => (
                    <button
                      key={u.toLowerCase()}
                      type="button"
                      className={`filtro${novoUnidadeItem.trim().toLowerCase() === u.toLowerCase() ? ' ativo' : ''}`}
                      onClick={() => setNovoUnidadeItem(u)}
                    >
                      {u}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn-secundario"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setCriandoItem(false)
                      setNovoNomeItem('')
                      setNovoPrecoItem('')
                      setNovoUnidadeItem('')
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
                    disabled={salvandoCardapio || !novoNomeItem.trim() || !novoUnidadeItem.trim()}
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

      {aExcluir && (
        <Confirmar
          titulo="Excluir este pedido?"
          descricao="Esta ação não pode ser desfeita. As fotos que já foram para Meus Trabalhos continuam lá."
          rotuloConfirmar="Excluir pedido"
          onConfirmar={confirmarExcluir}
          onCancelar={() => setAExcluir(false)}
        />
      )}

      {/* R2b · sair do rascunho de conversão = descartar (escolha da espec).
          O texto conta a verdade: a proposta segue como estava (UX-026). */}
      {confirmarDescarte && (
        <Confirmar
          titulo="Descartar este pedido?"
          descricao="A proposta continua ativa, como estava. Os ajustes feitos aqui se perdem."
          rotuloConfirmar="Descartar"
          onConfirmar={descartarConversao}
          onCancelar={() => setConfirmarDescarte(false)}
        />
      )}

      {/* UX-033 · aviso "sair sem salvar" fora da conversao (texto identico ao
          do PropostaForm — paridade entre os dois formularios). */}
      {confirmarSaida && (
        <Confirmar
          titulo="Sair sem salvar?"
          descricao="Você tem alterações que ainda não foram salvas neste pedido."
          rotuloConfirmar="Sair sem salvar"
          onConfirmar={() => {
            setConfirmarSaida(false)
            sair()
          }}
          onCancelar={() => setConfirmarSaida(false)}
        />
      )}

      {/* UX-026 · o × da referência só DESVINCULA — o texto por origem deixa
          claro que a foto continua guardada onde estava. */}
      {refARemover && (
        <Confirmar
          titulo="Tirar esta foto do pedido?"
          descricao={
            refARemover.origem === 'trabalho'
              ? 'Ela continua em Meus Trabalhos.'
              : 'Ela continua em Inspirações.'
          }
          rotuloConfirmar="Tirar foto"
          onConfirmar={() => {
            const alvo = refARemover.refId
            setRefARemover(null)
            aoRemoverReferencia(alvo)
          }}
          onCancelar={() => setRefARemover(null)}
        />
      )}
    </div>
  )
}
