import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Propostas (M-021 repensado) — agora nasce da CLIENTE e fica salva.
 *
 * CRUD sobre `propostas` (cliente_id, titulo, descricao, valor, validade,
 * foto_path). A foto da proposta é comprimida no cliente (M-009) e guardada no
 * bucket público — NÃO é um trabalho (não conta no limite de 150 imagens).
 * O cartão (PNG) é montado no cliente a partir desses campos.
 */
export type Proposta = {
  id: string
  cliente_id: string | null
  titulo: string | null
  descricao: string | null
  valor: number | null
  validade: string | null // 'YYYY-MM-DD'
  foto_path: string | null // bucket 'publico'
  resolvida: boolean // M-037: arquivada em "Acompanhar" (reversível)
  criado_em: string
}

export type CamposProposta = {
  titulo: string
  descricao: string
  valor: number | null
  validade: string | null
  foto_path: string | null
}

const COLUNAS = 'id, cliente_id, titulo, descricao, valor, validade, foto_path, resolvida, criado_em'

export function usePropostas(usuariaId: string | undefined) {
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const listar = useCallback(async () => {
    if (!usuariaId) return
    const { data } = await supabase
      .from('propostas')
      .select(COLUNAS)
      .eq('usuaria_id', usuariaId)
      .order('criado_em', { ascending: false })
    setPropostas((data ?? []) as Proposta[])
    setCarregando(false)
  }, [usuariaId])

  useEffect(() => {
    listar()
  }, [listar])

  const porCliente = useCallback(
    (clienteId: string): Proposta[] => propostas.filter((p) => p.cliente_id === clienteId),
    [propostas]
  )

  const buscarPorId = useCallback(
    (id: string): Proposta | undefined => propostas.find((p) => p.id === id),
    [propostas]
  )

  /** Sobe a foto da proposta (blob já comprimido) no bucket público. */
  async function subirFoto(blob: Blob): Promise<{ path: string } | { erro: string }> {
    if (!usuariaId) return { erro: 'Sessão expirada. Entre de novo.' }
    const path = `${usuariaId}/prop/${crypto.randomUUID()}.jpg`
    const { error } = await supabase.storage
      .from('publico')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    if (error) return { erro: 'Falha ao enviar a foto: ' + error.message }
    return { path }
  }

  async function criar(
    clienteId: string,
    campos: CamposProposta
  ): Promise<{ id: string } | { erro: string }> {
    if (!usuariaId) return { erro: 'Sessão expirada. Entre de novo.' }
    setSalvando(true)
    try {
      const { data, error } = await supabase
        .from('propostas')
        .insert({
          usuaria_id: usuariaId,
          cliente_id: clienteId,
          titulo: campos.titulo.trim() || null,
          descricao: campos.descricao.trim() || null,
          valor: campos.valor,
          validade: campos.validade,
          foto_path: campos.foto_path,
        })
        .select(COLUNAS)
        .single()
      if (error || !data) {
        if (campos.foto_path) await supabase.storage.from('publico').remove([campos.foto_path])
        return { erro: 'Falha ao salvar: ' + (error?.message ?? 'erro desconhecido') }
      }
      setPropostas((prev) => [data as Proposta, ...prev])
      return { id: (data as Proposta).id }
    } finally {
      setSalvando(false)
    }
  }

  async function atualizar(
    id: string,
    campos: CamposProposta,
    fotoAntiga: string | null
  ): Promise<string | null> {
    setSalvando(true)
    try {
      const { data, error } = await supabase
        .from('propostas')
        .update({
          titulo: campos.titulo.trim() || null,
          descricao: campos.descricao.trim() || null,
          valor: campos.valor,
          validade: campos.validade,
          foto_path: campos.foto_path,
        })
        .eq('id', id)
        .select(COLUNAS)
        .single()
      if (error || !data) return 'Falha ao salvar: ' + (error?.message ?? 'erro desconhecido')
      // Remove a foto antiga do storage se foi trocada/retirada.
      if (fotoAntiga && fotoAntiga !== campos.foto_path)
        await supabase.storage.from('publico').remove([fotoAntiga])
      setPropostas((prev) => prev.map((p) => (p.id === id ? (data as Proposta) : p)))
      return null
    } finally {
      setSalvando(false)
    }
  }

  /**
   * M-037 · "Marcar como resolvido" (arquivar) — diferente de excluir:
   * a proposta segue salva (reversível), só sai da aba ativa de Acompanhar.
   */
  async function marcarResolvida(id: string, resolvida: boolean): Promise<string | null> {
    const { error } = await supabase.from('propostas').update({ resolvida }).eq('id', id)
    if (error) return 'Falha ao atualizar: ' + error.message
    setPropostas((prev) => prev.map((p) => (p.id === id ? { ...p, resolvida } : p)))
    return null
  }

  async function excluir(proposta: Proposta): Promise<string | null> {
    const { error } = await supabase.from('propostas').delete().eq('id', proposta.id)
    if (error) return 'Falha ao excluir: ' + error.message
    if (proposta.foto_path) await supabase.storage.from('publico').remove([proposta.foto_path])
    setPropostas((prev) => prev.filter((p) => p.id !== proposta.id))
    return null
  }

  return { propostas, carregando, salvando, listar, porCliente, buscarPorId, subirFoto, criar, atualizar, marcarResolvida, excluir }
}
