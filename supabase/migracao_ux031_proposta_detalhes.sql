-- ============================================================================
-- D1 (P0) · UX-031 / UX-032 — campo "Detalhes e outros itens" da proposta
-- ----------------------------------------------------------------------------
-- POR QUE: o design review separa a MENSAGEM que abre a proposta (propostas.
-- descricao, hoje em uso em 7 de 13 propostas) dos DETALHES/observacoes. Nao ha
-- coluna livre: `condicoes` e outra coisa (pagamento/prazo, 9 de 13 em uso).
--
-- ARMADILHAS APLICADAS (handoff §8):
--   #3 · DDL idempotente (apply_migration nao e transacional).
--   #4 · DROP FUNCTION + CREATE restaura o EXECUTE default para PUBLIC —
--        os REVOKE/GRANT sao reaplicados NESTA MESMA migracao.
--   #6 · parametro qualificado (p_token) — ja era o padrao desta RPC.
--
-- SEGURANCA: coluna aditiva e nullable; nenhuma linha existente muda. A RPC
-- mantem SECURITY DEFINER + search_path fixo e o mesmo filtro (token +
-- resolvida = false). Reversao: `alter table propostas drop column detalhes`
-- e recriar a RPC sem o campo (o dado da coluna se perde — so isso).
-- ============================================================================

-- 1) Coluna nova (aditiva, nullable)
alter table public.propostas add column if not exists detalhes text;

comment on column public.propostas.detalhes is
  'UX-031 · "Detalhes e outros itens" — observacoes da proposta, separadas da mensagem de abertura (descricao) e das condicoes comerciais (condicoes).';

-- 2) RPC publica recriada devolvendo `detalhes` (sem mudar mais nada)
drop function if exists public.proposta_publica(text);

create function public.proposta_publica(p_token text)
returns table(
  titulo text, descricao text, detalhes text, condicoes text, valor numeric,
  modo_preco text, validade date, negocio text, whatsapp text, logo_path text,
  tema text, foto_path text, itens jsonb, fotos jsonb, cardapio_path text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare prop record;
begin
  select p.id, p.titulo, p.descricao, p.detalhes, p.condicoes, p.valor, p.modo_preco,
         p.validade, p.foto_path, p.usuaria_id, p.incluir_cardapio
    into prop
  from propostas p
  where p.token = p_token and p.resolvida = false;

  if prop.id is null then
    return;
  end if;

  -- UX-018 · termometro de interesse: conta cada abertura da pagina que NAO
  -- e da propria dona (o "ver como a cliente ve" nao infla o numero).
  if auth.uid() is distinct from prop.usuaria_id then
    update propostas set aberturas = aberturas + 1 where id = prop.id;
  end if;

  return query
  select prop.titulo, prop.descricao, prop.detalhes, prop.condicoes, prop.valor, prop.modo_preco,
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
end $function$;

-- 3) Armadilha #4 · reaplicar os grants (o DROP+CREATE zerou para o default)
revoke all on function public.proposta_publica(text) from public;
grant execute on function public.proposta_publica(text) to anon, authenticated;
