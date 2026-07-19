-- ============================================================
-- UX-018 · Contador de aberturas da proposta (Decisão #36)
-- JÁ APLICADA em produção pela gestão via MCP em 19/07 (aprovação
-- da Josiane no relato de 5 partes). NÃO reaplicar. Este arquivo
-- existe para PARIDADE de histórico — espelha o SQL aplicado.
-- Idempotente.
-- ------------------------------------------------------------
--   1. propostas.aberturas — quantas vezes a página pública foi
--      aberta (termômetro do card "Aberta pela cliente Nx").
--   2. proposta_publica: incrementa o contador NA RPC (nenhuma
--      escrita anônima direta em tabela), pulando a própria dona
--      (auth.uid() — o "ver como a cliente vê" não infla o número).
--      Corpo do M-051 preservado no restante.
--   3. Grants reaplicados na mesma migração (lição: DROP/CREATE
--      restaura o EXECUTE default de PUBLIC).
-- ============================================================

alter table public.propostas
  add column if not exists aberturas integer not null default 0;

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

  -- UX-018 · termômetro de interesse: conta cada abertura da página que NÃO
  -- é da própria dona (o "ver como a cliente vê" não infla o número).
  if auth.uid() is distinct from prop.usuaria_id then
    update propostas set aberturas = aberturas + 1 where id = prop.id;
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

revoke all on function public.proposta_publica(text) from public;
grant execute on function public.proposta_publica(text) to anon, authenticated;
