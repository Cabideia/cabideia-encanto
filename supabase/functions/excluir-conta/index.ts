// ============================================================
// EDGE FUNCTION · excluir-conta (M-033) — 1ª função do projeto
// ------------------------------------------------------------
// Exclusão DEFINITIVA (hard delete) da conta da usuária autenticada.
// Decisões do ciclo: Opção A (Edge Function) · hard delete imediato ·
// confirmação no app digitando EXCLUIR.
//
// Autenticação: o app invoca com o JWT do usuário (Authorization: Bearer).
// Validamos o token com getUser e extraímos o userId — a usuária só pode
// apagar a PRÓPRIA conta.
//
// Sequência OBRIGATÓRIA (não inverter) — ancorada em: Storage + perfis + Auth
//   1. STORAGE — remover tudo sob `${userId}/` nos buckets acervo,
//      inspiracoes e publico. list() do supabase-js NÃO é recursivo:
//      varremos subpastas antes de remove().
//   2. BANCO   — delete from perfis where id = userId. Cascateia as 9
//      tabelas-filhas (anotacoes, assinaturas, cardapio_itens, clientes,
//      inspiracoes, pedidos, selecoes, tags, trabalhos) e, por elas,
//      trabalho_tags / inspiracao_tags / selecao_itens.
//   3. AUTH    — auth.admin.deleteUser(userId). Remove o usuário do Auth
//      e cascateia o que aponta direto para auth.users: o próprio perfis
//      (já apagado) e `propostas` (cuja FK é para auth.users, NÃO para
//      perfis — por isso só sai aqui).
//
// Se a etapa 1 (Storage) ou 2 (Banco) falhar, ABORTAMOS antes de tocar no
// Auth e retornamos erro — assim nunca fica uma conta órfã (login válido
// sem dados). Cada etapa é logada.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const BUCKETS = ['acervo', 'inspiracoes', 'publico'] as const

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, corpo: Record<string, unknown>): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type Admin = ReturnType<typeof createClient>

/**
 * Lista RECURSIVAMENTE todos os objetos sob um prefixo. O list() do
 * supabase-js só devolve um nível: entradas com `id === null` são pastas
 * e precisam ser descidas. Pagina de 1000 em 1000 para prefixos grandes.
 */
async function listarRecursivo(admin: Admin, bucket: string, prefixo: string): Promise<string[]> {
  const caminhos: string[] = []
  const tamanho = 1000
  let offset = 0

  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(prefixo, {
      limit: tamanho,
      offset,
    })
    if (error) throw new Error(`storage.list(${bucket}/${prefixo}): ${error.message}`)
    if (!data || data.length === 0) break

    for (const entrada of data) {
      const caminho = prefixo ? `${prefixo}/${entrada.name}` : entrada.name
      // Pasta: id nulo (sem metadados de arquivo) → descer.
      if (entrada.id === null) {
        const filhos = await listarRecursivo(admin, bucket, caminho)
        caminhos.push(...filhos)
      } else {
        caminhos.push(caminho)
      }
    }

    if (data.length < tamanho) break
    offset += tamanho
  }

  return caminhos
}

/** Apaga todos os objetos do prefixo `${userId}/` em um bucket. */
async function limparBucket(admin: Admin, bucket: string, userId: string): Promise<number> {
  const caminhos = await listarRecursivo(admin, bucket, userId)
  if (caminhos.length === 0) return 0

  // remove() aceita lotes; fatiamos para não estourar limites de payload.
  const lote = 1000
  for (let i = 0; i < caminhos.length; i += lote) {
    const fatia = caminhos.slice(i, i + lote)
    const { error } = await admin.storage.from(bucket).remove(fatia)
    if (error) throw new Error(`storage.remove(${bucket}, ${fatia.length} obj): ${error.message}`)
  }
  return caminhos.length
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { erro: 'metodo_nao_permitido' })

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) {
    console.error('[excluir-conta] secrets ausentes (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
    return json(500, { erro: 'config_ausente' })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json(401, { erro: 'sem_token' })

  // Cliente service role — ignora RLS para varrer Storage e apagar dados.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // 0. Validar o JWT do usuário e descobrir QUEM está pedindo a exclusão.
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  const { data: dadosUsuario, error: erroAuth } = await admin.auth.getUser(jwt)
  const usuario = dadosUsuario?.user
  if (erroAuth || !usuario) {
    console.warn('[excluir-conta] token inválido:', erroAuth?.message)
    return json(401, { erro: 'token_invalido' })
  }
  const userId = usuario.id
  console.log(`[excluir-conta] início userId=${userId}`)

  // 1. STORAGE — varrer e remover tudo sob `${userId}/`.
  try {
    let totalObjetos = 0
    for (const bucket of BUCKETS) {
      const n = await limparBucket(admin, bucket, userId)
      totalObjetos += n
      console.log(`[excluir-conta] storage ${bucket}: ${n} objeto(s) removido(s)`)
    }
    console.log(`[excluir-conta] storage OK — ${totalObjetos} objeto(s) no total`)
  } catch (e) {
    // Falha no Storage → abortar ANTES do Auth (não criar conta órfã).
    console.error('[excluir-conta] FALHA no storage, abortando:', (e as Error).message)
    return json(500, { erro: 'falha_storage', etapa: 'storage' })
  }

  // 2. BANCO — delete from perfis cascateia as 9 tabelas-filhas.
  {
    const { error } = await admin.from('perfis').delete().eq('id', userId)
    if (error) {
      // Falha no banco → abortar ANTES do Auth (não criar conta órfã).
      console.error('[excluir-conta] FALHA ao apagar perfis, abortando:', error.message)
      return json(500, { erro: 'falha_banco', etapa: 'banco' })
    }
    console.log('[excluir-conta] banco OK — perfis e cascata apagados')
  }

  // 3. AUTH — remover o usuário (cascateia `propostas`, que aponta p/ auth.users).
  {
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) {
      // Storage e banco já foram. Aqui não há mais conta órfã de DADOS, mas
      // o login ainda existe — reportamos para reprocessar/observar nos logs.
      console.error('[excluir-conta] FALHA ao apagar do Auth:', error.message)
      return json(500, { erro: 'falha_auth', etapa: 'auth' })
    }
    console.log('[excluir-conta] auth OK — usuário removido')
  }

  console.log(`[excluir-conta] CONCLUÍDO userId=${userId}`)
  return json(200, { ok: true })
})
