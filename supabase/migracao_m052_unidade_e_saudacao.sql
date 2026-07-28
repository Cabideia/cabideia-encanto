-- M-052 (R3) · unidade/quantidade dos itens na proposta_publica +
-- cliente_primeiro_nome/arroba na saudacao (espelha o padrao ja usado em
-- pedido_publico). DROP+CREATE da RPC com REVOKE/GRANT reaplicados na MESMA
-- migracao (armadilha #4 / licao TEC-002 — DROP+CREATE restaura o EXECUTE
-- default para PUBLIC).
--
-- Aditiva: so acrescenta chaves no jsonb de itens e duas colunas novas no
-- retorno da funcao. Nenhuma tabela e alterada; proposta_itens.unidade_snapshot
-- e .quantidade ja existiam antes desta migracao.

drop function if exists public.proposta_publica(text);

create function public.proposta_publica(p_token text)
returns table(
  titulo text, descricao text, detalhes text, condicoes text, valor numeric,
  modo_preco text, validade date, negocio text, whatsapp text, logo_path text,
  tema text, foto_path text, itens jsonb, fotos jsonb, cardapio_path text,
  cliente_primeiro_nome text, arroba text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare prop record;
begin
  select p.id, p.titulo, p.descricao, p.detalhes, p.condicoes, p.valor, p.modo_preco,
         p.validade, p.foto_path, p.usuaria_id, p.incluir_cardapio, p.cliente_id
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
        'nome', pi.nome_snapshot, 'preco', pi.preco_snapshot,
        'quantidade', pi.quantidade, 'unidade', pi.unidade_snapshot) order by pi.ordem)
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
    case when prop.incluir_cardapio then perf.cardapio_path else null end,
    (select split_part(c.nome, ' ', 1) from clientes c where c.id = prop.cliente_id),
    perf.arroba
  from perfis perf where perf.id = prop.usuaria_id;
end
$function$;

revoke all on function public.proposta_publica(text) from public;
grant execute on function public.proposta_publica(text) to anon, authenticated;
