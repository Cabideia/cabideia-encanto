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
/** M-042 F2a I3 · qual dos 3 modos de preço a proposta exibe. */
export type ModoPreco = 'fechado' | 'itens' | 'sem'

export type Proposta = {
  id: string
  cliente_id: string | null
  titulo: string | null
  descricao: string | null
  valor: number | null
  validade: string | null // 'YYYY-MM-DD'
  foto_path: string | null // bucket 'publico'
  resolvida: boolean // M-037: arquivada em "Acompanhar" (reversível)
  modo_preco: ModoPreco | null // I3: null = proposta antiga (app infere 'fechado')
  condicoes: string | null // I4: condições daquela proposta (texto livre)
  token: string | null // F2b: chave do link público (nasce só ao compartilhar)
  criado_em: string
}

export type CamposProposta = {
  titulo: string
  descricao: string
  valor: number | null
  validade: string | null
  foto_path: string | null
  modo_preco: ModoPreco
  condicoes: string | null
}

const COLUNAS =
  'id, cliente_id, titulo, descricao, valor, validade, foto_path, resolvida, modo_preco, condicoes, token, criado_em'

/**
 * F2b · Token aleatório forte e legível em URL (sem caracteres ambíguos).
 * Mesmo alfabeto do link de seleção (M-022) — chave do link público da proposta.
 */
function gerarToken(): string {
  const alfabeto = 'abcdefghijkmnpqrstuvwxyz23456789' // sem l/o/0/1
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  let s = ''
  for (const b of bytes) s += alfabeto[b % alfabeto.length]
  return s
}

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
          modo_preco: campos.modo_preco,
          condicoes: campos.condicoes,
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
          modo_preco: campos.modo_preco,
          condicoes: campos.condicoes,
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

  /**
   * F2b · Garante o token do link público: reusa se já existe, cria e grava se
   * não (decisão B — sem expiração; o que fecha o link é `resolvida`). Devolve
   * o token, ou null se falhar.
   */
  async function garantirToken(id: string): Promise<string | null> {
    const atual = propostas.find((p) => p.id === id)
    if (atual?.token) return atual.token
    const token = gerarToken()
    const { data, error } = await supabase
      .from('propostas')
      .update({ token })
      .eq('id', id)
      .select('token')
      .single()
    if (error || !data) return null
    const tk = (data as { token: string }).token
    setPropostas((prev) => prev.map((p) => (p.id === id ? { ...p, token: tk } : p)))
    return tk
  }

  async function excluir(proposta: Proposta): Promise<string | null> {
    // F2b · reúne as cópias públicas geradas para o link (nas referências) antes
    // do cascade, para removê-las do storage junto com a capa.
    const { data: refs } = await supabase
      .from('proposta_referencias')
      .select('foto_publica_path')
      .eq('proposta_id', proposta.id)
    const copias = (refs ?? [])
      .map((r) => (r as { foto_publica_path: string | null }).foto_publica_path)
      .filter((p): p is string => !!p)

    const { error } = await supabase.from('propostas').delete().eq('id', proposta.id)
    if (error) return 'Falha ao excluir: ' + error.message
    const aRemover = [...copias]
    if (proposta.foto_path) aRemover.push(proposta.foto_path)
    if (aRemover.length) await supabase.storage.from('publico').remove(aRemover)
    setPropostas((prev) => prev.filter((p) => p.id !== proposta.id))
    return null
  }

  return { propostas, carregando, salvando, listar, porCliente, buscarPorId, subirFoto, criar, atualizar, marcarResolvida, garantirToken, excluir }
}
