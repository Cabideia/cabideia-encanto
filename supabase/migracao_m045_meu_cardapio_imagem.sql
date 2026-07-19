-- ============================================================
-- M-045 · Meu cardápio (imagem) — Decisões #39 (opção C) e #42
-- JÁ APLICADA em produção pela gestão via MCP em 19/07 (aprovação
-- da Josiane no relato de 5 partes). NÃO reaplicar. Este arquivo
-- existe para PARIDADE de histórico — espelha o SQL aplicado.
-- Idempotente.
-- ------------------------------------------------------------
--   1. perfis.cardapio_path — a ARTE de recheios/sabores (bucket
--      'publico'; imagem de configuração, NÃO é acervo).
--   2. propostas.incluir_cardapio — interruptor por proposta, ligado
--      por padrão (inclusive nas antigas — escolha da Josiane).
--   3. perfil_vitrine e proposta_publica recriadas devolvendo
--      cardapio_path (mudança de shape ⇒ DROP+CREATE ⇒ REVOKE/GRANT
--      reaplicados na MESMA migração — lição 10-15/07 §3).
--      proposta_publica: cardapio só sai quando incluir_cardapio.
-- ============================================================

alter table public.perfis
  add column if not exists cardapio_path text;
alter table public.propostas
  add column if not exists incluir_cardapio boolean not null default true;

drop function if exists public.perfil_vitrine(text);
create function public.perfil_vitrine(arroba text)
returns table (
  id uuid, nome_negocio text, bio text, cidade text, nicho text,
  whatsapp text, logo_path text, tema text, cardapio_path text
)
language sql security definer set search_path to 'public'
as $fn$
  select p.id, p.nome_negocio, p.bio, p.cidade, p.nicho, p.whatsapp, p.logo_path,
         coalesce(p.tema, 'oficina'), p.cardapio_path
  from perfis p
  where p.arroba = perfil_vitrine.arroba
    and p.vitrine_publicada = true;
$fn$;
revoke all on function public.perfil_vitrine(text) from public;
grant execute on function public.perfil_vitrine(text) to anon, authenticated;

drop function if exists public.proposta_publica(text);
create function public.proposta_publica(p_token text)
returns table(titulo text, descricao text, condicoes text, valor numeric, modo_preco text, validade date, negocio text, whatsapp text, logo_path text, tema text, foto_path text, itens jsonb, fotos jsonb, cardapio_path text)
language plpgsql security definer set search_path to 'public'
as $$
declare prop record;
begin
  select p.id, p.titulo, p.descricao, p.condicoes, p.valor, p.modo_preco,
         p.validade, p.foto_path, p.usuaria_id, p.incluir_cardapio
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
      where pr.proposta_id = prop.id), '[]'::jsonb),
    case when prop.incluir_cardapio then perf.cardapio_path else null end
  from perfis perf where perf.id = prop.usuaria_id;
end $$;
revoke all on function public.proposta_publica(text) from public;
grant execute on function public.proposta_publica(text) to anon, authenticated;
