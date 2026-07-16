import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { urlPublica } from '../lib/storage'
import { comprimirImagem } from '../lib/imagem'
import { SEM_CONEXAO, estaOffline } from '../lib/conexao'

/**
 * M-017 · Etapa 2 — fotos da vitrine.
 * Carrega, adiciona (com compressão obrigatória) e remove trabalhos marcados
 * para a vitrine. Upload no bucket 'publico' (a vitrine é pública).
 */
export type FotoVitrine = {
  id: string
  foto_publica_path: string
  descricao: string | null
  url: string
}

export function useFotosVitrine(usuariaId: string | undefined) {
  const [fotos, setFotos] = useState<FotoVitrine[]>([])
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)

  const carregar = useCallback(async () => {
    if (!usuariaId) return
    const { data } = await supabase
      .from('trabalhos')
      .select('id, foto_publica_path, descricao')
      .eq('usuaria_id', usuariaId)
      .eq('na_vitrine', true)
      .order('criado_em', { ascending: false })

    const lista: FotoVitrine[] = (data ?? [])
      .filter((t) => t.foto_publica_path)
      .map((t) => ({
        id: t.id,
        foto_publica_path: t.foto_publica_path as string,
        descricao: t.descricao,
        url: urlPublica(t.foto_publica_path as string)
      }))
    setFotos(lista)
    setCarregando(false)
  }, [usuariaId])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Adiciona uma foto: comprime -> sobe no storage -> registra em trabalhos.
  async function adicionar(arquivo: File, descricao: string): Promise<string | null> {
    if (estaOffline()) return SEM_CONEXAO
    if (!usuariaId) return 'Sessão expirada. Entre de novo.'
    setEnviando(true)
    try {
      const { blob } = await comprimirImagem(arquivo)
      // Caminho exigido pela política de storage: {auth.uid()}/{arquivo}
      const nome = `${usuariaId}/${crypto.randomUUID()}.jpg`

      const { error: upErro } = await supabase.storage
        .from('publico')
        .upload(nome, blob, { contentType: 'image/jpeg', upsert: false })
      if (upErro) return 'Falha ao enviar a foto: ' + upErro.message

      const { error: dbErro } = await supabase.from('trabalhos').insert({
        usuaria_id: usuariaId,
        foto_path: nome,            // bucket publico (upload mínimo do M-017)
        foto_publica_path: nome,
        descricao: descricao.trim() || null,
        na_vitrine: true
      })
      if (dbErro) {
        // rollback do arquivo se o registro falhar
        await supabase.storage.from('publico').remove([nome])
        return 'Falha ao salvar a foto: ' + dbErro.message
      }

      await carregar()
      return null
    } catch (e: any) {
      return e?.message || 'Erro inesperado ao processar a imagem.'
    } finally {
      setEnviando(false)
    }
  }

  async function remover(foto: FotoVitrine): Promise<string | null> {
    if (estaOffline()) return SEM_CONEXAO
    if (!usuariaId) return 'Sessão expirada.'
    const { error: dbErro } = await supabase.from('trabalhos').delete().eq('id', foto.id)
    if (dbErro) return 'Falha ao remover: ' + dbErro.message
    await supabase.storage.from('publico').remove([foto.foto_publica_path])
    setFotos((atual) => atual.filter((f) => f.id !== foto.id))
    return null
  }

  return { fotos, carregando, enviando, adicionar, remover }
}
