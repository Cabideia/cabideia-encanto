import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Cliente = {
  id: string
  nome: string
  whatsapp: string | null
  nota: string | null
  criado_em: string
}

export type CamposCliente = {
  nome: string
  whatsapp: string
  nota: string
}

/**
 * Monta o link wa.me com a mensagem pré-preenchida.
 * O número vai só com dígitos (wa.me não aceita "+", espaços ou traços);
 * o texto vai URL-encoded. Devolve null se não houver WhatsApp cadastrado.
 */
export function linkWhatsApp(cliente: Pick<Cliente, 'nome' | 'whatsapp'>): string | null {
  const numero = (cliente.whatsapp ?? '').replace(/\D/g, '')
  if (!numero) return null
  const texto = encodeURIComponent(`Olá, ${cliente.nome}!`)
  return `https://wa.me/${numero}?text=${texto}`
}

/** M-003 · CRUD de clientes (cadastro enxuto: nome, whatsapp, nota). */
export function useClientes(usuariaId: string | undefined) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  // ── listar(): todos da usuária, ordenados por nome ──
  const listar = useCallback(async () => {
    if (!usuariaId) return
    const { data } = await supabase
      .from('clientes')
      .select('id, nome, whatsapp, nota, criado_em')
      .eq('usuaria_id', usuariaId)
      .order('nome')
    setClientes((data ?? []) as Cliente[])
    setCarregando(false)
  }, [usuariaId])

  useEffect(() => {
    listar()
  }, [listar])

  // ── buscarPorId(): da lista já carregada ──
  const buscarPorId = useCallback(
    (id: string): Cliente | undefined => clientes.find((c) => c.id === id),
    [clientes]
  )

  // ── criar() ──
  async function criar(campos: CamposCliente): Promise<string | null> {
    if (!usuariaId) return 'Sessão expirada. Entre de novo.'
    const nome = campos.nome.trim()
    if (!nome) return 'Dê um nome à cliente.'
    setSalvando(true)
    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert({
          usuaria_id: usuariaId,
          nome,
          whatsapp: campos.whatsapp.trim() || null,
          nota: campos.nota.trim() || null,
        })
        .select('id, nome, whatsapp, nota, criado_em')
        .single()
      if (error || !data) return 'Falha ao salvar: ' + (error?.message ?? 'erro desconhecido')
      setClientes((prev) =>
        [...prev, data as Cliente].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      )
      return null
    } finally {
      setSalvando(false)
    }
  }

  // ── atualizar() ──
  async function atualizar(id: string, campos: CamposCliente): Promise<string | null> {
    const nome = campos.nome.trim()
    if (!nome) return 'Dê um nome à cliente.'
    setSalvando(true)
    try {
      const { data, error } = await supabase
        .from('clientes')
        .update({
          nome,
          whatsapp: campos.whatsapp.trim() || null,
          nota: campos.nota.trim() || null,
        })
        .eq('id', id)
        .select('id, nome, whatsapp, nota, criado_em')
        .single()
      if (error || !data) return 'Falha ao atualizar: ' + (error?.message ?? 'erro desconhecido')
      setClientes((prev) =>
        prev
          .map((c) => (c.id === id ? (data as Cliente) : c))
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      )
      return null
    } finally {
      setSalvando(false)
    }
  }

  // ── excluir() (a confirmação fica na UI) ──
  async function excluir(id: string): Promise<string | null> {
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (error) return 'Falha ao excluir: ' + error.message
    setClientes((prev) => prev.filter((c) => c.id !== id))
    return null
  }

  return {
    clientes,
    carregando,
    salvando,
    listar,
    buscarPorId,
    criar,
    atualizar,
    excluir,
  }
}
