-- ============================================================
-- Reorientar Proposta + Seleção multi-origem + Código curto
-- Mudanças ADITIVAS aplicadas ao projeto remoto (já em produção).
-- O banco já estava migrado para: tabela `propostas`,
-- `selecao_itens.id/inspiracao_id`, e `codigo_num` (com os gatilhos
-- set_codigo_trabalho / set_codigo_inspiracao). Este arquivo registra
-- apenas o que ESTE trabalho precisou acrescentar.
-- ============================================================

-- Seleção multi-origem (M-022 estendido): um item pode vir de Meus Trabalhos
-- (bucket público) ou de Inspirações (bucket privado). Para a inspiração
-- aparecer no link público sem login, guardamos no item o caminho de uma
-- CÓPIA pública da imagem, gerada no cliente ao montar a seleção.
alter table selecao_itens add column if not exists foto_publica_path text;

-- Leitura pública da seleção (anônima, sem login). Security definer: devolve só
-- o necessário a partir de um token válido (não expirado), sem abrir as tabelas
-- de inspirações/trabalhos ao anon. Inclui o código curto (A-{n} trabalhos ·
-- I-{n} inspirações) e resolve o caminho público da imagem (cópia das inspirações).
create or replace function selecao_publica(p_token text)
returns table (
  titulo text,
  mensagem text,
  negocio text,
  whatsapp text,
  logo_path text,
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
