import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SEM_CONEXAO, estaOffline } from '../lib/conexao'
import type { Tag } from './useAcervo'

export type TipoInspiracao = 'imagem' | 'link'

export type Inspiracao = {
  id: string
  tipo: TipoInspiracao
  foto_path: string | null // bucket privado 'inspiracoes' (imagem ou capa do link)
  fotoUrl: string | null // URL assinada já resolvida para exibição
  url: string | null // se tipo = link
  nota: string | null
  codigo_num: number | null // código curto exibido como I-{n}
  criado_em: string
  tags: Tag[]
}

export type CamposInspiracao = {
  tipo: TipoInspiracao
  foto_path: string | null
  url: string | null
  nota: string | null
  tagIds: string[]
}

/** Domínio "limpo" de uma URL (ex.: pinterest.com), com fallback para o texto cru. */
export function dominioDe(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * M-007 · Inspirações (galeria, sem IA).
 * CRUD sobre `inspiracoes` + tags compartilhadas com o acervo (tabela `tags`).
 * Imagens vão para o bucket privado `inspiracoes/{uid}/...` e são exibidas via
 * URL assinada — mesma regra de path do acervo (1º segmento = auth.uid()).
 */
export function useInspiracoes(usuariaId: string | undefined) {
  const [inspiracoes, setInspiracoes] = useState<Inspiracao[]>([])
  const [todasTags, setTodasTags] = useState<Tag[]>([])
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)

  // ── listar(): com tags; assina as URLs das fotos (imagens e capas) ──
  const carregar = useCallback(async () => {
    if (!usuariaId) return
    const { data } = await supabase
      .from('inspiracoes')
      .select(
        'id, tipo, foto_path, url, nota, codigo_num, criado_em, inspiracao_tags(tag_id, tags(id, nome))'
      )
      .eq('usuaria_id', usuariaId)
      .order('criado_em', { ascending: false })

    const linhas: Inspiracao[] =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data ?? []).map((i: any) => ({
        id: i.id as string,
        tipo: i.tipo as TipoInspiracao,
        foto_path: i.foto_path as string | null,
        fotoUrl: null,
        url: i.url as string | null,
        nota: i.nota as string | null,
        codigo_num: (i.codigo_num ?? null) as number | null,
        criado_em: i.criado_em as string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tags: ((i.inspiracao_tags ?? []) as any[])
          .filter((it) => it.tags)
          .map((it) => ({ id: it.tags.id as string, nome: it.tags.nome as string })),
      }))

    // Assina em lote as fotos (bucket privado).
    const paths = linhas.map((l) => l.foto_path).filter((p): p is string => !!p)
    if (paths.length > 0) {
      const { data: assinadas } = await supabase.storage
        .from('inspiracoes')
        .createSignedUrls(paths, 3600)
      const mapa = new Map<string, string>()
      for (const a of assinadas ?? [])
        if (a.path && a.signedUrl) mapa.set(a.path, a.signedUrl)
      for (const l of linhas) if (l.foto_path) l.fotoUrl = mapa.get(l.foto_path) ?? null
    }

    setInspiracoes(linhas)
    setCarregando(false)
  }, [usuariaId])

  const carregarTags = useCallback(async () => {
    if (!usuariaId) return
    const { data } = await supabase
      .from('tags')
      .select('id, nome')
      .eq('usuaria_id', usuariaId)
      .order('nome')
    setTodasTags((data ?? []) as Tag[])
  }, [usuariaId])

  useEffect(() => {
    carregar()
    carregarTags()
  }, [carregar, carregarTags])

  // ── buscarPorId(): da lista já carregada ──
  const buscarPorId = useCallback(
    (id: string): Inspiracao | undefined => inspiracoes.find((i) => i.id === id),
    [inspiracoes]
  )

  // ── Sobe uma imagem (já comprimida) no bucket privado 'inspiracoes' ──
  async function subirImagem(blob: Blob): Promise<{ path: string } | { erro: string }> {
    if (estaOffline()) return { erro: SEM_CONEXAO }
    if (!usuariaId) return { erro: 'Sessão expirada. Entre de novo.' }
    const path = `${usuariaId}/${crypto.randomUUID()}.jpg`
    const { error } = await supabase.storage
      .from('inspiracoes')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    if (error) return { erro: 'Falha ao enviar a imagem: ' + error.message }
    return { path }
  }

  // ── Grava as tags de uma inspiração (substitui o conjunto) ──
  async function gravarTags(inspiracaoId: string, tagIds: string[]): Promise<void> {
    await supabase.from('inspiracao_tags').delete().eq('inspiracao_id', inspiracaoId)
    if (tagIds.length > 0)
      await supabase
        .from('inspiracao_tags')
        .insert(tagIds.map((tagId) => ({ inspiracao_id: inspiracaoId, tag_id: tagId })))
  }

  // ── criar() ──
  async function criar(campos: CamposInspiracao): Promise<{ id: string } | { erro: string }> {
    if (estaOffline()) return { erro: SEM_CONEXAO }
    if (!usuariaId) return { erro: 'Sessão expirada. Entre de novo.' }
    setEnviando(true)
    try {
      const { data, error } = await supabase
        .from('inspiracoes')
        .insert({
          usuaria_id: usuariaId,
          tipo: campos.tipo,
          foto_path: campos.foto_path,
          url: campos.url,
          nota: campos.nota?.trim() || null,
        })
        .select('id')
        .single()
      if (error || !data) {
        // desfaz o upload órfão, se houve
        if (campos.foto_path)
          await supabase.storage.from('inspiracoes').remove([campos.foto_path])
        return { erro: 'Falha ao salvar: ' + (error?.message ?? 'erro desconhecido') }
      }
      const id = (data as { id: string }).id
      await gravarTags(id, campos.tagIds)
      await carregar()
      return { id }
    } finally {
      setEnviando(false)
    }
  }

  // ── atualizar() ──
  async function atualizar(
    id: string,
    campos: CamposInspiracao,
    fotoAntiga: string | null
  ): Promise<string | null> {
    if (estaOffline()) return SEM_CONEXAO
    setEnviando(true)
    try {
      const { error } = await supabase
        .from('inspiracoes')
        .update({
          tipo: campos.tipo,
          foto_path: campos.foto_path,
          url: campos.url,
          nota: campos.nota?.trim() || null,
        })
        .eq('id', id)
      if (error) return 'Falha ao salvar: ' + error.message
      await gravarTags(id, campos.tagIds)
      // Remove a foto antiga do storage se foi trocada/retirada.
      if (fotoAntiga && fotoAntiga !== campos.foto_path)
        await supabase.storage.from('inspiracoes').remove([fotoAntiga])
      await carregar()
      return null
    } finally {
      setEnviando(false)
    }
  }

  // ── excluir(): apaga a linha e, se houver, a foto do storage ──
  async function excluir(inspiracao: Inspiracao): Promise<string | null> {
    if (estaOffline()) return SEM_CONEXAO
    const { error } = await supabase.from('inspiracoes').delete().eq('id', inspiracao.id)
    if (error) return 'Falha ao excluir: ' + error.message
    if (inspiracao.foto_path)
      await supabase.storage.from('inspiracoes').remove([inspiracao.foto_path])
    setInspiracoes((prev) => prev.filter((i) => i.id !== inspiracao.id))
    return null
  }

  // ── Tags ──────────────────────────────────────────────────────────────
  // Reaproveita a tabela `tags` (mesmo conjunto do acervo): nunca duplica.

  async function criarTag(nome: string): Promise<Tag | null> {
    if (!usuariaId) return null
    const nomeLimpo = nome.trim().toLowerCase()
    if (!nomeLimpo) return null
    const existente = todasTags.find((t) => t.nome === nomeLimpo)
    if (existente) return existente
    if (estaOffline()) return null
    const { data, error } = await supabase
      .from('tags')
      .insert({ usuaria_id: usuariaId, nome: nomeLimpo })
      .select('id, nome')
      .single()
    if (error || !data) return null
    const tag = data as Tag
    setTodasTags((prev) => [...prev, tag].sort((a, b) => a.nome.localeCompare(b.nome)))
    return tag
  }

  // Atribui/remove tag direto numa inspiração existente (atualização otimista).
  async function atribuirTag(inspiracaoId: string, tagId: string): Promise<void> {
    if (estaOffline()) return
    await supabase.from('inspiracao_tags').insert({ inspiracao_id: inspiracaoId, tag_id: tagId })
    setInspiracoes((prev) =>
      prev.map((i) => {
        if (i.id !== inspiracaoId || i.tags.some((tg) => tg.id === tagId)) return i
        const tag = todasTags.find((tg) => tg.id === tagId)
        return tag ? { ...i, tags: [...i.tags, tag] } : i
      })
    )
  }

  async function removerTag(inspiracaoId: string, tagId: string): Promise<void> {
    if (estaOffline()) return
    await supabase
      .from('inspiracao_tags')
      .delete()
      .eq('inspiracao_id', inspiracaoId)
      .eq('tag_id', tagId)
    setInspiracoes((prev) =>
      prev.map((i) =>
        i.id === inspiracaoId ? { ...i, tags: i.tags.filter((tg) => tg.id !== tagId) } : i
      )
    )
  }

  return {
    inspiracoes,
    todasTags,
    carregando,
    enviando,
    buscarPorId,
    subirImagem,
    criar,
    atualizar,
    excluir,
    criarTag,
    atribuirTag,
    removerTag,
  }
}
