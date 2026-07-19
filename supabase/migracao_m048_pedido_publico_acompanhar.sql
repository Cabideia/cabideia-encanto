-- ============================================================
-- M-048 · Página pública do pedido "Acompanhar encomenda"
-- JÁ APLICADA em produção pela gestão via MCP em 19/07 (Decisão de
-- escopo #48 = A, aprovada pela Josiane). NÃO reaplicar. Este
-- arquivo existe para PARIDADE de histórico. Idempotente.
-- ------------------------------------------------------------
-- SEM coluna nova — só a RPC pedido_publico recriada devolvendo
-- também `arroba` (cabeçalho "com {negócio} · @arroba") e
-- `criado_em` (data do passo "Pedido confirmado" na linha do
-- tempo). Mudança de shape ⇒ DROP+CREATE ⇒ REVOKE/GRANT
-- reaplicados na MESMA migração (lição 10-15/07 §3).
-- Vocabulário travado preservado: linha do tempo usa só
-- a_fazer/em_producao/entregue (cancelado → link indisponível).
-- ============================================================

drop function if exists public.pedido_publico(text);
create function public.pedido_publico(p_token text)
returns table(titulo text, detalhes text, data_entrega date, valor numeric, status text, status_pagamento text, cliente_primeiro_nome text, negocio text, whatsapp text, logo_path text, tema text, foto_referencia_path text, fotos jsonb, arroba text, criado_em date)
language plpgsql security definer set search_path to 'public'
as $$
declare ped record;
begin
  select p.id, p.nome, p.tema, p.data_entrega, p.valor,
         p.status::text as st, p.status_pagamento::text as st_pag,
         p.foto_referencia_path, p.usuaria_id, p.cliente_id,
         p.criado_em::date as criado
    into ped
  from pedidos p
  where p.token = pedido_publico.p_token
    and p.status <> 'cancelado';

  if ped.id is null then return; end if;

  return query
  select ped.nome, ped.tema, ped.data_entrega, ped.valor,
    ped.st,
    case when ped.st_pag = 'nao_pago' then null else ped.st_pag end,
    (select split_part(c.nome,' ',1) from clientes c where c.id = ped.cliente_id),
    perf.nome_negocio, perf.whatsapp, perf.logo_path,
    coalesce(perf.tema,'oficina'),
    ped.foto_referencia_path,
    coalesce((select jsonb_agg(jsonb_build_object(
        'foto_publica_path', coalesce(i.foto_publica_path, t.foto_publica_path, pr.foto_publica_path),
        'url', i.url,
        'origem', case when pr.trabalho_id is not null then 'trabalho' else 'inspiracao' end,
        'codigo_num', coalesce(t.codigo_num, i.codigo_num))
        order by pr.ordem)
      from pedido_referencias pr
      left join trabalhos t on t.id = pr.trabalho_id
      left join inspiracoes i on i.id = pr.inspiracao_id
      where pr.pedido_id = ped.id), '[]'::jsonb),
    perf.arroba,
    ped.criado
  from perfis perf where perf.id = ped.usuaria_id;
end $$;
revoke all on function public.pedido_publico(text) from public;
grant execute on function public.pedido_publico(text) to anon, authenticated;
