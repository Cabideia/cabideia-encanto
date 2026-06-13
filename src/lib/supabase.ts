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
  anon ?? 'anon-key-ausente',
  {
    auth: {
      // Fluxo PKCE: o Google volta com ?code=... que trocamos por sessão na
      // rota /entrar. Mais seguro e estável que o fluxo implícito por hash.
      flowType: 'pkce',
      // Detecta e processa o código/token presentes na URL ao carregar o app
      // (era o que faltava: sem isso a sessão chegava e era descartada).
      detectSessionInUrl: true,
      // Mantém a sessão entre recarregamentos (localStorage) e renova sozinha.
      persistSession: true,
      autoRefreshToken: true
    }
  }
)
