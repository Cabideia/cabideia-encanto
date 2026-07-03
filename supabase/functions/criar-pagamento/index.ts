// ============================================================
// EDGE FUNCTION · criar-pagamento
// ------------------------------------------------------------
// Cria um pagamento Pix avulso (R$ 199, plano Vitrine anual) no Mercado Pago
// para a usuária AUTENTICADA e devolve os dados do Pix (QR + copia-e-cola)
// para a página de checkout EXTERNA renderizar.
//
// COMPLIANCE: esta função é chamada por uma página web FORA da TWA (modelo
// web-first). O app empacotado na Play Store NÃO deve ter CTA de pagamento
// nem chamar esta função — senão vira venda de bem digital dentro do app.
//
// Vínculo conta↔pagamento: gravamos `external_reference = userId`, que o
// webhook usa para ativar a assinatura certa.
//
// Requer JWT do usuário (Authorization: Bearer). Deploy COM verify_jwt.
//
// Secrets: MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (para
// validar o JWT via getUser).
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const VALOR_ANUAL = 199
const WEBHOOK_URL = Deno.env.get('MP_WEBHOOK_URL') // ex.: https://<ref>.supabase.co/functions/v1/mercadopago-webhook

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { erro: 'metodo_nao_permitido' })

  const accessToken = Deno.env.get('MP_ACCESS_TOKEN')
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!accessToken || !url || !serviceKey) return json(500, { erro: 'config_ausente' })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json(401, { erro: 'sem_token' })

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  const { data: dados, error: erroAuth } = await admin.auth.getUser(jwt)
  const usuario = dados?.user
  if (erroAuth || !usuario) return json(401, { erro: 'token_invalido' })

  // Idempotência de chave: uma chave por tentativa evita duplicar pagamento
  // se a página reenviar. Usa o header padrão do MP.
  const idemKey = `${usuario.id}-${req.headers.get('x-idempotency-key') ?? crypto.randomUUID()}`

  const corpoMP = {
    transaction_amount: VALOR_ANUAL,
    description: 'Cabideia Encanto · Plano Vitrine (12 meses)',
    payment_method_id: 'pix',
    external_reference: usuario.id, // vínculo usado pelo webhook
    notification_url: WEBHOOK_URL,
    payer: { email: usuario.email ?? undefined },
  }

  const resp = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idemKey,
    },
    body: JSON.stringify(corpoMP),
  })

  const pg = await resp.json()
  if (!resp.ok) {
    console.error('[criar-pagamento] MP recusou:', resp.status, JSON.stringify(pg))
    return json(502, { erro: 'falha_mercadopago', detalhe: pg?.message ?? null })
  }

  const poi = pg?.point_of_interaction?.transaction_data ?? {}
  return json(200, {
    pagamento_id: pg.id,
    status: pg.status,
    pix_copia_cola: poi.qr_code ?? null,
    pix_qr_base64: poi.qr_code_base64 ?? null,
    ticket_url: poi.ticket_url ?? null,
  })
})
