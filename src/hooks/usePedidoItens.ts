import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SEM_CONEXAO, estaOffline } from '../lib/conexao'

/**
 * M-044 · Itens de um pedido (tabela `pedido_itens`). Espelho de
 * `usePropostaItens`: cada item é um SNAPSHOT do que foi acordado —
 * `nome_snapshot` (obrigatório), `preco_snapshot` e `unidade_snapshot` COPIADOS
 * do `cardapio_itens` ao adicionar; a exibição usa sempre o snapshot, nunca relê
 * o preço vivo. `cardapio_item_id` é só rastro de origem (SET NULL se some). A
 * `quantidade` nasce em 1 e é ajustada neste pedido.
 *
 * Preço, unidade e quantidade são editáveis SÓ neste pedido (sem tocar a tabela
 * de preços). O total do item (qtd × preço) é calculado na aplicação, não
 * persiste. `adicionar` recebe o pedido alvo explicitamente; `copiarDaProposta`
 * traz os itens na conversão proposta → pedido (listas independentes daí).
 */
export type PedidoItem = {
  id: string
  pedido_id: string
  cardapio_item_id: string | null
  nome_snapshot: string
  preco_snapshot: number | null
  unidade_snapshot: string | null
  quantidade: number
  ordem: number
  criado_em: string
}

/** Item do cardápio a congelar no pedido (snapshot já resolvido pela UI). */
export type NovoItemPedido = {
  cardapio_item_id: string
  nome_snapshot: string
  preco_snapshot: number | null
  unidade_snapshot: string | null
}

/** Campos editáveis de um item já no pedido (só neste pedido). */
export type PatchItemPedido = {
  quantidade?: number
  preco_snapshot?: number | null
  unidade_snapshot?: string | null
}

const COLUNAS =
  'id, pedido_id, cardapio_item_id, nome_snapshot, preco_snapshot, unidade_snapshot, quantidade, ordem, criado_em'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapear(r: any): PedidoItem {
  return {
    id: r.id as string,
    pedido_id: r.pedido_id as string,
    cardapio_item_id: (r.cardapio_item_id ?? null) as string | null,
    nome_snapshot: r.nome_snapshot as string,
    preco_snapshot: r.preco_snapshot != null ? Number(r.preco_snapshot) : null,
    unidade_snapshot: (r.unidade_snapshot ?? null) as string | null,
    quantidade: r.quantidade != null ? Number(r.quantidade) : 1,
    ordem: (r.ordem ?? 0) as number,
    criado_em: r.criado_em as string,
  }
}

export function usePedidoItens(
  usuariaId: string | undefined,
  pedidoId: string | undefined
) {
  const [itens, setItens] = useState<PedidoItem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  // ── Carrega os itens do pedido, em ordem de exibição ──
  const carregar = useCallback(async () => {
    if (!usuariaId || !pedidoId) {
      setItens([])
      setCarregando(false)
      return
    }
    const { data } = await supabase
      .from('pedido_itens')
      .select(COLUNAS)
      .eq('pedido_id', pedidoId)
      .order('ordem', { ascending: true })
    setItens((data ?? []).map(mapear))
    setCarregando(false)
  }, [usuariaId, pedidoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * Adiciona itens (snapshots) a um pedido (alvo explícito). Ignora itens do
   * cardápio já presentes e enfileira depois da última `ordem` existente. A
   * quantidade nasce em 1 (default do banco); preço e unidade são congelados.
   */
  async function adicionar(
    pedidoAlvo: string,
    novos: NovoItemPedido[]
  ): Promise<string | null> {
    if (estaOffline()) return SEM_CONEXAO
    if (!usuariaId) return 'Sessão expirada. Entre de novo.'
    if (novos.length === 0) return null
    setSalvando(true)
    try {
      const { data: atuais } = await supabase
        .from('pedido_itens')
        .select('cardapio_item_id, ordem')
        .eq('pedido_id', pedidoAlvo)
        .order('ordem', { ascending: false })

      const jaTem = new Set(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (atuais ?? []).map((r: any) => r.cardapio_item_id).filter(Boolean)
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const base = ((atuais?.[0] as any)?.ordem ?? -1) + 1

      const aInserir = novos.filter((it) => !jaTem.has(it.cardapio_item_id))
      if (aInserir.length === 0) return null

      const linhas = aInserir.map((it, i) => ({
        pedido_id: pedidoAlvo,
        cardapio_item_id: it.cardapio_item_id,
        nome_snapshot: it.nome_snapshot,
        preco_snapshot: it.preco_snapshot,
        unidade_snapshot: it.unidade_snapshot,
        ordem: base + i,
      }))
      const { error } = await supabase.from('pedido_itens').insert(linhas)
      if (error) return 'Falha ao salvar os itens: ' + error.message
      if (pedidoAlvo === pedidoId) await carregar()
      return null
    } finally {
      setSalvando(false)
    }
  }

  /**
   * M-044 · Copia os itens de uma proposta para um pedido recém-criado na
   * conversão (Decisão #45). Preserva nome/preço/unidade/qtd/ordem; a partir daí
   * as listas são independentes. Devolve erro (ou null); a conversão trata como
   * não-fatal (o pedido já foi criado).
   */
  async function copiarDaProposta(
    pedidoAlvo: string,
    propostaId: string
  ): Promise<string | null> {
    if (estaOffline()) return SEM_CONEXAO
    if (!usuariaId) return 'Sessão expirada. Entre de novo.'
    const { data, error } = await supabase
      .from('proposta_itens')
      .select('cardapio_item_id, nome_snapshot, preco_snapshot, unidade_snapshot, quantidade, ordem')
      .eq('proposta_id', propostaId)
      .order('ordem', { ascending: true })
    if (error) return 'Falha ao ler os itens da proposta: ' + error.message
    if (!data || data.length === 0) return null
    const linhas = data.map((linha) => {
      const r = linha as {
        cardapio_item_id: string | null
        nome_snapshot: string
        preco_snapshot: number | null
        unidade_snapshot: string | null
        quantidade: number
        ordem: number
      }
      return {
        pedido_id: pedidoAlvo,
        cardapio_item_id: r.cardapio_item_id,
        nome_snapshot: r.nome_snapshot,
        preco_snapshot: r.preco_snapshot,
        unidade_snapshot: r.unidade_snapshot,
        quantidade: r.quantidade,
        ordem: r.ordem,
      }
    })
    const { error: insErro } = await supabase.from('pedido_itens').insert(linhas)
    if (insErro) return 'Falha ao copiar os itens: ' + insErro.message
    if (pedidoAlvo === pedidoId) await carregar()
    return null
  }

  /**
   * M-044 · Atualiza campos de um item já no pedido (quantidade, preço ou
   * unidade) — só neste pedido, sem mexer na tabela de preços. Otimista.
   */
  async function atualizar(id: string, patch: PatchItemPedido): Promise<string | null> {
    if (estaOffline()) return SEM_CONEXAO
    const corpo: Record<string, unknown> = {}
    if (patch.quantidade !== undefined) corpo.quantidade = patch.quantidade
    if (patch.preco_snapshot !== undefined) corpo.preco_snapshot = patch.preco_snapshot
    if (patch.unidade_snapshot !== undefined) corpo.unidade_snapshot = patch.unidade_snapshot
    if (Object.keys(corpo).length === 0) return null
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
    const { error } = await supabase.from('pedido_itens').update(corpo).eq('id', id)
    if (error) {
      await carregar()
      return 'Falha ao atualizar: ' + error.message
    }
    return null
  }

  // ── Remove um item (atualização otimista) ──
  async function remover(id: string): Promise<string | null> {
    if (estaOffline()) return SEM_CONEXAO
    const { error } = await supabase.from('pedido_itens').delete().eq('id', id)
    if (error) return 'Falha ao remover: ' + error.message
    setItens((prev) => prev.filter((i) => i.id !== id))
    return null
  }

  return { itens, carregando, salvando, listar: carregar, adicionar, copiarDaProposta, atualizar, remover }
}
