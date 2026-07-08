import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * M-042 · Referências de um pedido (tabela `pedido_referencias`).
 *
 * Cada referência liga o pedido a um item de origem única — um trabalho (Meus
 * Trabalhos) OU uma inspiração (galeria) —, com `ordem` para a exibição. O shape
 * espelha `selecao_itens`, mas aqui NÃO existe link público: é só a coleção de
 * referências do pedido (persistência interna).
 *
 * O hook fica de propósito enxuto (só ids + ordem): quem exibe resolve as
 * imagens cruzando com as listas já carregadas de trabalhos/inspirações. E
 * `adicionar` recebe o pedido alvo explicitamente, para a Fase 2 conseguir
 * copiar as referências da proposta para o pedido recém-criado na conversão.
 */
export type OrigemReferencia = 'trabalho' | 'inspiracao'

export type PedidoReferencia = {
  id: string
  pedido_id: string
  trabalho_id: string | null
  inspiracao_id: string | null
  origem: OrigemReferencia
  ordem: number
  criado_em: string
}

/** Item a virar referência: a origem diz qual FK preencher; `id` é o do item. */
export type NovaReferencia = {
  origem: OrigemReferencia
  id: string
}

const COLUNAS = 'id, pedido_id, trabalho_id, inspiracao_id, ordem, criado_em'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapear(r: any): PedidoReferencia {
  return {
    id: r.id as string,
    pedido_id: r.pedido_id as string,
    trabalho_id: (r.trabalho_id ?? null) as string | null,
    inspiracao_id: (r.inspiracao_id ?? null) as string | null,
    origem: (r.trabalho_id ? 'trabalho' : 'inspiracao') as OrigemReferencia,
    ordem: (r.ordem ?? 0) as number,
    criado_em: r.criado_em as string,
  }
}

export function usePedidoReferencias(
  usuariaId: string | undefined,
  pedidoId: string | undefined
) {
  const [referencias, setReferencias] = useState<PedidoReferencia[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  // ── Carrega as referências do pedido, em ordem de exibição ──
  const carregar = useCallback(async () => {
    if (!usuariaId || !pedidoId) {
      setReferencias([])
      setCarregando(false)
      return
    }
    const { data } = await supabase
      .from('pedido_referencias')
      .select(COLUNAS)
      .eq('pedido_id', pedidoId)
      .order('ordem', { ascending: true })
    setReferencias((data ?? []).map(mapear))
    setCarregando(false)
  }, [usuariaId, pedidoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * Adiciona referências a um pedido (o alvo é explícito — pode ser outro que
   * não o carregado, p.ex. na conversão da Fase 2). Ignora itens já presentes
   * naquele pedido e enfileira depois da última `ordem` existente.
   */
  async function adicionar(
    pedidoAlvo: string,
    itens: NovaReferencia[]
  ): Promise<string | null> {
    if (!usuariaId) return 'Sessão expirada. Entre de novo.'
    if (itens.length === 0) return null
    setSalvando(true)
    try {
      // Estado atual do pedido alvo: última ordem + itens já referenciados.
      const { data: atuais } = await supabase
        .from('pedido_referencias')
        .select('trabalho_id, inspiracao_id, ordem')
        .eq('pedido_id', pedidoAlvo)
        .order('ordem', { ascending: false })

      const jaTem = new Set(
        (atuais ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (r: any) => `${r.trabalho_id ? 't' : 'i'}:${r.trabalho_id ?? r.inspiracao_id}`
        )
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const base = ((atuais?.[0] as any)?.ordem ?? -1) + 1

      const novos = itens.filter(
        (it) => !jaTem.has(`${it.origem === 'trabalho' ? 't' : 'i'}:${it.id}`)
      )
      if (novos.length === 0) return null

      const linhas = novos.map((it, i) => ({
        pedido_id: pedidoAlvo,
        trabalho_id: it.origem === 'trabalho' ? it.id : null,
        inspiracao_id: it.origem === 'inspiracao' ? it.id : null,
        ordem: base + i,
      }))
      const { error } = await supabase.from('pedido_referencias').insert(linhas)
      if (error) return 'Falha ao salvar as referências: ' + error.message
      if (pedidoAlvo === pedidoId) await carregar()
      return null
    } finally {
      setSalvando(false)
    }
  }

  // ── Remove uma referência (atualização otimista) ──
  async function remover(id: string): Promise<string | null> {
    const { error } = await supabase.from('pedido_referencias').delete().eq('id', id)
    if (error) return 'Falha ao remover: ' + error.message
    setReferencias((prev) => prev.filter((r) => r.id !== id))
    return null
  }

  return { referencias, carregando, salvando, listar: carregar, adicionar, remover }
}
