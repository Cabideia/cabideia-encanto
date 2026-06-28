import { supabase } from './supabase'

/**
 * Bucket público — logos do perfil + cópias das fotos publicadas na vitrine.
 *
 * Centraliza a geração da URL pública num único helper. Antes cada tela montava
 * a URL na mão (`supabase.storage.from('publico').getPublicUrl(...)`), o que abre
 * espaço para divergência e bug futuro (ex.: trocar o nome do bucket). Use sempre
 * `urlPublica()` para resolver o caminho de um arquivo no bucket público.
 */
export const BUCKET_PUBLICO = 'publico'

/** Resolve a URL pública de um arquivo no bucket 'publico'. */
export function urlPublica(path: string): string {
  return supabase.storage.from(BUCKET_PUBLICO).getPublicUrl(path).data.publicUrl
}
