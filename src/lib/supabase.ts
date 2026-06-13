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
      // Fluxo PKCE: o Google volta com ?code=... que trocamos por sessão.
      flowType: 'pkce',
      // IMPORTANTE: deixamos a detecção automática DESLIGADA e fazemos a troca
      // do code manualmente na página /entrar (exchangeCodeForSession). Isso
      // evita a corrida em que o app decide a rota antes de a sessão chegar, e
      // evita o problema do StrictMode consumir o code de uso único duas vezes.
      detectSessionInUrl: false,
      // Mantém a sessão entre recarregamentos (localStorage) e renova sozinha.
      persistSession: true,
      autoRefreshToken: true
    }
  }
)
