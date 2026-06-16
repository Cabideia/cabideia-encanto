import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SEM_CONEXAO, estaOffline } from '../lib/conexao'

export type Selecao = {
  id: string
  token: string
  titulo: string | null
  mensagem: string | null
  expira_em: string
  criado_em: string
  qtd: number
}

/** Gera um token aleatório forte e legível em URL (sem caracteres ambíguos). */
function gerarToken(): string {
  const alfabeto = 'abcdefghijkmnpqrstuvwxyz23456789' // sem l/o/0/1
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  let s = ''
  for (const b of bytes) s += alfabeto[b % alfabeto.length]
  return s
}

export function useSelecoes(usuariaId: string | undefined) {
  const [selecoes, setSelecoes] = useState<Selecao[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (!usuariaId) return
    const { data } = await supabase
      .from('selecoes')
      .select('id, token, titulo, mensagem, expira_em, criado_em, selecao_itens(trabalho_id)')
      .eq('usuaria_id', usuariaId)
      .order('criado_em', { ascending: false })

    setSelecoes(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data ?? []).map((s: any) => ({
        id: s.id,
        token: s.token,
        titulo: s.titulo,
        mensagem: s.mensagem,
        expira_em: s.expira_em,
        criado_em: s.criado_em,
        qtd: (s.selecao_itens ?? []).length,
      }))
    )
    setCarregando(false)
  }, [usuariaId])

  useEffect(() => {
    carregar()
  }, [carregar])

  /** Cria a seleção e seus itens. Devolve o token (ou null em falha). */
  async function criar(
    trabalhoIds: string[],
    titulo: string,
    mensagem: string
  ): Promise<{ token: string } | { erro: string }> {
    if (estaOffline()) return { erro: SEM_CONEXAO }
    if (!usuariaId) return { erro: 'Sessão expirada. Entre de novo.' }
    if (trabalhoIds.length === 0) return { erro: 'Selecione ao menos uma foto.' }

    const token = gerarToken()
    const { data: sel, error: e1 } = await supabase
      .from('selecoes')
      .insert({
        usuaria_id: usuariaId,
        token,
        titulo: titulo.trim() || null,
        mensagem: mensagem.trim() || null,
      })
      .select('id, token')
      .single()

    if (e1 || !sel) return { erro: 'Falha ao criar o link: ' + (e1?.message ?? '') }

    const itens = trabalhoIds.map((id, i) => ({
      selecao_id: (sel as { id: string }).id,
      trabalho_id: id,
      ordem: i,
    }))
    const { error: e2 } = await supabase.from('selecao_itens').insert(itens)
    if (e2) {
      // desfaz a seleção se os itens falharem (cascade remove o que entrou)
      await supabase.from('selecoes').delete().eq('id', (sel as { id: string }).id)
      return { erro: 'Falha ao montar a seleção: ' + e2.message }
    }

    await carregar()
    return { token: (sel as { token: string }).token }
  }

  /** Apaga uma seleção — revoga o link na hora (cascade nos itens). */
  async function apagar(id: string): Promise<string | null> {
    if (estaOffline()) return SEM_CONEXAO
    const { error } = await supabase.from('selecoes').delete().eq('id', id)
    if (error) return 'Falha ao apagar: ' + error.message
    setSelecoes((prev) => prev.filter((s) => s.id !== id))
    return null
  }

  return { selecoes, carregando, criar, apagar }
}
