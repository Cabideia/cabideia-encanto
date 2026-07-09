-- ============================================================
-- M-042 · Referências do pedido (Opção A · pedido_referencias)
-- JÁ APLICADA em produção pela gestão (migration aplicada fora deste repo).
-- Este arquivo existe para PARIDADE de histórico — NÃO reaplicar.
-- Reflete exatamente o objeto em produção (introspecção do schema).
-- ------------------------------------------------------------
-- Uma referência liga um PEDIDO a um item de origem única: OU um trabalho
-- (Meus Trabalhos) OU uma inspiração (galeria). O shape espelha `selecao_itens`
-- (origem trabalho|inspiração via qual FK está preenchida + `ordem`) para a
-- Fase 2 copiar as referências da proposta ao converter em pedido.
--
-- RLS: sem coluna `usuaria_id`. A posse é derivada do pedido (subquery em
-- `pedidos`), no mesmo padrão de `dona_trabalho_tags`/`dona_inspiracao_tags`.
-- Leitura anônima: bloqueada pela própria policy (anon não tem auth.uid());
-- não foi feito um `revoke ... from anon` à parte (diferente de selecao_itens).
-- ============================================================

create table public.pedido_referencias (
  id            uuid primary key default gen_random_uuid(),
  pedido_id     uuid not null references public.pedidos     (id) on delete cascade,
  trabalho_id   uuid          references public.trabalhos   (id) on delete cascade,
  inspiracao_id uuid          references public.inspiracoes (id) on delete cascade,
  ordem         integer not null default 0,
  criado_em     timestamptz not null default now(),
  -- origem única: exatamente UMA das duas FKs preenchida (trabalho XOR inspiração)
  constraint origem_unica check (
    ((trabalho_id is not null)::integer + (inspiracao_id is not null)::integer) = 1
  )
);

create index idx_pedido_referencias_pedido
  on public.pedido_referencias (pedido_id);

alter table public.pedido_referencias enable row level security;

-- Dona: só mexe nas referências de pedidos que são dela.
create policy dona_pedido_referencias on public.pedido_referencias
  for all
  using (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_referencias.pedido_id and p.usuaria_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_referencias.pedido_id and p.usuaria_id = auth.uid()
    )
  );
