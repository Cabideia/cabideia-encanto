-- ============================================================
-- M-047 · Pedido como página-link pública (Decisão #28)
-- JÁ APLICADA em produção pela gestão. NÃO reaplicar.
-- Este arquivo existe para PARIDADE de histórico — reflete exatamente os
-- objetos em produção (espelho fiel do mecanismo da proposta F2b).
-- ------------------------------------------------------------
--   1. pedidos.token + índice único parcial pedidos_token_unico — chave do
--      link público do pedido (nasce só ao compartilhar; mesma ideia de
--      propostas.token).
--   2. pedido_referencias.foto_publica_path — caminho da CÓPIA pública da foto
--      (bucket privado → público), gerada no cliente ao compartilhar (mesmo
--      mecanismo do M-022 / proposta_referencias.foto_publica_path).
--   3. pedido_publico(p_token) — leitura anônima montada: filtra por token,
--      checa status <> 'cancelado' e devolve só o necessário, resolvendo o
--      caminho público das fotos. Status/pagamento VIVOS (a página reflete o
--      estado atual a cada acesso); status_pagamento = 'nao_pago' é suprimido.
--   4. REVOKE SELECT anônimo direto em pedidos/pedido_referencias/clientes — só
--      a RPC SECURITY DEFINER dá acesso público (padrão da auditoria).
-- ============================================================

alter table public.pedidos add column if not exists token text;
create unique index if not exists pedidos_token_unico
  on public.pedidos (token) where token is not null;
alter table public.pedido_referencias
  add column if not exists foto_publica_path text;
create or replace function public.pedido_publico(p_token text)
returns table(
  titulo text, detalhes text, data_entrega date,
  valor numeric, status text, status_pagamento text,
  cliente_primeiro_nome text, negocio text, whatsapp text,
  logo_path text, tema text,
  foto_referencia_path text, fotos jsonb)
language plpgsql security definer set search_path to 'public'
as $$
declare ped record;
begin
  select p.id, p.nome, p.tema, p.data_entrega, p.valor,
         p.status::text as st, p.status_pagamento::text as st_pag,
         p.foto_referencia_path, p.usuaria_id, p.cliente_id
    into ped
  from pedidos p
  where p.token = pedido_publico.p_token
    and p.status <> 'cancelado';
  if ped.id is null then return; end if;
  return query
  select ped.nome, ped.tema, ped.data_entrega, ped.valor,
    ped.st,
    case when ped.st_pag = 'nao_pago' then null else ped.st_pag end,
    (select split_part(c.nome,' ',1) from clientes c
      where c.id = ped.cliente_id),
    perf.nome_negocio, perf.whatsapp, perf.logo_path,
    coalesce(perf.tema,'oficina'),
    ped.foto_referencia_path,
    coalesce((select jsonb_agg(jsonb_build_object(
        'foto_publica_path',
          coalesce(pr.foto_publica_path, t.foto_publica_path, t.foto_path),
        'url', i.url,
        'origem', case when pr.trabalho_id is not null
          then 'trabalho' else 'inspiracao' end,
        'codigo_num', coalesce(t.codigo_num, i.codigo_num))
        order by pr.ordem)
      from pedido_referencias pr
      left join trabalhos t on t.id = pr.trabalho_id
      left join inspiracoes i on i.id = pr.inspiracao_id
      where pr.pedido_id = ped.id), '[]'::jsonb)
  from perfis perf where perf.id = ped.usuaria_id;
end $$;
grant execute on function public.pedido_publico(text) to anon, authenticated;
revoke select on public.pedidos from anon;
revoke select on public.pedido_referencias from anon;
revoke select on public.clientes from anon;
