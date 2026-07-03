// ============================================================
// EDGE FUNCTION · mercadopago-webhook
// ------------------------------------------------------------
// Recebe as notificações do Mercado Pago quando um pagamento muda de estado.
// Modelo: Pix avulso anual R$ 199 (Decisão da auditoria 360).
//
// Segurança e robustez (o que o dossiê pedia e não existia):
//   1. VALIDAÇÃO HMAC-SHA256 do header `x-signature` (esquema oficial do MP).
//      Sem assinatura válida → 401, nada é processado.
//   2. IDEMPOTÊNCIA: a tabela `pagamentos` tem o id do pagamento como PK.
//      `insert ... on conflict do nothing` garante que o mesmo evento
//      (o MP reenvia várias vezes) só ativa a assinatura UMA vez.
//   3. CONFIRMAÇÃO NA FONTE: nunca confiamos no corpo do webhook para o valor
//      /status. Buscamos o pagamento na API do MP com o access token e só
//      ativamos se status == 'approved'.
//
// Vínculo conta↔pagamento: `external_reference` = usuaria_id (setado na
// criação do pagamento pela função `criar-pagamento`).
//
// IMPORTANTE: esta função NÃO usa `verify_jwt` (o MP não manda JWT). Configure
// `--no-verify-jwt` no deploy. A autenticação é a assinatura HMAC.
//
// Secrets necessários (supabase secrets set):
//   MP_ACCESS_TOKEN      · access token do Mercado Pago (produção ou teste)
//   MP_WEBHOOK_SECRET    · "Assinatura secreta" do webhook (painel do MP)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY · já existentes no projeto
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const VALOR_ANUAL = 199 // R$ — valor esperado do Pix anual
const MESES_ACESSO = 12

function json(status: number, corpo: Record<string, unknown>): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** HMAC-SHA256 → hex. */
async function hmacHex(secret: string, mensagem: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(mensagem))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Comparação em tempo constante (evita timing attack na assinatura). */
function igualdadeSegura(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let dif = 0
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return dif === 0
}

/**
 * Valida o header `x-signature` do Mercado Pago.
 * Manifesto assinado: `id:{data.id};request-id:{x-request-id};ts:{ts};`
 * (campos ausentes são omitidos, conforme a doc do MP).
 */
async function assinaturaValida(req: Request, dataId: string, secret: string): Promise<boolean> {
  const xSignature = req.headers.get('x-signature')
  const xRequestId = req.headers.get('x-request-id')
  if (!xSignature) return false

  let ts = ''
  let v1 = ''
  for (const parte of xSignature.split(',')) {
    const [k, v] = parte.split('=').map((s) => s.trim())
    if (k === 'ts') ts = v
    else if (k === 'v1') v1 = v
  }
  if (!ts || !v1) return false

  let manifesto = ''
  if (dataId) manifesto += `id:${dataId.toLowerCase()};`
  if (xRequestId) manifesto += `request-id:${xRequestId};`
  manifesto += `ts:${ts};`

  const esperado = await hmacHex(secret, manifesto)
  return igualdadeSegura(esperado, v1)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { erro: 'metodo_nao_permitido' })

  const accessToken = Deno.env.get('MP_ACCESS_TOKEN')
  const webhookSecret = Deno.env.get('MP_WEBHOOK_SECRET')
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!accessToken || !webhookSecret || !url || !serviceKey) {
    console.error('[mp-webhook] secrets ausentes')
    return json(500, { erro: 'config_ausente' })
  }

  // O MP manda o id do recurso em ?data.id=... (e às vezes no corpo).
  const params = new URL(req.url).searchParams
  let dataId = params.get('data.id') ?? params.get('id') ?? ''
  const tipo = params.get('type') ?? params.get('topic') ?? ''

  let corpo: Record<string, unknown> = {}
  try {
    corpo = await req.json()
  } catch {
    // corpo pode vir vazio em alguns testes do painel
  }
  if (!dataId && corpo?.data && typeof corpo.data === 'object') {
    dataId = String((corpo.data as Record<string, unknown>).id ?? '')
  }
  const tipoFinal = tipo || String(corpo?.type ?? '')

  // Só nos importa notificação de pagamento.
  if (tipoFinal && tipoFinal !== 'payment') return json(200, { ignorado: tipoFinal })
  if (!dataId) return json(400, { erro: 'sem_data_id' })

  // 1. Assinatura HMAC
  if (!(await assinaturaValida(req, dataId, webhookSecret))) {
    console.warn('[mp-webhook] assinatura inválida para data.id=', dataId)
    return json(401, { erro: 'assinatura_invalida' })
  }

  // 2. Confirmação na fonte (API do MP)
  const resp = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!resp.ok) {
    console.error('[mp-webhook] falha ao buscar pagamento', dataId, resp.status)
    // 200 para o MP não ficar reenviando um id que não conseguimos ler agora;
    // o próximo evento do mesmo pagamento reprocessa.
    return json(200, { erro: 'pagamento_nao_encontrado' })
  }
  const pg = await resp.json()
  const status = String(pg.status ?? '')
  const usuariaId = String(pg.external_reference ?? '')
  const valor = Number(pg.transaction_amount ?? 0)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // 3. Idempotência: registra o pagamento; se já existia, não ativa de novo.
  const { data: inserido, error: erroIns } = await admin
    .from('pagamentos')
    .insert({ id: String(pg.id), usuaria_id: usuariaId || null, status, valor, raw: pg })
    .select('id')
    .maybeSingle()

  if (erroIns) {
    // Conflito de PK (23505) = evento repetido → já processado.
    if ((erroIns as { code?: string }).code === '23505') {
      return json(200, { ok: true, repetido: true })
    }
    console.error('[mp-webhook] erro ao registrar pagamento:', erroIns.message)
    return json(500, { erro: 'falha_registro' })
  }
  if (!inserido) return json(200, { ok: true, repetido: true })

  // 4. Ativa a assinatura só se aprovado, com valor coerente e conta válida.
  if (status !== 'approved') {
    console.log(`[mp-webhook] pagamento ${pg.id} status=${status} — registrado, sem ativar`)
    return json(200, { ok: true, ativado: false, status })
  }
  if (!usuariaId) {
    console.error('[mp-webhook] pagamento aprovado SEM external_reference:', pg.id)
    return json(200, { ok: true, ativado: false, motivo: 'sem_external_reference' })
  }
  if (valor + 0.01 < VALOR_ANUAL) {
    console.error(`[mp-webhook] valor ${valor} abaixo do esperado (${VALOR_ANUAL}) — não ativa`)
    return json(200, { ok: true, ativado: false, motivo: 'valor_insuficiente' })
  }

  const renovacao = new Date()
  renovacao.setMonth(renovacao.getMonth() + MESES_ACESSO)

  const { error: erroAtiv } = await admin
    .from('assinaturas')
    .update({
      plano: 'vitrine',
      status: 'ativa',
      origem: 'mercadopago',
      purchase_token: String(pg.id),
      renovacao_em: renovacao.toISOString(),
    })
    .eq('usuaria_id', usuariaId)

  if (erroAtiv) {
    console.error('[mp-webhook] falha ao ativar assinatura:', erroAtiv.message)
    return json(500, { erro: 'falha_ativacao' })
  }

  console.log(`[mp-webhook] assinatura ATIVADA usuaria=${usuariaId} pagamento=${pg.id}`)
  return json(200, { ok: true, ativado: true })
})
