import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { aplicarTema, temaSalvo, temaValido, type Tema } from '../lib/tema'

/**
 * Tema da dona (Decisão #9). Carrega de `perfis.tema`, aplica ao documento e
 * persiste localmente (offline-first). `definir` grava no banco e repinta na hora.
 * Começa do tema salvo no boot para não piscar enquanto a rede responde.
 */
export function useTema(uid: string | undefined) {
  const [tema, setTema] = useState<Tema>(() => temaSalvo())
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!uid) return
    supabase
      .from('perfis')
      .select('tema')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data }) => {
        const t = temaValido(data?.tema)
        setTema(t)
        aplicarTema(t)
      })
  }, [uid])

  async function definir(novo: Tema) {
    setTema(novo)
    aplicarTema(novo)
    if (!uid) return
    setSalvando(true)
    await supabase
      .from('perfis')
      .update({ tema: novo, atualizado_em: new Date().toISOString() })
      .eq('id', uid)
    setSalvando(false)
  }

  return { tema, definir, salvando }
}
