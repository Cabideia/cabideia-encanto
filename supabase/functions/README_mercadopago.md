# Cobrança Mercado Pago — Pix avulso anual (R$ 199 · Plano Vitrine)

Modelo **web-first**: a assinatura é vendida e paga **fora** do app (numa página
web, não na TWA da Play Store). O app apenas **honra** quem já pagou, lendo
`assinaturas`. Não há CTA de pagamento dentro do app (compliance Play Store).

## Peças

| Peça | Onde | Estado |
|---|---|---|
| Tabela `pagamentos` (idempotência/auditoria) | banco | ✅ aplicada |
| `assinaturas.origem` default `gratis` | banco | ✅ aplicada |
| Edge Function `mercadopago-webhook` | `functions/` | ⛔ **não deployada** (falta secret) |
| Edge Function `criar-pagamento` | `functions/` | ⛔ **não deployada** (falta secret) |
| Página de checkout externa | fora deste repo | ⛔ a construir |
| App consumption-only (`Planos.tsx` sem CTA) | app | ✅ feito |

## Fluxo

1. Página externa (usuária **logada** no Supabase) chama `criar-pagamento` com o
   JWT → recebe o Pix (copia-e-cola / QR).
2. Usuária paga o Pix. O Mercado Pago chama `mercadopago-webhook`.
3. O webhook valida a **assinatura HMAC-SHA256**, confirma o pagamento na API do
   MP, registra em `pagamentos` (idempotente) e, se `approved` + valor ok, grava
   `plano='vitrine', status='ativa', origem='mercadopago', renovacao_em=+12m` na
   `assinaturas` daquele `external_reference` (= usuaria_id).
4. O app, na próxima leitura de `useAssinatura`, já mostra o plano liberado.

## Passos para ligar (você, com as credenciais)

```bash
# 1. Secrets (NUNCA commitar). Use o access token de TESTE primeiro.
supabase secrets set MP_ACCESS_TOKEN="<access_token_do_mercadopago>"
supabase secrets set MP_WEBHOOK_SECRET="<assinatura_secreta_do_webhook>"
supabase secrets set MP_WEBHOOK_URL="https://chrlexerkurmydavalgd.supabase.co/functions/v1/mercadopago-webhook"

# 2. Deploy. O webhook NÃO pode exigir JWT (o MP não manda um).
supabase functions deploy mercadopago-webhook --no-verify-jwt
supabase functions deploy criar-pagamento

# 3. No painel do Mercado Pago → Webhooks: aponte para a URL do passo 1,
#    evento "Pagamentos", e copie a "assinatura secreta" para MP_WEBHOOK_SECRET.
```

## Teste em sandbox (antes de produção)

1. Access token de **teste** + usuário comprador de teste do MP.
2. Crie um pagamento via `criar-pagamento` e pague o Pix de teste.
3. Confira: linha nova em `pagamentos` e `assinaturas` com `plano='vitrine'`.
4. Reenvie o mesmo evento pelo painel do MP → deve responder `repetido:true` e
   **não** duplicar (idempotência).
5. Envie um evento com assinatura errada → deve responder **401**.

## Pontos em aberto (decisão sua)

- **Renovação anual:** hoje é manual (você reenvia o link ao fim dos 12 meses).
  Um cron/aviso 30 dias antes de `renovacao_em` seria a evolução natural.
- **Página de checkout:** precisa existir fora da TWA (ex.: no domínio raiz).
  As funções acima já entregam tudo que ela precisa consumir.
- **Downgrade automático:** quando `renovacao_em` vencer, algo precisa voltar o
  plano para `gratis`. Sugestão: cron diário. Não implementado ainda.
