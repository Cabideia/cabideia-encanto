-- ============================================================
-- M-037 · Tela "Acompanhar" — arquivar (resolver) links e propostas.
-- Mudança ADITIVA e segura, aplicada ao projeto remoto (já em produção).
--
-- Adiciona a coluna `resolvida` (boolean NOT NULL DEFAULT false) em `selecoes`
-- e `propostas`. "Resolver" arquiva o item (reversível) — diferente da lixeira,
-- que apaga de vez. Sem perda de dado; o RLS de dona (dona_selecoes / dona_*)
-- já cobre as duas tabelas, então NENHUMA policy nova é necessária.
-- ============================================================
alter table public.selecoes  add column if not exists resolvida boolean not null default false;
alter table public.propostas add column if not exists resolvida boolean not null default false;
