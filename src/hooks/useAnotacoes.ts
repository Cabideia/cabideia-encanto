import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SEM_CONEXAO, estaOffline } from '../lib/conexao'

export type Anotacao = {
  id: string
  texto: string
  atualizado_em: string
}

/**
 * M-008 · Anotações — bloco de texto livre.
 * CRUD sobre `anotacoes`, ordenado pela última edição (atualizado_em desc).
 */
export function useAnotacoes(usuariaId: string | undefined) {
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  // ── listar(): todas da usuária, mais recentes primeiro ──
  const listar = useCallback(async () => {
    if (!usuariaId) return
    const { data } = await supabase
      .from('anotacoes')
      .select('id, texto, atualizado_em')
      .eq('usuaria_id', usuariaId)
      .order('atualizado_em', { ascending: false })
    setAnotacoes((data ?? []) as Anotacao[])
    setCarregando(false)
  }, [usuariaId])

  useEffect(() => {
    listar()
  }, [listar])

  // ── criar() ──
  async function criar(texto: string): Promise<{ anotacao: Anotacao } | { erro: string }> {
    if (estaOffline()) return { erro: SEM_CONEXAO }
    if (!usuariaId) return { erro: 'Sessão expirada. Entre de novo.' }
    const limpo = texto.trim()
    if (!limpo) return { erro: 'Escreva algo na anotação.' }
    setSalvando(true)
    try {
      const { data, error } = await supabase
        .from('anotacoes')
        .insert({ usuaria_id: usuariaId, texto: limpo, atualizado_em: new Date().toISOString() })
        .select('id, texto, atualizado_em')
        .single()
      if (error || !data) return { erro: 'Falha ao salvar: ' + (error?.message ?? 'erro desconhecido') }
      const anotacao = data as Anotacao
      setAnotacoes((prev) => [anotacao, ...prev])
      return { anotacao }
    } finally {
      setSalvando(false)
    }
  }

  // ── atualizar() ──
  async function atualizar(id: string, texto: string): Promise<string | null> {
    if (estaOffline()) return SEM_CONEXAO
    const limpo = texto.trim()
    if (!limpo) return 'Escreva algo na anotação.'
    setSalvando(true)
    try {
      const { data, error } = await supabase
        .from('anotacoes')
        .update({ texto: limpo, atualizado_em: new Date().toISOString() })
        .eq('id', id)
        .select('id, texto, atualizado_em')
        .single()
      if (error || !data) return 'Falha ao atualizar: ' + (error?.message ?? 'erro desconhecido')
      // Reordena: a editada volta para o topo (atualizado_em desc).
      setAnotacoes((prev) =>
        [data as Anotacao, ...prev.filter((a) => a.id !== id)]
      )
      return null
    } finally {
      setSalvando(false)
    }
  }

  // ── excluir() (a confirmação fica na UI) ──
  async function excluir(id: string): Promise<string | null> {
    if (estaOffline()) return SEM_CONEXAO
    const { error } = await supabase.from('anotacoes').delete().eq('id', id)
    if (error) return 'Falha ao excluir: ' + error.message
    setAnotacoes((prev) => prev.filter((a) => a.id !== id))
    return null
  }

  return { anotacoes, carregando, salvando, listar, criar, atualizar, excluir }
}
