import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SEM_CONEXAO, estaOffline } from '../lib/conexao'

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
 * Normaliza um número para guardar: só dígitos, sem o 0 de discagem nacional.
 * Não inventa DDD nem código de país — apenas limpa. Mantém o 55 se já vier
 * (importante para o link wa.me, que precisa do código do país).
 */
export function normalizarWhatsApp(bruto: string): string {
  return (bruto ?? '').replace(/\D/g, '').replace(/^0+/, '')
}

/**
 * Chave canônica para comparar/deduplicar números: além de limpar, descarta o
 * 55 inicial quando o resto já tem cara de número BR completo (10–11 dígitos),
 * para que "+55 11 9..." e "11 9..." sejam tratados como o mesmo contato.
 */
export function chaveWhatsApp(bruto: string): string {
  let n = normalizarWhatsApp(bruto)
  if (n.startsWith('55') && n.length > 11) n = n.slice(2)
  return n
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

  // ── criar() — devolve o cliente criado (ou um erro) ──
  async function criar(campos: CamposCliente): Promise<{ cliente: Cliente } | { erro: string }> {
    if (estaOffline()) return { erro: SEM_CONEXAO }
    if (!usuariaId) return { erro: 'Sessão expirada. Entre de novo.' }
    const nome = campos.nome.trim()
    if (!nome) return { erro: 'Dê um nome à cliente.' }
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
      if (error || !data) return { erro: 'Falha ao salvar: ' + (error?.message ?? 'erro desconhecido') }
      const cliente = data as Cliente
      setClientes((prev) =>
        [...prev, cliente].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      )
      return { cliente }
    } finally {
      setSalvando(false)
    }
  }

  // ── importar() — insere em lote (M-031), pulando WhatsApps repetidos ──
  async function importar(
    entradas: { nome: string; whatsapp: string }[]
  ): Promise<{ adicionados: number; pulados: number } | { erro: string }> {
    if (!usuariaId) return { erro: 'Sessão expirada. Entre de novo.' }
    // WhatsApps que a usuária já tem, em forma canônica, para dedup.
    const existentes = new Set(
      clientes.map((c) => chaveWhatsApp(c.whatsapp ?? '')).filter(Boolean)
    )
    const vistos = new Set<string>()
    const novos: { usuaria_id: string; nome: string; whatsapp: string | null; nota: null }[] = []
    let pulados = 0
    for (const e of entradas) {
      const nome = e.nome.trim()
      if (!nome) continue // ignora entradas sem nome
      const chave = chaveWhatsApp(e.whatsapp)
      // só deduplica por número; sem número, não há como comparar → entra
      if (chave && (existentes.has(chave) || vistos.has(chave))) {
        pulados++
        continue
      }
      if (chave) vistos.add(chave)
      novos.push({ usuaria_id: usuariaId, nome, whatsapp: normalizarWhatsApp(e.whatsapp) || null, nota: null })
    }
    if (novos.length === 0) return { adicionados: 0, pulados }
    setSalvando(true)
    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert(novos)
        .select('id, nome, whatsapp, nota, criado_em')
      if (error || !data) return { erro: 'Falha ao importar: ' + (error?.message ?? 'erro desconhecido') }
      setClientes((prev) =>
        [...prev, ...(data as Cliente[])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      )
      return { adicionados: data.length, pulados }
    } finally {
      setSalvando(false)
    }
  }

  // ── atualizar() ──
  async function atualizar(id: string, campos: CamposCliente): Promise<string | null> {
    if (estaOffline()) return SEM_CONEXAO
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
    if (estaOffline()) return SEM_CONEXAO
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
    importar,
    atualizar,
    excluir,
  }
}
