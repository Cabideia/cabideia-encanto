-- ============================================================
-- M-039 · Converter proposta em pedido
-- Aplicada em produção via migration `m039_proposta_para_pedido`.
-- Este arquivo existe para paridade de histórico no repo — NÃO reaplicar.
-- ------------------------------------------------------------
-- valor: valor opcional do pedido (Decisão #22). Só exibição — sem somas,
--   totais ou gráficos (financeiro segue fora do MVP: M-004/M-005 DEFERRED).
-- proposta_id: vínculo pedido → proposta ("Virar pedido"). O selo "Virou
--   pedido" e o botão "Ver pedido" derivam desta coluna — não existe coluna
--   nova em propostas. RLS existente (dona_pedidos) já cobre as colunas novas.
-- ============================================================

alter table public.pedidos add column if not exists valor numeric null;
alter table public.pedidos add column if not exists proposta_id uuid null
  references public.propostas(id) on delete set null;
