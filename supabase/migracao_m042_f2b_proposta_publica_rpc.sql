-- ============================================================
-- M-042 · F2b · RPC de leitura pública + coluna da foto pública
-- ⚠️ PENDENTE — NÃO aplicada. Aguarda DUPLO CRIVO (Decisão #28: qualquer
--    schema PARA no DDL). Este arquivo é a PROPOSTA de DDL para a gestão
--    aplicar. Precisa entrar ANTES do front deste PR ir ao ar (o front
--    chama a RPC e lê `foto_publica_path`).
-- ------------------------------------------------------------
-- Fecha os dois furos que a migração já aplicada (token + policies) deixou
-- em aberto para a página pública funcionar de ponta a ponta:
--
--   1. proposta_referencias.foto_publica_path — as fotos de referência vêm de
--      trabalhos (bucket privado `acervo`, com cópia de vitrine opcional em
--      `foto_publica_path`) e de inspirações (bucket privado `inspiracoes`).
--      A cliente anônima não enxerga bucket privado. Espelhamos o mecanismo
--      do M-022 (selecao_itens.foto_publica_path): guardamos o caminho de uma
--      CÓPIA pública, gerada no cliente ao compartilhar. Trabalho já publicado
--      na vitrine reusa `trabalhos.foto_publica_path` (sem duplicar storage);
--      só inspiração e trabalho fora da vitrine geram cópia nova.
--
--   2. proposta_publica(p_token) — leitura anônima SECURITY DEFINER. Filtra
--      pelo token específico e checa resolvida=false (defesa em profundidade,
--      além da RLS). Não abre as tabelas de trabalhos/inspirações/perfis ao
--      anon: devolve só o necessário já montado, resolvendo o caminho público
--      das fotos. Mesmo desenho da `selecao_publica`.
-- ============================================================

-- ---------- 1 · Caminho da cópia pública nas referências ----------
alter table public.proposta_referencias
  add column if not exists foto_publica_path text;

-- ---------- 2 · Leitura pública da proposta (anônima, por token) ----------
create or replace function public.proposta_publica(p_token text)
returns table (
  titulo text,
  descricao text,
  valor numeric,
  validade date,
  condicoes text,
  modo_preco text,
  foto_path text,
  negocio text,
  whatsapp text,
  logo_path text,
  tema text,
  referencias jsonb,
  itens jsonb
)
language plpgsql security definer set search_path = public as $$
declare prop record;
begin
  select pr.id, pr.titulo, pr.descricao, pr.valor, pr.validade, pr.condicoes,
         pr.modo_preco, pr.foto_path, pr.usuaria_id
    into prop
  from propostas pr
  where pr.token = p_token and pr.resolvida = false;

  if prop.id is null then
    return; -- token inexistente ou proposta resolvida (link fechado)
  end if;

  return query
  select
    prop.titulo,
    prop.descricao,
    prop.valor,
    prop.validade,
    prop.condicoes,
    prop.modo_preco,
    prop.foto_path,
    pf.nome_negocio,
    pf.whatsapp,
    pf.logo_path,
    pf.tema,
    -- Referências (galeria de fotos): trabalho (A-{n}) ou inspiração (I-{n}).
    -- Caminho público = cópia gerada na proposta (r.foto_publica_path) OU a
    -- cópia de vitrine do trabalho (t.foto_publica_path). Inspiração-link (sem
    -- imagem) entra só com `url`.
    coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'origem', case when r.trabalho_id is not null then 'trabalho' else 'inspiracao' end,
          'codigo_num', coalesce(t.codigo_num, i.codigo_num),
          'descricao', coalesce(t.descricao, i.nota),
          'foto_publica_path', coalesce(r.foto_publica_path, t.foto_publica_path),
          'url', i.url
        ) order by r.ordem
      )
      from proposta_referencias r
      left join trabalhos   t on t.id = r.trabalho_id
      left join inspiracoes i on i.id = r.inspiracao_id
      where r.proposta_id = prop.id),
      '[]'::jsonb
    ) as referencias,
    -- Itens da tabela de preços ofertados (snapshot de nome/preço).
    coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'nome', it.nome_snapshot,
          'preco', it.preco_snapshot
        ) order by it.ordem
      )
      from proposta_itens it
      where it.proposta_id = prop.id),
      '[]'::jsonb
    ) as itens
  from perfis pf
  where pf.id = prop.usuaria_id;
end $$;

grant execute on function public.proposta_publica(text) to anon, authenticated;
