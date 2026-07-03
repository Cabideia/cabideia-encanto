-- ============================================================
-- Auditoria 360 — downgrade automático de assinaturas vencidas
-- Aplicada em produção via migration `auditoria_cron_expirar_assinaturas`
-- (+ ajuste de grants abaixo).
-- ------------------------------------------------------------
-- Modelo Pix anual manual: quando renovacao_em vence e a usuária não renovou,
-- a assinatura volta para 'gratis' SEM depender de ela abrir o app. Job diário
-- (pg_cron). Escopo: só origem 'mercadopago' e ativa; NUNCA mexe em fundadora
-- (vitalícia) nem em quem já não está ativa.
--
-- Efeito no produto: a vitrine pública volta a cortar em 150, mas NADA é
-- apagado (corte só na exibição). Ao repagar, o webhook reativa.
-- ============================================================

create extension if not exists pg_cron;

create or replace function public.expirar_assinaturas_vencidas()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare n int;
begin
  update assinaturas
     set plano = 'gratis',
         status = 'expirada',
         atualizado_em = now()
   where origem = 'mercadopago'
     and status = 'ativa'
     and fundadora = false
     and renovacao_em is not null
     and renovacao_em < now();
  get diagnostics n = row_count;
  return n;
end $fn$;

-- Executa só via cron (dono postgres). Revoga de todos os papéis expostos: o
-- Supabase concede EXECUTE direto a anon/authenticated por default privileges,
-- então `revoke from public` não basta.
revoke all    on function public.expirar_assinaturas_vencidas() from public;
revoke execute on function public.expirar_assinaturas_vencidas() from anon, authenticated;

-- Agenda diária às 06:00 UTC (03:00 BRT), idempotente.
select cron.unschedule('expirar-assinaturas-vencidas')
  where exists (select 1 from cron.job where jobname = 'expirar-assinaturas-vencidas');

select cron.schedule(
  'expirar-assinaturas-vencidas',
  '0 6 * * *',
  $$select public.expirar_assinaturas_vencidas()$$
);
