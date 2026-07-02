-- ============================================================
-- Auditoria 360 — fecha exposições de leitura anônima
-- Aplicada em produção via migration
-- `auditoria_fecha_leitura_anon_e_listagem_bucket`.
-- ------------------------------------------------------------
-- 1) selecoes / selecao_itens / trabalhos eram legíveis diretamente pelo papel
--    `anon` via PostgREST (policies públicas com USING (expira_em > now()) e
--    vitrine/seleção públicas). Isso VAZAVA o token da seleção e permitia
--    enumerar fotos/descrições de todas as usuárias com a chave anon.
--
--    As páginas públicas (VitrinePublica, SelecaoPublica) usam SOMENTE as RPCs
--    SECURITY DEFINER (vitrine_publica, cardapio_publico, selecao_publica), que
--    leem essas tabelas como owner — logo o anon NÃO precisa de SELECT direto.
--    A dona continua lendo pelo papel `authenticated` (intacto).
--
--    Obs.: `perfis` NÃO é revogado de propósito — a VitrinePublica lê o
--    cabeçalho (nome, bio, cidade, whatsapp, logo, tema) direto da tabela.
--    Servir esse cabeçalho por RPC e então revogar `perfis` do anon fica como
--    melhoria futura (achado B-perfis, severidade média).
--
-- 2) Bucket público `publico` tinha policy de LISTAGEM (publico_leitura),
--    permitindo enumerar todos os arquivos de todas as usuárias. URLs públicas
--    continuam funcionando sem ela (bucket público serve /object/public/...).
-- ============================================================

revoke select on public.selecoes      from anon;
revoke select on public.selecao_itens from anon;
revoke select on public.trabalhos     from anon;

drop policy if exists publico_leitura on storage.objects;
