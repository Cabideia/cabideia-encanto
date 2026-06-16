import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/** Unidades de venda do enum `unidade_cardapio`. */
export type Unidade = 'unidade' | 'cento' | 'duzia' | 'kg' | 'fatia'

/** Rótulos amigáveis (ordem = ordem do select). */
export const UNIDADES: { valor: Unidade; rotulo: string }[] = [
  { valor: 'unidade', rotulo: 'unidade' },
  { valor: 'cento', rotulo: 'cento' },
  { valor: 'duzia', rotulo: 'dúzia' },
  { valor: 'kg', rotulo: 'kg' },
  { valor: 'fatia', rotulo: 'fatia' },
]

export function rotuloUnidade(u: Unidade): string {
  return UNIDADES.find((x) => x.valor === u)?.rotulo ?? u
}

/** Formata um preço em reais (ex.: 12.5 → "R$ 12,50"). */
export function formatarReal(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export type ItemCardapio = {
  id: string
  nome: string
  preco_base: number | null
  unidade: Unidade
  criado_em: string
}

export type CamposItem = {
  nome: string
  preco_base: string // texto do formulário ("12,50"); vazio = sem preço
  unidade: Unidade
}

/** Converte o texto do campo de preço em número (ou null se vazio/ inválido). */
function precoParaNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  if (!limpo) return null
  const n = Number(limpo)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * M-015 · Cardápio — prateleira de referência (produto + preço base),
 * sem vínculo com pedido. CRUD sobre `cardapio_itens`, ordenado por nome.
 */
export function useCardapio(usuariaId: string | undefined) {
  const [itens, setItens] = useState<ItemCardapio[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  // ── listar(): todos da usuária, ordenados por nome ──
  const listar = useCallback(async () => {
    if (!usuariaId) return
    const { data } = await supabase
      .from('cardapio_itens')
      .select('id, nome, preco_base, unidade, criado_em')
      .eq('usuaria_id', usuariaId)
      .order('nome')
    setItens((data ?? []) as ItemCardapio[])
    setCarregando(false)
  }, [usuariaId])

  useEffect(() => {
    listar()
  }, [listar])

  // ── criar() ──
  async function criar(campos: CamposItem): Promise<{ item: ItemCardapio } | { erro: string }> {
    if (!usuariaId) return { erro: 'Sessão expirada. Entre de novo.' }
    const nome = campos.nome.trim()
    if (!nome) return { erro: 'Dê um nome ao item.' }
    setSalvando(true)
    try {
      const { data, error } = await supabase
        .from('cardapio_itens')
        .insert({
          usuaria_id: usuariaId,
          nome,
          preco_base: precoParaNumero(campos.preco_base),
          unidade: campos.unidade,
        })
        .select('id, nome, preco_base, unidade, criado_em')
        .single()
      if (error || !data) return { erro: 'Falha ao salvar: ' + (error?.message ?? 'erro desconhecido') }
      const item = data as ItemCardapio
      setItens((prev) => [...prev, item].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
      return { item }
    } finally {
      setSalvando(false)
    }
  }

  // ── atualizar() ──
  async function atualizar(id: string, campos: CamposItem): Promise<string | null> {
    const nome = campos.nome.trim()
    if (!nome) return 'Dê um nome ao item.'
    setSalvando(true)
    try {
      const { data, error } = await supabase
        .from('cardapio_itens')
        .update({
          nome,
          preco_base: precoParaNumero(campos.preco_base),
          unidade: campos.unidade,
        })
        .eq('id', id)
        .select('id, nome, preco_base, unidade, criado_em')
        .single()
      if (error || !data) return 'Falha ao atualizar: ' + (error?.message ?? 'erro desconhecido')
      setItens((prev) =>
        prev
          .map((i) => (i.id === id ? (data as ItemCardapio) : i))
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      )
      return null
    } finally {
      setSalvando(false)
    }
  }

  // ── excluir() (a confirmação fica na UI) ──
  async function excluir(id: string): Promise<string | null> {
    const { error } = await supabase.from('cardapio_itens').delete().eq('id', id)
    if (error) return 'Falha ao excluir: ' + error.message
    setItens((prev) => prev.filter((i) => i.id !== id))
    return null
  }

  return { itens, carregando, salvando, listar, criar, atualizar, excluir }
}
