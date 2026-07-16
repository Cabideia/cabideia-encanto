import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SEM_CONEXAO, estaOffline } from '../lib/conexao'

/**
 * M-042 F2a I3 / M-044 · Itens de uma proposta (tabela `proposta_itens`).
 *
 * Cada item é um SNAPSHOT do que foi ofertado: `nome_snapshot` (obrigatório),
 * `preco_snapshot` e `unidade_snapshot` são COPIADOS do `cardapio_itens` no
 * momento de adicionar — a exibição usa sempre o snapshot, NUNCA relê o preço
 * vivo do cardápio. `cardapio_item_id` é só rastro de origem (SET NULL se o item
 * some). A `quantidade` nasce em 1 e é ajustada nesta proposta.
 *
 * M-044 · preço, unidade e quantidade são editáveis SÓ nesta proposta (via
 * `preco_snapshot`/`unidade_snapshot`/`quantidade`), sem tocar a tabela de
 * preços. O total do item (qtd × preço) é calculado na aplicação, não persiste.
 *
 * O hook segue o padrão enxuto de `usePropostaReferencias`: `adicionar` recebe a
 * proposta alvo explicitamente e deduplica por `cardapio_item_id`.
 */
export type PropostaItem = {
  id: string
  proposta_id: string
  cardapio_item_id: string | null
  nome_snapshot: string
  preco_snapshot: number | null
  unidade_snapshot: string | null
  quantidade: number
  ordem: number
  criado_em: string
}

/** Item do cardápio a congelar como oferta (snapshot já resolvido pela UI). */
export type NovoItemProposta = {
  cardapio_item_id: string
  nome_snapshot: string
  preco_snapshot: number | null
  unidade_snapshot: string | null
}

/** Campos editáveis de um item já na proposta (só nesta proposta). */
export type PatchItemProposta = {
  quantidade?: number
  preco_snapshot?: number | null
  unidade_snapshot?: string | null
}

const COLUNAS =
  'id, proposta_id, cardapio_item_id, nome_snapshot, preco_snapshot, unidade_snapshot, quantidade, ordem, criado_em'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapear(r: any): PropostaItem {
  return {
    id: r.id as string,
    proposta_id: r.proposta_id as string,
    cardapio_item_id: (r.cardapio_item_id ?? null) as string | null,
    nome_snapshot: r.nome_snapshot as string,
    preco_snapshot: r.preco_snapshot != null ? Number(r.preco_snapshot) : null,
    unidade_snapshot: (r.unidade_snapshot ?? null) as string | null,
    quantidade: r.quantidade != null ? Number(r.quantidade) : 1,
    ordem: (r.ordem ?? 0) as number,
    criado_em: r.criado_em as string,
  }
}

export function usePropostaItens(
  usuariaId: string | undefined,
  propostaId: string | undefined
) {
  const [itens, setItens] = useState<PropostaItem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  // ── Carrega os itens da proposta, em ordem de exibição ──
  const carregar = useCallback(async () => {
    if (!usuariaId || !propostaId) {
      setItens([])
      setCarregando(false)
      return
    }
    const { data } = await supabase
      .from('proposta_itens')
      .select(COLUNAS)
      .eq('proposta_id', propostaId)
      .order('ordem', { ascending: true })
    setItens((data ?? []).map(mapear))
    setCarregando(false)
  }, [usuariaId, propostaId])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * Adiciona itens (snapshots) a uma proposta (alvo explícito). Ignora itens do
   * cardápio já presentes e enfileira depois da última `ordem` existente. A
   * quantidade nasce em 1 (default do banco); preço e unidade são congelados.
   */
  async function adicionar(
    propostaAlvo: string,
    novos: NovoItemProposta[]
  ): Promise<string | null> {
    if (estaOffline()) return SEM_CONEXAO
    if (!usuariaId) return 'Sessão expirada. Entre de novo.'
    if (novos.length === 0) return null
    setSalvando(true)
    try {
      const { data: atuais } = await supabase
        .from('proposta_itens')
        .select('cardapio_item_id, ordem')
        .eq('proposta_id', propostaAlvo)
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
        proposta_id: propostaAlvo,
        cardapio_item_id: it.cardapio_item_id,
        nome_snapshot: it.nome_snapshot,
        preco_snapshot: it.preco_snapshot,
        unidade_snapshot: it.unidade_snapshot,
        ordem: base + i,
      }))
      const { error } = await supabase.from('proposta_itens').insert(linhas)
      if (error) return 'Falha ao salvar os itens: ' + error.message
      if (propostaAlvo === propostaId) await carregar()
      return null
    } finally {
      setSalvando(false)
    }
  }

  /**
   * M-044 · Atualiza campos de um item já na proposta (quantidade, preço ou
   * unidade) — só nesta proposta, sem mexer na tabela de preços. Otimista.
   */
  async function atualizar(id: string, patch: PatchItemProposta): Promise<string | null> {
    if (estaOffline()) return SEM_CONEXAO
    const corpo: Record<string, unknown> = {}
    if (patch.quantidade !== undefined) corpo.quantidade = patch.quantidade
    if (patch.preco_snapshot !== undefined) corpo.preco_snapshot = patch.preco_snapshot
    if (patch.unidade_snapshot !== undefined) corpo.unidade_snapshot = patch.unidade_snapshot
    if (Object.keys(corpo).length === 0) return null
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
    const { error } = await supabase.from('proposta_itens').update(corpo).eq('id', id)
    if (error) {
      await carregar()
      return 'Falha ao atualizar: ' + error.message
    }
    return null
  }

  // ── Remove um item (atualização otimista) ──
  async function remover(id: string): Promise<string | null> {
    if (estaOffline()) return SEM_CONEXAO
    const { error } = await supabase.from('proposta_itens').delete().eq('id', id)
    if (error) return 'Falha ao remover: ' + error.message
    setItens((prev) => prev.filter((i) => i.id !== id))
    return null
  }

  return { itens, carregando, salvando, listar: carregar, adicionar, atualizar, remover }
}
