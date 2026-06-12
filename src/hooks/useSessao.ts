import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/** Estado de autenticação compartilhado por todo o app. */
export function useSessao() {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      setCarregando(false)
    })
    const { data: ouvinte } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSessao(s)
    })
    return () => ouvinte.subscription.unsubscribe()
  }, [])

  return { sessao, carregando }
}
