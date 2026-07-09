-- ============================================================
-- M-042 · F2b · Proposta como página-link pública
-- JÁ APLICADA em produção pela gestão (fora deste repo, duplo crivo).
-- Este arquivo existe para PARIDADE de histórico — NÃO reaplicar.
-- Reflete exatamente os objetos em produção (introspecção do schema).
-- ------------------------------------------------------------
-- Transforma a proposta numa página web que a cliente abre pelo link
-- (cabideia.com.br/encanto/proposta/:token) — resolve o B3 (o PNG saía
-- incompleto no compartilhamento).
--
-- Decisão B · token SEM expiração por tempo. O que FECHA o link é
-- `resolvida = true` (marcada à mão OU quando a proposta vira pedido, que
-- já marca resolvida). O token permanece na linha: reabrir (resolvida volta
-- a false) faz o mesmo link voltar a funcionar.
-- ============================================================

-- ---------- 1 · Token público da proposta ----------
-- Nulável: a proposta só ganha token quando a dona compartilha pela 1ª vez
-- (gerado/reusado no cliente). Único para servir de chave do link público.
alter table public.propostas add column if not exists token text;

create unique index if not exists propostas_token_key
  on public.propostas (token);

-- ---------- 2 · Leitura pública (anônima) por token + não-resolvida ----------
-- Em propostas e nas duas tabelas-filhas exibidas na página. A condição é a
-- mesma em todas: `token não-nulo E resolvida=false` (a de referências/itens
-- é derivada da proposta-mãe, no padrão já usado nas policies da dona). São
-- policies de SELECT — a escrita continua restrita à dona (dona_*).
--
-- Observação de segurança: a leitura da página passa pela RPC SECURITY
-- DEFINER `proposta_publica` (ver migração _rpc), que filtra pelo token
-- específico. Estas policies são a camada de RLS (defesa em profundidade);
-- o anônimo nunca faz select direto nas tabelas pela aplicação.

create policy proposta_publica_leitura on public.propostas
  for select
  using (token is not null and resolvida = false);

create policy proposta_ref_publica on public.proposta_referencias
  for select
  using (
    exists (
      select 1 from public.propostas p
      where p.id = proposta_referencias.proposta_id
        and p.token is not null
        and p.resolvida = false
    )
  );

create policy proposta_itens_publica on public.proposta_itens
  for select
  using (
    exists (
      select 1 from public.propostas p
      where p.id = proposta_itens.proposta_id
        and p.token is not null
        and p.resolvida = false
    )
  );
