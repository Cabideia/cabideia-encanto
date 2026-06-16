import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SEM_CONEXAO, estaOffline } from '../lib/conexao'

export type StatusPedido = 'a_fazer' | 'em_producao' | 'entregue' | 'cancelado'
export type StatusPagamento = 'nao_pago' | 'sinal' | 'pago'

export type Pedido = {
  id: string
  cliente_id: string | null
  cliente_nome: string | null // via join com clientes
  nome: string | null // título curto (registros antigos podem só ter tema)
  tema: string | null // "detalhes do pedido" (longo, opcional)
  valor: number | null // M-039 · valor opcional (só exibição — sem somas/totais)
  data_entrega: string | null // 'YYYY-MM-DD'
  status: StatusPedido
  status_pagamento: StatusPagamento
  foto_referencia_path: string | null
  inspiracao_id: string | null
  trabalho_id: string | null
  proposta_id: string | null // M-039 · proposta que virou este pedido
  link_inspiracao: string | null // M-040 · URL de inspiração da cliente
  tag_id: string | null // M-040 · tag-ponte p/ inspirações do pedido
  token: string | null // M-047 · chave do link público (nasce só ao compartilhar)
  criado_em: string
}

/** Título exibível do pedido: nome curto com fallback para o tema antigo. */
export function tituloPedido(p: Pick<Pedido, 'nome' | 'tema'>): string {
  return p.nome || p.tema || 'Pedido'
}

export type CamposPedido = {
  cliente_id: string | null
  nome: string // obrigatório no app
  tema: string // detalhes, opcional
  valor: number | null // M-039 · opcional em todos os pedidos
  data_entrega: string | null
  status: StatusPedido
  foto_referencia_path: string | null
  inspiracao_id: string | null
  proposta_id?: string | null // M-039 · só na conversão proposta → pedido
  link_inspiracao?: string | null // M-040 · URL de inspiração da cliente
  tag_id?: string | null // M-040 · gravado pelo lote de inspirações do pedido
}

/** Rótulos e classes de chip por status (rótulos exatos do handoff). */
export const STATUS_INFO: Record<StatusPedido, { rotulo: string; chip: string }> = {
  a_fazer: { rotulo: 'A fazer', chip: 'afazer' },
  em_producao: { rotulo: 'Em produção', chip: 'producao' },
  entregue: { rotulo: 'Entregue', chip: 'entregue' },
  cancelado: { rotulo: 'Cancelado', chip: 'cancelado' },
}

/** Rótulos do status de pagamento (enum `status_pagamento` do banco). */
export const PAGAMENTO_INFO: Record<StatusPagamento, string> = {
  nao_pago: 'Não pago',
  sinal: 'Sinal pago',
  pago: 'Pago',
}

/** Rótulo curto do pagamento — chips do detalhe e indicador "· Sinal"/"· Pago" da lista. */
export const PAGAMENTO_CURTO: Record<StatusPagamento, string> = {
  nao_pago: 'Não pago',
  sinal: 'Sinal',
  pago: 'Pago',
}

export type JanelaEntrega = '7d' | 'mes'
const DIAS_JANELA: Record<JanelaEntrega, number> = { '7d': 7, mes: 30 }

/**
 * M-047 · Token aleatório forte e legível em URL (sem caracteres ambíguos).
 * Mesmo alfabeto do link da proposta (F2b) — chave do link público do pedido.
 */
function gerarToken(): string {
  const alfabeto = 'abcdefghijkmnpqrstuvwxyz23456789' // sem l/o/0/1
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  let s = ''
  for (const b of bytes) s += alfabeto[b % alfabeto.length]
  return s
}

/** Data local (não-UTC) em 'YYYY-MM-DD' — evita o salto de fuso do toISOString. */
function isoLocal(d: Date): string {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/** M-002 · Pedido leve (texto livre, sem itens estruturados; valor opcional só p/ exibição — M-039). */
export function usePedidos(usuariaId: string | undefined) {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  // ── listar(): com nome da cliente via join, mais recentes primeiro ──
  const listar = useCallback(async () => {
    if (!usuariaId) return
    const { data } = await supabase
      .from('pedidos')
      .select(
        'id, cliente_id, nome, tema, valor, data_entrega, status, status_pagamento, foto_referencia_path, inspiracao_id, trabalho_id, proposta_id, link_inspiracao, tag_id, token, criado_em, clientes(nome)'
      )
      .eq('usuaria_id', usuariaId)
      .order('criado_em', { ascending: false })

    setPedidos(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data ?? []).map((p: any) => ({
        id: p.id as string,
        cliente_id: p.cliente_id as string | null,
        cliente_nome: (p.clientes?.nome ?? null) as string | null,
        nome: p.nome as string | null,
        tema: p.tema as string | null,
        valor: p.valor as number | null,
        data_entrega: p.data_entrega as string | null,
        status: p.status as StatusPedido,
        status_pagamento: p.status_pagamento as StatusPagamento,
        foto_referencia_path: p.foto_referencia_path as string | null,
        inspiracao_id: p.inspiracao_id as string | null,
        trabalho_id: p.trabalho_id as string | null,
        proposta_id: p.proposta_id as string | null,
        link_inspiracao: p.link_inspiracao as string | null,
        tag_id: p.tag_id as string | null,
        token: p.token as string | null,
        criado_em: p.criado_em as string,
      }))
    )
    setCarregando(false)
  }, [usuariaId])

  useEffect(() => {
    listar()
  }, [listar])

  // ── buscarPorId(): da lista já carregada ──
  const buscarPorId = useCallback(
    (id: string): Pedido | undefined => pedidos.find((p) => p.id === id),
    [pedidos]
  )

  // ── proximasEntregas(janela): não-entregues/não-cancelados com data dentro
  //    da janela (inclui atrasados, que são os mais urgentes), data asc ──
  const proximasEntregas = useCallback(
    (janela: JanelaEntrega): Pedido[] => {
      const limite = new Date()
      limite.setDate(limite.getDate() + DIAS_JANELA[janela])
      const limiteStr = isoLocal(limite)
      return pedidos
        .filter(
          (p) =>
            p.status !== 'entregue' &&
            p.status !== 'cancelado' &&
            p.data_entrega !== null &&
            p.data_entrega <= limiteStr
        )
        .sort((a, b) => (a.data_entrega ?? '').localeCompare(b.data_entrega ?? ''))
    },
    [pedidos]
  )

  // ── pedidosPorMes(ano, mes): entregas com data_entrega no mês (mes 1–12),
  //    data asc — base do calendário (M-006) ──
  const pedidosPorMes = useCallback(
    (ano: number, mes: number): Pedido[] => {
      const prefixo = `${ano}-${String(mes).padStart(2, '0')}-`
      return pedidos
        .filter((p) => p.data_entrega?.startsWith(prefixo))
        .sort((a, b) => (a.data_entrega ?? '').localeCompare(b.data_entrega ?? ''))
    },
    [pedidos]
  )

  // ── pedidosPorDia(data): entregas de um dia exato ('YYYY-MM-DD') ──
  const pedidosPorDia = useCallback(
    (data: string): Pedido[] =>
      pedidos.filter((p) => p.data_entrega === data),
    [pedidos]
  )

  // ── porCliente(clienteId): pedidos de uma cliente (para o ClienteDetalhe) ──
  const porCliente = useCallback(
    (clienteId: string): Pedido[] =>
      pedidos.filter((p) => p.cliente_id === clienteId),
    [pedidos]
  )

  // ── pedidoDaProposta(propostaId): o pedido que nasceu de uma proposta
  //    (M-039 · base do selo "Virou pedido" e do botão "Ver pedido") ──
  const pedidoDaProposta = useCallback(
    (propostaId: string): Pedido | undefined =>
      pedidos.find((p) => p.proposta_id === propostaId),
    [pedidos]
  )

  /** URL assinada (bucket privado) para exibir a foto de referência. */
  async function urlReferencia(path: string): Promise<string | null> {
    const { data } = await supabase.storage.from('acervo').createSignedUrl(path, 3600)
    return data?.signedUrl ?? null
  }

  /** Baixa a foto de referência como Blob (para reaproveitar ao mandar ao acervo). */
  async function baixarReferencia(path: string): Promise<Blob | null> {
    const { data } = await supabase.storage.from('acervo').download(path)
    return data ?? null
  }

  // ── criar() — devolve o id criado (ou erro) ──
  async function criar(campos: CamposPedido): Promise<{ id: string } | { erro: string }> {
    if (estaOffline()) return { erro: SEM_CONEXAO }
    if (!usuariaId) return { erro: 'Sessão expirada. Entre de novo.' }
    const nome = campos.nome.trim()
    if (!nome) return { erro: 'Dê um nome ao pedido.' }
    setSalvando(true)
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .insert({
          usuaria_id: usuariaId,
          cliente_id: campos.cliente_id,
          nome,
          tema: campos.tema.trim() || null,
          valor: campos.valor,
          data_entrega: campos.data_entrega,
          status: campos.status,
          foto_referencia_path: campos.foto_referencia_path,
          inspiracao_id: campos.inspiracao_id,
          proposta_id: campos.proposta_id ?? null,
          link_inspiracao: campos.link_inspiracao?.trim() || null,
        })
        .select('id')
        .single()
      if (error || !data) return { erro: 'Falha ao salvar: ' + (error?.message ?? 'erro desconhecido') }
      await listar()
      return { id: (data as { id: string }).id }
    } finally {
      setSalvando(false)
    }
  }

  // ── atualizar() — aceita um patch parcial (inclui trabalho_id) ──
  async function atualizar(
    id: string,
    patch: Partial<CamposPedido & { trabalho_id: string | null }>
  ): Promise<string | null> {
    if (estaOffline()) return SEM_CONEXAO
    if (patch.nome !== undefined && !patch.nome.trim()) return 'Dê um nome ao pedido.'
    const corpo: Record<string, unknown> = { ...patch }
    if (typeof corpo.nome === 'string') corpo.nome = corpo.nome.trim()
    if (typeof corpo.tema === 'string') corpo.tema = corpo.tema.trim() || null
    if (typeof corpo.link_inspiracao === 'string')
      corpo.link_inspiracao = corpo.link_inspiracao.trim() || null
    setSalvando(true)
    try {
      const { error } = await supabase.from('pedidos').update(corpo).eq('id', id)
      if (error) return 'Falha ao atualizar: ' + error.message
      await listar()
      return null
    } finally {
      setSalvando(false)
    }
  }

  // ── mudarStatus() — atalho otimista usado nos chips/detalhe ──
  async function mudarStatus(id: string, status: StatusPedido): Promise<string | null> {
    if (estaOffline()) return SEM_CONEXAO
    const { error } = await supabase.from('pedidos').update({ status }).eq('id', id)
    if (error) return 'Falha ao mudar o status: ' + error.message
    setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)))
    return null
  }

  // ── mudarStatusPagamento() — espelho do mudarStatus para o pagamento ──
  async function mudarStatusPagamento(id: string, status_pagamento: StatusPagamento): Promise<string | null> {
    const { error } = await supabase.from('pedidos').update({ status_pagamento }).eq('id', id)
    if (error) return 'Falha ao mudar o pagamento: ' + error.message
    setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, status_pagamento } : p)))
    return null
  }

  /**
   * M-047 · Garante o token do link público do pedido: reusa se já existe, cria
   * e grava se não (sem expiração; o que fecha o link é o status 'cancelado').
   * Devolve o token, ou null se falhar. Espelha `garantirToken` da proposta.
   */
  async function garantirToken(id: string): Promise<string | null> {
    const atual = pedidos.find((p) => p.id === id)
    if (atual?.token) return atual.token
    const token = gerarToken()
    const { data, error } = await supabase
      .from('pedidos')
      .update({ token })
      .eq('id', id)
      .select('token')
      .single()
    if (error || !data) return null
    const tk = (data as { token: string }).token
    setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, token: tk } : p)))
    return tk
  }

  // ── excluir() (a confirmação fica na UI) ──
  async function excluir(id: string): Promise<string | null> {
    if (estaOffline()) return SEM_CONEXAO
    const { error } = await supabase.from('pedidos').delete().eq('id', id)
    if (error) return 'Falha ao excluir: ' + error.message
    setPedidos((prev) => prev.filter((p) => p.id !== id))
    return null
  }

  return {
    pedidos,
    carregando,
    salvando,
    listar,
    buscarPorId,
    proximasEntregas,
    pedidosPorMes,
    pedidosPorDia,
    porCliente,
    pedidoDaProposta,
    urlReferencia,
    baixarReferencia,
    criar,
    atualizar,
    mudarStatus,
    mudarStatusPagamento,
    garantirToken,
    excluir,
  }
}
