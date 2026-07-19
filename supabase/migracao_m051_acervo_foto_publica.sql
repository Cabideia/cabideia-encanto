-- ============================================================
-- M-051 · Renderização pública dos acervos (Decisões #42/#43/#50)
-- JÁ APLICADA em produção pela gestão via MCP em 18/07 (aprovação da
-- Josiane no relato de 5 partes). NÃO reaplicar. Este arquivo existe
-- para PARIDADE de histórico — espelha exatamente o SQL aplicado.
-- Idempotente (apply_migration não é transacional — lição 10-15/07 §1).
-- ------------------------------------------------------------
--   1. inspiracoes.foto_publica_path — cópia pública ÚNICA do item,
--      reaproveitada por vitrine/proposta/pedido. Vive até o item ser
--      excluído do acervo (Decisão #50).
--   2. Promoção SQL: adota como cópia do item uma cópia por-referência
--      já existente no bucket público (reaproveita o arquivo; zero
--      bytes copiados). Verificado em 18/07: 39/39 promovidas.
--   3. proposta_publica/pedido_publico: prioridade da foto passa a
--      item → legado por-referência; REMOVIDO o fallback a foto_path
--      privado (o anônimo nunca abre; só gerava imagem quebrada).
--   4. Grants reaplicados na mesma migração (lição §3: DROP+CREATE
--      restaura o EXECUTE default de PUBLIC).
-- ============================================================

alter table public.inspiracoes
  add column if not exists foto_publica_path text;

update public.inspiracoes i
set foto_publica_path = sub.copia
from (
  select distinct on (inspiracao_id) inspiracao_id, foto_publica_path as copia
  from (
    select inspiracao_id, foto_publica_path from public.proposta_referencias
      where inspiracao_id is not null and foto_publica_path is not null
    union all
    select inspiracao_id, foto_publica_path from public.pedido_referencias
      where inspiracao_id is not null and foto_publica_path is not null
  ) u
  order by inspiracao_id
) sub
where i.id = sub.inspiracao_id and i.foto_publica_path is null;

create or replace function public.proposta_publica(p_token text)
returns table(titulo text, descricao text, condicoes text, valor numeric, modo_preco text, validade date, negocio text, whatsapp text, logo_path text, tema text, foto_path text, itens jsonb, fotos jsonb)
language plpgsql security definer set search_path to 'public'
as $$
declare prop record;
begin
  select p.id, p.titulo, p.descricao, p.condicoes, p.valor, p.modo_preco,
         p.validade, p.foto_path, p.usuaria_id
    into prop
  from propostas p
  where p.token = p_token and p.resolvida = false;

  if prop.id is null then
    return;
  end if;

  return query
  select prop.titulo, prop.descricao, prop.condicoes, prop.valor, prop.modo_preco,
    prop.validade, perf.nome_negocio, perf.whatsapp, perf.logo_path,
    coalesce(perf.tema,'oficina'), prop.foto_path,
    coalesce((select jsonb_agg(jsonb_build_object(
        'nome', pi.nome_snapshot, 'preco', pi.preco_snapshot) order by pi.ordem)
      from proposta_itens pi where pi.proposta_id = prop.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
        'foto_publica_path', coalesce(i.foto_publica_path, t.foto_publica_path, pr.foto_publica_path),
        'url', i.url,
        'origem', case when pr.trabalho_id is not null then 'trabalho' else 'inspiracao' end,
        'codigo_num', coalesce(t.codigo_num, i.codigo_num))
        order by pr.ordem)
      from proposta_referencias pr
      left join trabalhos t on t.id = pr.trabalho_id
      left join inspiracoes i on i.id = pr.inspiracao_id
      where pr.proposta_id = prop.id), '[]'::jsonb)
  from perfis perf where perf.id = prop.usuaria_id;
end $$;

create or replace function public.pedido_publico(p_token text)
returns table(titulo text, detalhes text, data_entrega date, valor numeric, status text, status_pagamento text, cliente_primeiro_nome text, negocio text, whatsapp text, logo_path text, tema text, foto_referencia_path text, fotos jsonb)
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
      where pr.pedido_id = ped.id), '[]'::jsonb)
  from perfis perf where perf.id = ped.usuaria_id;
end $$;

revoke all on function public.proposta_publica(text) from public;
revoke all on function public.pedido_publico(text) from public;
grant execute on function public.proposta_publica(text) to anon, authenticated;
grant execute on function public.pedido_publico(text) to anon, authenticated;
