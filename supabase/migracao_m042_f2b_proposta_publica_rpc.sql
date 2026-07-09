-- ============================================================
-- M-042 · F2b · Leitura pública SÓ pela RPC + coluna da foto pública
-- JÁ APLICADA em produção pela gestão (com correção de segurança, duplo crivo).
-- Este arquivo existe para PARIDADE de histórico — NÃO reaplicar.
-- Reflete exatamente os objetos em produção (introspecção do schema).
-- ------------------------------------------------------------
-- Correção de segurança (fecha o vazamento apontado na revisão): a leitura
-- anônima direta das tabelas foi FECHADA. Só a RPC SECURITY DEFINER dá acesso
-- público, filtrando pelo token específico — igual à `selecao_publica`.
--
--   1. REVOKE SELECT + policies de leitura pública REMOVIDAS — o anônimo não lê
--      mais propostas/proposta_referencias/proposta_itens direto (não dá para
--      enumerar propostas ativas). A escrita segue restrita à dona (dona_*).
--   2. proposta_referencias.foto_publica_path — caminho da CÓPIA pública da
--      foto (bucket privado → público), gerada no cliente ao compartilhar
--      (mesmo mecanismo do M-022 / selecao_itens.foto_publica_path).
--   3. proposta_publica(p_token) — leitura anônima montada: filtra por token,
--      checa resolvida=false e devolve só o necessário, resolvendo o caminho
--      público das fotos.
-- ============================================================

-- ---------- 1 · Fecha a leitura anônima direta ----------
revoke select on public.propostas            from anon;
revoke select on public.proposta_referencias from anon;
revoke select on public.proposta_itens       from anon;

drop policy if exists proposta_publica_leitura on public.propostas;
drop policy if exists proposta_ref_publica     on public.proposta_referencias;
drop policy if exists proposta_itens_publica   on public.proposta_itens;

-- ---------- 2 · Caminho da cópia pública nas referências ----------
alter table public.proposta_referencias
  add column if not exists foto_publica_path text;

-- ---------- 3 · Leitura pública da proposta (anônima, por token) ----------
-- Colunas do retorno (nesta ordem — o front consome por nome):
--   titulo, descricao, condicoes, valor, modo_preco, validade,
--   negocio, whatsapp, logo_path, tema, foto_path (capa),
--   itens  jsonb → [{ nome, preco }]                         (tabela de preços)
--   fotos  jsonb → [{ foto_publica_path, url, origem }]      (referências)
create or replace function public.proposta_publica(p_token text)
returns table (
  titulo text,
  descricao text,
  condicoes text,
  valor numeric,
  modo_preco text,
  validade date,
  negocio text,
  whatsapp text,
  logo_path text,
  tema text,
  foto_path text,
  itens jsonb,
  fotos jsonb
)
language plpgsql security definer set search_path = public as $$
declare prop record;
begin
  select p.id, p.titulo, p.descricao, p.condicoes, p.valor, p.modo_preco,
         p.validade, p.foto_path, p.usuaria_id
    into prop
  from propostas p
  where p.token = p_token and p.resolvida = false;

  if prop.id is null then
    return; -- token inexistente ou proposta encerrada
  end if;

  return query
  select prop.titulo, prop.descricao, prop.condicoes, prop.valor, prop.modo_preco,
    prop.validade, perf.nome_negocio, perf.whatsapp, perf.logo_path,
    coalesce(perf.tema, 'oficina'), prop.foto_path,
    coalesce((select jsonb_agg(jsonb_build_object(
        'nome', pi.nome_snapshot, 'preco', pi.preco_snapshot) order by pi.ordem)
      from proposta_itens pi where pi.proposta_id = prop.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
        'foto_publica_path', coalesce(pr.foto_publica_path, t.foto_publica_path, t.foto_path),
        'url', i.url,
        'origem', case when pr.trabalho_id is not null then 'trabalho' else 'inspiracao' end)
        order by pr.ordem)
      from proposta_referencias pr
      left join trabalhos   t on t.id = pr.trabalho_id
      left join inspiracoes i on i.id = pr.inspiracao_id
      where pr.proposta_id = prop.id), '[]'::jsonb)
  from perfis perf where perf.id = prop.usuaria_id;
end $$;

grant execute on function public.proposta_publica(text) to anon, authenticated;
