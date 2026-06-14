import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Tag = { id: string; nome: string }
export type TagComUso = Tag & { uso: number }

export type Trabalho = {
  id: string
  foto_path: string
  foto_publica_path: string | null
  descricao: string | null
  na_vitrine: boolean
  criado_em: string
  url: string
  tags: Tag[]
}

export function useAcervo(usuariaId: string | undefined) {
  const [trabalhos, setTrabalhos] = useState<Trabalho[]>([])
  const [todasTags, setTodasTags] = useState<Tag[]>([])
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)

  const urlDe = useCallback(
    (path: string) =>
      supabase.storage.from('publico').getPublicUrl(path).data.publicUrl,
    []
  )

  const carregar = useCallback(async () => {
    if (!usuariaId) return
    const { data } = await supabase
      .from('trabalhos')
      .select(
        'id, foto_path, foto_publica_path, descricao, na_vitrine, criado_em, trabalho_tags(tag_id, tags(id, nome))'
      )
      .eq('usuaria_id', usuariaId)
      .order('criado_em', { ascending: false })

    setTrabalhos(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data ?? []).map((t: any) => ({
        id: t.id as string,
        foto_path: t.foto_path as string,
        foto_publica_path: t.foto_publica_path as string | null,
        descricao: t.descricao as string | null,
        na_vitrine: t.na_vitrine as boolean,
        criado_em: t.criado_em as string,
        url: urlDe((t.foto_publica_path ?? t.foto_path) as string),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tags: ((t.trabalho_tags ?? []) as any[])
          .filter((wt) => wt.tags)
          .map((wt) => ({ id: wt.tags.id as string, nome: wt.tags.nome as string })),
      }))
    )
    setCarregando(false)
  }, [usuariaId, urlDe])

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

  // ── Adiciona um trabalho a partir de um BLOB já tratado (recorte+compressão) ──
  async function adicionarBlob(
    blob: Blob,
    descricao: string,
    tagIds: string[]
  ): Promise<string | null> {
    if (!usuariaId) return 'Sessão expirada. Entre de novo.'
    setEnviando(true)
    try {
      const nome = `${usuariaId}/${crypto.randomUUID()}.jpg`

      const { error: upErro } = await supabase.storage
        .from('publico')
        .upload(nome, blob, { contentType: 'image/jpeg', upsert: false })
      if (upErro) return 'Falha ao enviar a foto: ' + upErro.message

      const { data: tData, error: dbErro } = await supabase
        .from('trabalhos')
        .insert({
          usuaria_id: usuariaId,
          foto_path: nome,
          foto_publica_path: nome,
          descricao: descricao.trim() || null,
          na_vitrine: false,
        })
        .select('id')
        .single()

      if (dbErro || !tData) {
        await supabase.storage.from('publico').remove([nome])
        return 'Falha ao salvar: ' + (dbErro?.message ?? 'erro desconhecido')
      }

      if (tagIds.length > 0) {
        await supabase
          .from('trabalho_tags')
          .insert(tagIds.map((tagId) => ({ trabalho_id: (tData as { id: string }).id, tag_id: tagId })))
      }

      await carregar()
      return null
    } catch (e: unknown) {
      return (e as Error)?.message ?? 'Erro inesperado ao processar a imagem.'
    } finally {
      setEnviando(false)
    }
  }

  // ── Remove trabalho do banco e do storage ──
  async function remover(trabalho: Trabalho): Promise<string | null> {
    const { error } = await supabase.from('trabalhos').delete().eq('id', trabalho.id)
    if (error) return 'Falha ao remover: ' + error.message
    const paths = [trabalho.foto_path]
    if (trabalho.foto_publica_path && trabalho.foto_publica_path !== trabalho.foto_path)
      paths.push(trabalho.foto_publica_path)
    await supabase.storage.from('publico').remove(paths)
    setTrabalhos((prev) => prev.filter((t) => t.id !== trabalho.id))
    return null
  }

  // ── Alterna presença na vitrine pública ──
  async function alternarVitrine(trabalho: Trabalho): Promise<string | null> {
    const novo = !trabalho.na_vitrine
    const { error } = await supabase
      .from('trabalhos')
      .update({ na_vitrine: novo })
      .eq('id', trabalho.id)
    if (error) return 'Falha ao atualizar: ' + error.message
    setTrabalhos((prev) =>
      prev.map((t) => (t.id === trabalho.id ? { ...t, na_vitrine: novo } : t))
    )
    return null
  }

  // ── Cria tag nova (ou devolve a existente se nome duplicado) ──
  async function criarTag(nome: string): Promise<Tag | null> {
    if (!usuariaId) return null
    const nomeLimpo = nome.trim().toLowerCase()
    if (!nomeLimpo) return null
    const existente = todasTags.find((t) => t.nome === nomeLimpo)
    if (existente) return existente
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

  // ── Atribui tag a um trabalho (atualização otimista) ──
  async function atribuirTag(trabalhoId: string, tagId: string): Promise<void> {
    await supabase.from('trabalho_tags').insert({ trabalho_id: trabalhoId, tag_id: tagId })
    setTrabalhos((prev) =>
      prev.map((t) => {
        if (t.id !== trabalhoId || t.tags.some((tg) => tg.id === tagId)) return t
        const tag = todasTags.find((tg) => tg.id === tagId)
        return tag ? { ...t, tags: [...t.tags, tag] } : t
      })
    )
  }

  // ── Remove tag de um trabalho (atualização otimista) ──
  async function removerTag(trabalhoId: string, tagId: string): Promise<void> {
    await supabase
      .from('trabalho_tags')
      .delete()
      .eq('trabalho_id', trabalhoId)
      .eq('tag_id', tagId)
    setTrabalhos((prev) =>
      prev.map((t) =>
        t.id === trabalhoId ? { ...t, tags: t.tags.filter((tg) => tg.id !== tagId) } : t
      )
    )
  }

  // ── Renomeia uma tag (vale em todas as fotos onde ela aparece) ──
  async function renomearTag(tagId: string, novoNome: string): Promise<string | null> {
    if (!usuariaId) return 'Sessão expirada.'
    const limpo = novoNome.trim().toLowerCase()
    if (!limpo) return 'Dê um nome à tag.'
    if (todasTags.some((t) => t.nome === limpo && t.id !== tagId))
      return 'Já existe uma tag com esse nome.'
    const { error } = await supabase
      .from('tags')
      .update({ nome: limpo })
      .eq('id', tagId)
      .eq('usuaria_id', usuariaId)
    if (error) return 'Falha ao renomear: ' + error.message
    setTodasTags((prev) =>
      prev.map((t) => (t.id === tagId ? { ...t, nome: limpo } : t)).sort((a, b) => a.nome.localeCompare(b.nome))
    )
    setTrabalhos((prev) =>
      prev.map((t) => ({
        ...t,
        tags: t.tags.map((tg) => (tg.id === tagId ? { ...tg, nome: limpo } : tg)),
      }))
    )
    return null
  }

  // ── Apaga uma tag de vez (on delete cascade tira de todas as fotos) ──
  async function apagarTag(tagId: string): Promise<string | null> {
    if (!usuariaId) return 'Sessão expirada.'
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId)
      .eq('usuaria_id', usuariaId)
    if (error) return 'Falha ao apagar: ' + error.message
    setTodasTags((prev) => prev.filter((t) => t.id !== tagId))
    setTrabalhos((prev) =>
      prev.map((t) => ({ ...t, tags: t.tags.filter((tg) => tg.id !== tagId) }))
    )
    return null
  }

  // ── Tags com contagem de uso (para a tela "Minhas tags") ──
  function tagsComUso(): TagComUso[] {
    const contagem = new Map<string, number>()
    for (const t of trabalhos)
      for (const tg of t.tags) contagem.set(tg.id, (contagem.get(tg.id) ?? 0) + 1)
    return todasTags.map((t) => ({ ...t, uso: contagem.get(t.id) ?? 0 }))
  }

  return {
    trabalhos,
    todasTags,
    carregando,
    enviando,
    adicionarBlob,
    remover,
    alternarVitrine,
    criarTag,
    atribuirTag,
    removerTag,
    renomearTag,
    apagarTag,
    tagsComUso,
  }
}
