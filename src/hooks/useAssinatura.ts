import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type PlanoAssinatura = 'gratis' | 'vitrine'

/** Limite de imagens do plano Grátis (trabalhos + inspirações-imagem + referências). */
export const LIMITE_GRATIS = 150

/**
 * M-011 · Estado do plano + uso de imagens.
 *
 * Lê a linha de `assinaturas` da usuária (RLS: SELECT-only para a dona) e o total
 * de imagens via RPC `total_imagens_usuaria`. Fallback robusto: sem linha em
 * `assinaturas` (ex.: conta antiga) trata como `gratis`/`ativa`.
 *
 * A escrita de plano vem do Play Billing (M-018) — o app NUNCA grava aqui.
 */
export function useAssinatura(usuariaId: string | undefined) {
  const [plano, setPlano] = useState<PlanoAssinatura>('gratis')
  const [fundadora, setFundadora] = useState(false)
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (!usuariaId) return
    setCarregando(true)

    // Assinatura — fallback: ausência de linha = gratis/ativa.
    const { data: a } = await supabase
      .from('assinaturas')
      .select('plano, fundadora')
      .eq('usuaria_id', usuariaId)
      .maybeSingle()
    setPlano(((a?.plano as PlanoAssinatura | undefined) ?? 'gratis'))
    setFundadora(a?.fundadora ?? false)

    // Total de imagens (trabalhos + inspirações-imagem + referências de pedido).
    const { data: t } = await supabase.rpc('total_imagens_usuaria', { uid: usuariaId })
    setTotal(typeof t === 'number' ? t : 0)

    setCarregando(false)
  }, [usuariaId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const ilimitado = fundadora || plano === 'vitrine'
  const podeAdicionar = ilimitado || total < LIMITE_GRATIS
  const emExcedente = !ilimitado && total > LIMITE_GRATIS

  return {
    plano,
    fundadora,
    total,
    limite: LIMITE_GRATIS,
    ilimitado,
    podeAdicionar,
    emExcedente,
    carregando,
    recarregar: carregar,
  }
}
