-- ============================================================
-- Auditoria 360 — trilho de cobrança Mercado Pago (Pix avulso anual R$199)
-- Aplicada em produção via migration `auditoria_mercadopago_pagamentos_e_origem`.
-- ------------------------------------------------------------
-- `pagamentos`: chave = id do pagamento no Mercado Pago → dá IDEMPOTÊNCIA ao
-- webhook (o MP reenvia o mesmo evento; ativa a assinatura só 1x). Trancada:
-- RLS ligada e SEM policies + revoke → só service_role (Edge Function) acessa.
-- on delete set null preserva o registro financeiro se a conta for excluída.
--
-- `assinaturas.origem` deixa de ter default 'play_billing' (vestígio do trilho
-- antigo). Conta grátis nasce com 'gratis'; o webhook grava 'mercadopago'.
-- ============================================================

create table if not exists public.pagamentos (
  id           text primary key,          -- payment id do Mercado Pago
  usuaria_id   uuid references public.perfis(id) on delete set null,
  status       text not null,
  valor        numeric,
  raw          jsonb,
  criado_em    timestamptz not null default now()
);

alter table public.pagamentos enable row level security;
revoke all on public.pagamentos from anon, authenticated;

alter table public.assinaturas alter column origem set default 'gratis';
