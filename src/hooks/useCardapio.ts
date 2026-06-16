import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SEM_CONEXAO, estaOffline } from '../lib/conexao'

/** Sugestões de unidade (chips). O campo aceita qualquer texto livre. */
export const UNIDADES_SUGERIDAS = ['unidade', 'cento', 'dúzia', 'kg', 'fatia']

/** Formata um preço em reais (ex.: 1234.56 → "R$ 1.234,56"). */
export function formatarReal(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Converte o texto do campo de preço em número (ou null se vazio/ inválido). */
export function precoParaNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  if (!limpo) return null
  const n = Number(limpo)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * UX-002 · Texto pronto de um item, para inserir nos detalhes do pedido.
 * Ex.: "Bolo — R$ 120,00 por kg". Sem preço, devolve só o nome.
 */
export function textoItemCardapio(item: {
  nome: string
  preco_base: number | null
  unidade: string | null
  preco_sob_consulta: boolean
}): string {
  const preco =
    item.preco_base != null
      ? formatarReal(item.preco_base)
      : item.preco_sob_consulta
      ? 'sob consulta'
      : null
  if (!preco) return item.nome
  const unidade = item.unidade ? ` por ${item.unidade}` : ''
  return `${item.nome} — ${preco}${unidade}`
}

export type ItemCardapio = {
  id: string
  nome: string
  preco_base: number | null
  unidade: string | null
  detalhes: string | null
  na_vitrine: boolean
  preco_sob_consulta: boolean
  criado_em: string
}

export type CamposItem = {
  nome: string
  preco_base: string // texto do formulário ("12,50"); vazio = sem preço
  unidade: string // texto livre; vazio = sem unidade
  detalhes: string
  na_vitrine: boolean
  preco_sob_consulta: boolean
}

const COLUNAS = 'id, nome, preco_base, unidade, detalhes, na_vitrine, preco_sob_consulta, criado_em'

/** Monta o payload de insert/update a partir dos campos do formulário. */
function payload(campos: CamposItem) {
  const naVitrine = campos.na_vitrine
  return {
    nome: campos.nome.trim(),
    preco_base: precoParaNumero(campos.preco_base),
    unidade: campos.unidade.trim() || null,
    detalhes: campos.detalhes.trim() || null,
    na_vitrine: naVitrine,
    // "Preço sob consulta" só faz sentido quando o item está na vitrine.
    preco_sob_consulta: naVitrine && campos.preco_sob_consulta,
  }
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
      .select(COLUNAS)
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
    if (estaOffline()) return { erro: SEM_CONEXAO }
    if (!usuariaId) return { erro: 'Sessão expirada. Entre de novo.' }
    const dados = payload(campos)
    if (!dados.nome) return { erro: 'Dê um nome ao item.' }
    setSalvando(true)
    try {
      const { data, error } = await supabase
        .from('cardapio_itens')
        .insert({ usuaria_id: usuariaId, ...dados })
        .select(COLUNAS)
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
    if (estaOffline()) return SEM_CONEXAO
    const dados = payload(campos)
    if (!dados.nome) return 'Dê um nome ao item.'
    setSalvando(true)
    try {
      const { data, error } = await supabase
        .from('cardapio_itens')
        .update(dados)
        .eq('id', id)
        .select(COLUNAS)
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
    if (estaOffline()) return SEM_CONEXAO
    const { error } = await supabase.from('cardapio_itens').delete().eq('id', id)
    if (error) return 'Falha ao excluir: ' + error.message
    setItens((prev) => prev.filter((i) => i.id !== id))
    return null
  }

  return { itens, carregando, salvando, listar, criar, atualizar, excluir }
}
