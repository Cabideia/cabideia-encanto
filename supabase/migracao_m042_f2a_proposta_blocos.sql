-- ============================================================
-- M-042 · F2a · Blocos da proposta reformulada
-- JÁ APLICADA em produção pela gestão (migration aplicada fora deste repo).
-- Este arquivo existe para PARIDADE de histórico — NÃO reaplicar.
-- Reflete exatamente os objetos em produção (introspecção do schema).
-- ------------------------------------------------------------
-- Três blocos novos, todos pendurados na PROPOSTA (não no pedido):
--   1. proposta_referencias — espelho de pedido_referencias (I5): fotos de
--      origem única (trabalho XOR inspiração) + `ordem`, posse derivada da
--      proposta (subquery em `propostas`).
--   2. proposta_itens — itens do cardápio OFERTADOS, com SNAPSHOT de nome/preço
--      congelado no momento da oferta. O `cardapio_item_id` é só rastro de
--      origem (SET NULL se o item some do cardápio); a exibição usa o snapshot,
--      NÃO relê o preço vivo de `cardapio_itens`.
--   3. perfis.condicoes_padrao + propostas.condicoes — condições reutilizáveis.
--
-- RLS: nenhuma das tabelas tem `usuaria_id`. A posse é derivada da proposta
-- (subquery em `propostas`), no mesmo padrão de `pedido_referencias` (I5) e de
-- `dona_trabalho_tags`/`dona_inspiracao_tags`. Leitura anônima fica bloqueada
-- pela própria policy (anon não tem auth.uid()).
-- ============================================================

-- ---------- 1 · Referências da proposta (espelho de pedido_referencias) ----------
create table public.proposta_referencias (
  id            uuid primary key default gen_random_uuid(),
  proposta_id   uuid not null references public.propostas   (id) on delete cascade,
  trabalho_id   uuid          references public.trabalhos   (id) on delete cascade,
  inspiracao_id uuid          references public.inspiracoes (id) on delete cascade,
  ordem         integer not null default 0,
  criado_em     timestamptz not null default now(),
  -- origem única: exatamente UMA das duas FKs preenchida (trabalho XOR inspiração)
  constraint origem_unica_proposta check (
    ((trabalho_id is not null)::integer + (inspiracao_id is not null)::integer) = 1
  )
);

create index idx_proposta_referencias_proposta
  on public.proposta_referencias (proposta_id);

alter table public.proposta_referencias enable row level security;

-- Dona: só mexe nas referências de propostas que são dela.
create policy dona_proposta_referencias on public.proposta_referencias
  for all
  using (
    exists (
      select 1 from public.propostas p
      where p.id = proposta_referencias.proposta_id and p.usuaria_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.propostas p
      where p.id = proposta_referencias.proposta_id and p.usuaria_id = auth.uid()
    )
  );

-- ---------- 2 · Itens da proposta (snapshot do cardápio) ----------
-- nome_snapshot é obrigatório (o que foi ofertado, congelado); preco_snapshot
-- pode ser nulo (item sem preço / "sob consulta" no momento da oferta).
create table public.proposta_itens (
  id               uuid primary key default gen_random_uuid(),
  proposta_id      uuid not null references public.propostas      (id) on delete cascade,
  cardapio_item_id uuid          references public.cardapio_itens (id) on delete set null,
  nome_snapshot    text not null,
  preco_snapshot   numeric,
  ordem            integer not null default 0,
  criado_em        timestamptz not null default now()
);

create index idx_proposta_itens_proposta
  on public.proposta_itens (proposta_id);

alter table public.proposta_itens enable row level security;

-- Dona: só mexe nos itens de propostas que são dela.
create policy dona_proposta_itens on public.proposta_itens
  for all
  using (
    exists (
      select 1 from public.propostas p
      where p.id = proposta_itens.proposta_id and p.usuaria_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.propostas p
      where p.id = proposta_itens.proposta_id and p.usuaria_id = auth.uid()
    )
  );

-- ---------- 3 · Condições reutilizáveis ----------
-- condicoes_padrao no perfil (o texto que nasce em toda nova proposta) e
-- condicoes na proposta (o texto daquela proposta específica).
alter table public.perfis    add column if not exists condicoes_padrao text;
alter table public.propostas add column if not exists condicoes        text;

-- ---------- 4 · Modo de preço (I3) ----------
-- Sinaliza qual dos 3 modos a proposta exibe: valor fechado, itens do cardápio
-- ou sem preço. Nulável (propostas antigas caem em 'fechado' por inferência no
-- app). É só um seletor de exibição — valor e itens podem coexistir no banco;
-- alternar o modo NÃO apaga dado.
alter table public.propostas add column if not exists modo_preco text
  check (modo_preco is null or modo_preco in ('fechado','itens','sem'));
