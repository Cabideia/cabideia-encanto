-- ============================================================
-- Identidade visual multi-nicho (Decisão #9) — tema selecionável
-- Aplicado ao projeto remoto. Mudanças ADITIVAS.
-- ============================================================

-- A dona escolhe entre 3 temas (só a cor muda; tipografia única). Default
-- 'oficina' (a cara da casa). Tema nulo/legado → oficina, garantido pelo default.
-- RLS da dona (dona_perfil) já cobre a própria linha; a leitura pública
-- (vitrine_perfil_publico) já permite anon ler perfis publicados, então a
-- vitrine pública enxerga o `tema` sem mudança de policy.
alter table perfis
  add column if not exists tema text not null default 'oficina'
  check (tema in ('oficina', 'vitrine', 'encanto'));

-- A leitura pública da seleção (security definer) precisa enxergar o tema para
-- pintar a página /s/:token sem login. A assinatura muda (ganha `tema`), então
-- dropamos antes de recriar.
drop function if exists selecao_publica(text);

create function selecao_publica(p_token text)
returns table (
  titulo text,
  mensagem text,
  negocio text,
  whatsapp text,
  logo_path text,
  tema text,
  itens jsonb
)
language plpgsql security definer set search_path = public as $$
declare sel record;
begin
  select s.id, s.titulo, s.mensagem, s.usuaria_id
    into sel
  from selecoes s
  where s.token = p_token and s.expira_em > now();

  if sel.id is null then
    return; -- token inexistente ou seleção expirada
  end if;

  return query
  select
    sel.titulo,
    sel.mensagem,
    p.nome_negocio,
    p.whatsapp,
    p.logo_path,
    coalesce(p.tema, 'oficina') as tema,
    coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'id', si.id,
          'origem', case when si.trabalho_id is not null then 'trabalho' else 'inspiracao' end,
          'codigo_num', coalesce(t.codigo_num, i.codigo_num),
          'descricao', coalesce(t.descricao, i.nota),
          'foto_publica_path', coalesce(si.foto_publica_path, t.foto_publica_path, t.foto_path),
          'url', i.url
        ) order by si.ordem
      )
      from selecao_itens si
      left join trabalhos t on t.id = si.trabalho_id
      left join inspiracoes i on i.id = si.inspiracao_id
      where si.selecao_id = sel.id),
      '[]'::jsonb
    ) as itens
  from perfis p
  where p.id = sel.usuaria_id;
end $$;

grant execute on function selecao_publica(text) to anon, authenticated;
