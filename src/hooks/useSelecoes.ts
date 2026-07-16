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
  resolvida: boolean // M-037: arquivada em "Acompanhar" (reversível)
  qtd: number
}

/**
 * Item a entrar numa seleção. Vem de duas origens (M-022 estendido):
 * Meus Trabalhos (bucket público) ou Inspirações (bucket privado).
 * Para inspirações com imagem, passamos `fotoPathPrivado` para gerar uma cópia
 * pública (o link da cliente não tem login e não enxerga o bucket privado).
 */
export type ItemSelecao = {
  origem: 'trabalho' | 'inspiracao'
  id: string
  fotoPathPrivado?: string | null
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
      .select('id, token, titulo, mensagem, expira_em, criado_em, resolvida, selecao_itens(id)')
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
        resolvida: !!s.resolvida,
        qtd: (s.selecao_itens ?? []).length,
      }))
    )
    setCarregando(false)
  }, [usuariaId])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * Copia uma imagem do bucket privado 'inspiracoes' para o bucket público,
   * para que ela apareça no link público da seleção. Devolve o caminho público
   * (ou null se a cópia falhar — aí o item entra sem imagem).
   */
  async function copiarParaPublico(pathPrivado: string): Promise<string | null> {
    if (!usuariaId) return null
    const { data, error } = await supabase.storage.from('inspiracoes').download(pathPrivado)
    if (error || !data) return null
    const novo = `${usuariaId}/sel/${crypto.randomUUID()}.jpg`
    const { error: upErro } = await supabase.storage
      .from('publico')
      .upload(novo, data, { contentType: 'image/jpeg', upsert: false })
    if (upErro) return null
    return novo
  }

  /** Cria a seleção e seus itens (multi-origem). Devolve o token (ou um erro). */
  async function criar(
    itens: ItemSelecao[],
    titulo: string,
    mensagem: string
  ): Promise<{ token: string } | { erro: string }> {
    if (estaOffline()) return { erro: SEM_CONEXAO }
    if (!usuariaId) return { erro: 'Sessão expirada. Entre de novo.' }
    if (itens.length === 0) return { erro: 'Selecione ao menos um item.' }

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
    const selecaoId = (sel as { id: string }).id

    // Gera as cópias públicas das inspirações (com imagem) antes de inserir.
    const linhas = await Promise.all(
      itens.map(async (item, i) => {
        const ehInsp = item.origem === 'inspiracao'
        const fotoPublica =
          ehInsp && item.fotoPathPrivado ? await copiarParaPublico(item.fotoPathPrivado) : null
        return {
          selecao_id: selecaoId,
          trabalho_id: ehInsp ? null : item.id,
          inspiracao_id: ehInsp ? item.id : null,
          foto_publica_path: fotoPublica,
          ordem: i,
        }
      })
    )

    const { error: e2 } = await supabase.from('selecao_itens').insert(linhas)
    if (e2) {
      // desfaz a seleção se os itens falharem (cascade remove o que entrou)
      const orfas = linhas.map((l) => l.foto_publica_path).filter((p): p is string => !!p)
      if (orfas.length) await supabase.storage.from('publico').remove(orfas)
      await supabase.from('selecoes').delete().eq('id', selecaoId)
      return { erro: 'Falha ao montar a seleção: ' + e2.message }
    }

    await carregar()
    return { token: (sel as { token: string }).token }
  }

  /** Apaga uma seleção — revoga o link na hora (cascade nos itens) e limpa as cópias. */
  async function apagar(id: string): Promise<string | null> {
    if (estaOffline()) return SEM_CONEXAO
    // Remove as cópias públicas geradas para esta seleção (só as de inspiração).
    const { data: itens } = await supabase
      .from('selecao_itens')
      .select('foto_publica_path')
      .eq('selecao_id', id)
    const copias = (itens ?? [])
      .map((it) => (it as { foto_publica_path: string | null }).foto_publica_path)
      .filter((p): p is string => !!p)

    const { error } = await supabase.from('selecoes').delete().eq('id', id)
    if (error) return 'Falha ao apagar: ' + error.message
    if (copias.length) await supabase.storage.from('publico').remove(copias)
    setSelecoes((prev) => prev.filter((s) => s.id !== id))
    return null
  }

  /**
   * M-037 · "Marcar como resolvido" (arquivar) — diferente da lixeira:
   * o link continua existindo (reversível), só sai da aba ativa de Acompanhar.
   */
  async function marcarResolvida(id: string, resolvida: boolean): Promise<string | null> {
    const { error } = await supabase.from('selecoes').update({ resolvida }).eq('id', id)
    if (error) return 'Falha ao atualizar: ' + error.message
    setSelecoes((prev) => prev.map((s) => (s.id === id ? { ...s, resolvida } : s)))
    return null
  }

  return { selecoes, carregando, criar, apagar, marcarResolvida }
}
