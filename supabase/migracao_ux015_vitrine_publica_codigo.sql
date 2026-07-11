-- UX-015 · incluir codigo_num no retorno de vitrine_publica.
-- Paridade com a migração aplicada ao vivo pela gestão:
--   ux015_vitrine_publica_codigo_v2 (version 20260710122913).
-- Mudança de tipo de retorno exige DROP+CREATE. Corte do plano
-- (slots_vitrine_publica) preservado; grants de execute reconcedidos a
-- anon/authenticated (o DROP remove os grants — a vitrine é pública/anon).
drop function public.vitrine_publica(text);

CREATE FUNCTION public.vitrine_publica(arroba text)
 RETURNS TABLE(id uuid, foto_publica_path text, descricao text, tags jsonb, codigo_num integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  dona uuid;
  n int;
begin
  select p.id into dona
  from perfis p
  where p.arroba = vitrine_publica.arroba
    and p.vitrine_publicada = true;

  if dona is null then
    return;
  end if;

  n := slots_vitrine_publica(dona);

  return query
  select t.id,
         t.foto_publica_path,
         t.descricao,
         coalesce(
           (select jsonb_agg(jsonb_build_object('id', tg.id, 'nome', tg.nome) order by tg.nome)
            from trabalho_tags wt
            join tags tg on tg.id = wt.tag_id
            where wt.trabalho_id = t.id),
           '[]'::jsonb
         ) as tags,
         t.codigo_num
  from trabalhos t
  where t.usuaria_id = dona
    and t.na_vitrine = true
    and t.foto_publica_path is not null
  order by t.criado_em desc
  limit case when n is null then null else n end;
end $function$;

-- Reconceder execução pública (drop remove grants; a vitrine é pública/anon)
grant execute on function public.vitrine_publica(text) to anon, authenticated;
