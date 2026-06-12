import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anon) {
  // Em desenvolvimento sem .env, avisa em vez de quebrar com tela branca
  console.warn(
    '[Cabideia Encanto] VITE_SUPABASE_URL/ANON_KEY ausentes. Copie .env.example para .env.'
  )
}

export const supabase = createClient(
  url ?? 'http://localhost:54321',
  anon ?? 'anon-key-ausente'
)
