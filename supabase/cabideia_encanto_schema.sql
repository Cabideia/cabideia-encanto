-- ============================================================
-- CABIDEIA ENCANTO — SCHEMA v1 (2026-06-11)
-- Escopo pivotado: acervo + vitrine + inspirações como núcleo;
-- pedido leve em texto livre; SEM financeiro/precificação.
-- Substitui integralmente o encomendei_schema.sql (pré-pivô).
-- Aplicar no SQL Editor do Supabase, em um projeto novo.
-- ============================================================

-- ---------- ENUMS ----------
create type status_pedido as enum ('a_fazer', 'em_producao', 'entregue', 'cancelado');
create type unidade_cardapio as enum ('unidade', 'cento', 'duzia', 'kg', 'fatia');
create type plano_assinatura as enum ('gratis', 'vitrine');
create type status_assinatura as enum ('trial', 'ativa', 'cancelada', 'expirada');
create type tipo_inspiracao as enum ('imagem', 'link');

-- ---------- PERFIS (1:1 com auth.users) ----------
create table perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  nome_negocio text,
  arroba text unique
    check (arroba ~ '^[a-z0-9][a-z0-9._-]{2,29}$'), -- slug da vitrine: /encanto/@arroba
  bio text,
  cidade text,
  nicho text,                       -- doces, crochê, cestas, artesanato, personalizados…
  whatsapp text,                    -- E.164, ex.: +5511999999999
  logo_path text,                   -- storage: bucket 'publico'
  tema text not null default 'oficina'  -- identidade visual (Decisão #9): oficina | vitrine | encanto
    check (tema in ('oficina', 'vitrine', 'encanto')),
  vitrine_publicada boolean not null default false,  -- consentimento explícito (LGPD)
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Perfil criado automaticamente no primeiro login Google.
-- M-011: SEM trial — a conta nasce no plano Grátis (150 imagens). Fundadora e
-- Vitrine-ativa = ilimitado. A troca de plano vem do Play Billing (M-018).
create function criar_perfil_no_cadastro()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  insert into assinaturas (usuaria_id, plano, status)
  values (new.id, 'gratis', 'ativa')
  on conflict (usuaria_id) do nothing;
  return new;
end $$;

create trigger ao_cadastrar
  after insert on auth.users
  for each row execute function criar_perfil_no_cadastro();

-- ---------- TRABALHOS (acervo na nuvem · M-009) ----------
create table trabalhos (
  id uuid primary key default gen_random_uuid(),
  usuaria_id uuid not null references perfis (id) on delete cascade,
  foto_path text not null,          -- storage: bucket 'acervo' (sempre comprimida no cliente)
  foto_publica_path text,           -- cópia no bucket 'publico' quando na_vitrine = true
  descricao text,
  na_vitrine boolean not null default false,
  criado_em timestamptz not null default now()
);
create index trabalhos_por_usuaria on trabalhos (usuaria_id, criado_em desc);

-- ---------- TAGS (busca rápida · diferencial) ----------
create table tags (
  id uuid primary key default gen_random_uuid(),
  usuaria_id uuid not null references perfis (id) on delete cascade,
  nome text not null,
  unique (usuaria_id, nome)
);

create table trabalho_tags (
  trabalho_id uuid not null references trabalhos (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  primary key (trabalho_id, tag_id)
);

-- ---------- INSPIRAÇÕES (M-007) ----------
create table inspiracoes (
  id uuid primary key default gen_random_uuid(),
  usuaria_id uuid not null references perfis (id) on delete cascade,
  tipo tipo_inspiracao not null,
  foto_path text,                   -- storage: bucket 'inspiracoes' (se tipo = imagem)
  url text,                         -- se tipo = link
  nota text,
  criado_em timestamptz not null default now(),
  check (
    (tipo = 'imagem' and foto_path is not null)
    or (tipo = 'link' and url is not null)
  )
);
create index inspiracoes_por_usuaria on inspiracoes (usuaria_id, criado_em desc);

create table inspiracao_tags (
  inspiracao_id uuid not null references inspiracoes (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  primary key (inspiracao_id, tag_id)
);

-- ---------- CLIENTES (M-003 · cadastro enxuto) ----------
create table clientes (
  id uuid primary key default gen_random_uuid(),
  usuaria_id uuid not null references perfis (id) on delete cascade,
  nome text not null,
  whatsapp text,
  nota text,
  criado_em timestamptz not null default now()
);
create index clientes_por_usuaria on clientes (usuaria_id, nome);

-- ---------- PEDIDOS (M-002 · LEVE: texto livre, sem valores, sem itens) ----------
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  usuaria_id uuid not null references perfis (id) on delete cascade,
  cliente_id uuid references clientes (id) on delete set null,
  tema text not null,               -- "100 doces tradicionais — tema unicórnio"
  data_entrega date,
  status status_pedido not null default 'a_fazer',
  foto_referencia_path text,        -- storage: bucket 'acervo'
  inspiracao_id uuid references inspiracoes (id) on delete set null, -- inspiração anexada
  trabalho_id uuid references trabalhos (id) on delete set null,     -- "Entregar → foto vai ao acervo"
  criado_em timestamptz not null default now()
);
create index pedidos_proximas_entregas
  on pedidos (usuaria_id, data_entrega)
  where status in ('a_fazer', 'em_producao'); -- faixa "Próximas entregas" da home

-- ---------- ANOTAÇÕES (M-008) ----------
create table anotacoes (
  id uuid primary key default gen_random_uuid(),
  usuaria_id uuid not null references perfis (id) on delete cascade,
  texto text not null default '',
  atualizado_em timestamptz not null default now()
);

-- ---------- CARDÁPIO (M-015 · prateleira de referência, SEM vínculo com pedido) ----------
-- Cardápio v2: `unidade` virou texto livre (chips são só sugestões), e o item
-- pode ser publicado no cardápio público da vitrine (`na_vitrine`), com preço
-- escondido atrás de "Preço sob consulta" (`preco_sob_consulta`).
create table cardapio_itens (
  id uuid primary key default gen_random_uuid(),
  usuaria_id uuid not null references perfis (id) on delete cascade,
  nome text not null,
  preco_base numeric(10,2),
  unidade text,                                      -- texto livre, opcional
  detalhes text,                                     -- descrição opcional do item
  na_vitrine boolean not null default false,         -- aparece no cardápio público
  preco_sob_consulta boolean not null default false, -- na vitrine, esconde o valor
  criado_em timestamptz not null default now()
);

-- ---------- ASSINATURAS (M-011/M-018 · Play Billing, Decisões #3 e #11) ----------
create table assinaturas (
  usuaria_id uuid primary key references perfis (id) on delete cascade,
  plano plano_assinatura not null default 'gratis',
  status status_assinatura not null default 'trial',
  trial_fim timestamptz,
  renovacao_em timestamptz,
  fundadora boolean not null default false,        -- Oferta Fundadora (~30 primeiras)
  origem text not null default 'play_billing',
  purchase_token text,                              -- token do Play (validar no backend)
  atualizado_em timestamptz not null default now()
);
-- Regra de ouro (Decisão #3): cancelar/expirar NUNCA bloqueia ver/baixar fotos.
-- O limite de 150 fotos do plano Grátis vale só para NOVOS uploads (regra no app).

-- ============================================================
-- RLS — cada usuária só enxerga o que é dela.
-- Exceção: vitrine pública (anon lê perfis publicados e fotos na vitrine).
-- ============================================================
alter table perfis enable row level security;
alter table trabalhos enable row level security;
alter table tags enable row level security;
alter table trabalho_tags enable row level security;
alter table inspiracoes enable row level security;
alter table inspiracao_tags enable row level security;
alter table clientes enable row level security;
alter table pedidos enable row level security;
alter table anotacoes enable row level security;
alter table cardapio_itens enable row level security;
alter table assinaturas enable row level security;

-- Dona: tudo nas próprias linhas
create policy dona_perfil on perfis
  for all using (id = auth.uid()) with check (id = auth.uid());
create policy dona_trabalhos on trabalhos
  for all using (usuaria_id = auth.uid()) with check (usuaria_id = auth.uid());
create policy dona_tags on tags
  for all using (usuaria_id = auth.uid()) with check (usuaria_id = auth.uid());
create policy dona_trabalho_tags on trabalho_tags
  for all using (exists (select 1 from trabalhos t where t.id = trabalho_id and t.usuaria_id = auth.uid()))
  with check (exists (select 1 from trabalhos t where t.id = trabalho_id and t.usuaria_id = auth.uid()));
create policy dona_inspiracoes on inspiracoes
  for all using (usuaria_id = auth.uid()) with check (usuaria_id = auth.uid());
create policy dona_inspiracao_tags on inspiracao_tags
  for all using (exists (select 1 from inspiracoes i where i.id = inspiracao_id and i.usuaria_id = auth.uid()))
  with check (exists (select 1 from inspiracoes i where i.id = inspiracao_id and i.usuaria_id = auth.uid()));
create policy dona_clientes on clientes
  for all using (usuaria_id = auth.uid()) with check (usuaria_id = auth.uid());
create policy dona_pedidos on pedidos
  for all using (usuaria_id = auth.uid()) with check (usuaria_id = auth.uid());
create policy dona_anotacoes on anotacoes
  for all using (usuaria_id = auth.uid()) with check (usuaria_id = auth.uid());
create policy dona_cardapio on cardapio_itens
  for all using (usuaria_id = auth.uid()) with check (usuaria_id = auth.uid());
create policy dona_assinatura_leitura on assinaturas
  for select using (usuaria_id = auth.uid());
-- Escrita em assinaturas: só pelo backend (service_role), nunca pelo app.

-- Vitrine pública (anon e logadas): só perfis publicados e fotos marcadas
-- LGPD: dados de clientes finais NUNCA aparecem na vitrine (não há policy pública em clientes/pedidos).
create policy vitrine_perfil_publico on perfis
  for select using (vitrine_publicada = true);
create policy vitrine_trabalhos_publicos on trabalhos
  for select using (
    na_vitrine = true
    and exists (select 1 from perfis p where p.id = usuaria_id and p.vitrine_publicada = true)
  );

-- ============================================================
-- M-011 — PAYWALL (enforcement + planos)
-- Modelo: Grátis = 150 imagens totais (trabalhos + inspirações-imagem +
-- referências de pedido). Fundadora e Vitrine-ativa = ilimitado. Sem trial.
-- ============================================================

-- Total de imagens da usuária (base do limite de 150 do plano Grátis).
create function total_imagens_usuaria(uid uuid)
returns integer language sql security definer set search_path = public as $$
  select (select count(*) from trabalhos where usuaria_id = uid)
       + (select count(*) from inspiracoes where usuaria_id = uid and foto_path is not null)
       + (select count(*) from pedidos where usuaria_id = uid and foto_referencia_path is not null);
$$;

-- Quantos trabalhos a vitrine pública pode mostrar.
-- NULL => sem limite (Fundadora ou Vitrine ativa). Caso contrário, o orçamento
-- de 150 imagens menos o que já é ocupado por inspirações-imagem e referências.
create function slots_vitrine_publica(uid uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare a record; insp int; ref int;
begin
  select plano, status, fundadora into a from assinaturas where usuaria_id = uid;
  if a.fundadora or (a.plano = 'vitrine' and a.status = 'ativa') then
    return null;
  end if;
  select count(*) into insp from inspiracoes where usuaria_id = uid and foto_path is not null;
  select count(*) into ref  from pedidos     where usuaria_id = uid and foto_referencia_path is not null;
  return greatest(0, 150 - insp - ref);
end $$;

-- Vitrine pública com o corte server-side (a cliente é anônima): devolve os
-- trabalhos na vitrine já cortados por slots_vitrine_publica e ordenados por
-- criado_em desc. Preserva o shape (foto_publica_path, descricao) e as tags.
create function vitrine_publica(arroba text)
returns table (id uuid, foto_publica_path text, descricao text, tags jsonb)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare dona uuid; n int;
begin
  select p.id into dona
  from perfis p
  where p.arroba = vitrine_publica.arroba and p.vitrine_publicada = true;
  if dona is null then
    return; -- vitrine inexistente ou não publicada
  end if;
  n := slots_vitrine_publica(dona);
  return query
  select t.id, t.foto_publica_path, t.descricao,
         coalesce(
           (select jsonb_agg(jsonb_build_object('id', tg.id, 'nome', tg.nome) order by tg.nome)
            from trabalho_tags wt join tags tg on tg.id = wt.tag_id
            where wt.trabalho_id = t.id),
           '[]'::jsonb
         ) as tags
  from trabalhos t
  where t.usuaria_id = dona and t.na_vitrine = true and t.foto_publica_path is not null
  order by t.criado_em desc
  limit case when n is null then null else n end;
end $$;
grant execute on function vitrine_publica(text) to anon, authenticated;

-- Cardápio público (anônimo): só itens marcados na vitrine de um perfil publicado,
-- ordenados por nome. A formatação do preço ("R$ x" vs "Preço sob consulta") fica no app.
create function cardapio_publico(arroba text)
returns table (id uuid, nome text, detalhes text, unidade text, preco_base numeric, preco_sob_consulta boolean)
language sql security definer set search_path = public as $$
  select c.id, c.nome, c.detalhes, c.unidade, c.preco_base, c.preco_sob_consulta
  from cardapio_itens c
  join perfis p on p.id = c.usuaria_id
  where p.arroba = arroba
    and p.vitrine_publicada = true
    and c.na_vitrine = true
  order by c.nome;
$$;
grant execute on function cardapio_publico(text) to anon, authenticated;

-- ============================================================
-- STORAGE — buckets
--   acervo       privado  (fotos dos trabalhos, comprimidas no cliente)
--   inspiracoes  privado
--   publico      público  (logos + cópias das fotos publicadas na vitrine)
-- Caminho padrão: {auth.uid()}/{uuid}.jpg — a 1ª pasta é a dona.
-- ============================================================
insert into storage.buckets (id, name, public) values
  ('acervo', 'acervo', false),
  ('inspiracoes', 'inspiracoes', false),
  ('publico', 'publico', true);

create policy dona_storage_leitura on storage.objects
  for select using (
    bucket_id in ('acervo', 'inspiracoes')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy dona_storage_escrita on storage.objects
  for insert with check (
    bucket_id in ('acervo', 'inspiracoes', 'publico')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy dona_storage_remocao on storage.objects
  for delete using (
    bucket_id in ('acervo', 'inspiracoes', 'publico')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy publico_leitura on storage.objects
  for select using (bucket_id = 'publico');

-- ---------- utilitário: atualizado_em automático ----------
create function marcar_atualizado()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

create trigger perfis_atualizado before update on perfis
  for each row execute function marcar_atualizado();
create trigger anotacoes_atualizado before update on anotacoes
  for each row execute function marcar_atualizado();
create trigger assinaturas_atualizado before update on assinaturas
  for each row execute function marcar_atualizado();

-- fim do schema v1
