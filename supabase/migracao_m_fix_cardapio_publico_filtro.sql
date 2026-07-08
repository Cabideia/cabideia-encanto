-- ============================================================
-- m_fix_cardapio_publico_filtro (20260708014537) — JÁ APLICADA em produção
-- pela gestão; registrada aqui para paridade do repositório.
--
-- BUG fix: cardapio_publico devolvia itens de TODAS as usuárias.
-- Causa: parâmetro "arroba" sombreado pela coluna perfis.arroba
-- ("where p.arroba = arroba" resolvia coluna=coluna, sempre verdadeiro).
-- Correção: qualificar o parâmetro com o nome da função, no padrão
-- das funções irmãs (perfil_vitrine, vitrine_publica).
-- ============================================================
CREATE OR REPLACE FUNCTION public.cardapio_publico(arroba text)
 RETURNS TABLE(id uuid, nome text, detalhes text, unidade text, preco_base numeric, preco_sob_consulta boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id, c.nome, c.detalhes, c.unidade, c.preco_base, c.preco_sob_consulta
  from cardapio_itens c
  join perfis p on p.id = c.usuaria_id
  where p.arroba = cardapio_publico.arroba
    and p.vitrine_publicada = true
    and c.na_vitrine = true
  order by c.nome;
$function$;
