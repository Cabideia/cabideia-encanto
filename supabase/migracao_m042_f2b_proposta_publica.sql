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

-- ---------- 2 · Leitura pública SÓ pela RPC (sem select anônimo direto) ----------
-- ATENÇÃO: a primeira versão desta fase criou policies de SELECT público
-- (`token não-nulo E resolvida=false`) em propostas/proposta_referencias/
-- proposta_itens. Elas foram REMOVIDAS na correção de segurança (ver a
-- migração _rpc): deixavam o anônimo enumerar propostas ativas direto. O
-- acesso público passou a ser EXCLUSIVAMENTE pela RPC SECURITY DEFINER
-- `proposta_publica`, que filtra pelo token específico — mesmo modelo da
-- seleção. Nada de policy de leitura pública aqui; a escrita segue restrita
-- à dona (policies dona_*).
