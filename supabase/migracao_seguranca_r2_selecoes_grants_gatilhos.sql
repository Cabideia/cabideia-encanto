-- A-R2-01 (Sev A): fecha leitura cross-tenant por contas logadas.
-- Caminho público segue 100% via RPC selecao_publica(p_token), SECURITY DEFINER.
drop policy if exists selecao_publica_leitura on public.selecoes;
drop policy if exists selecao_itens_publicos on public.selecao_itens;
drop policy if exists selecao_trabalhos_publicos on public.trabalhos;

-- A-R2-02 (Sev M, ampliado): defesa em profundidade.
revoke select on table public.cardapio_itens, public.inspiracoes,
  public.inspiracao_tags, public.anotacoes, public.assinaturas from anon;
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon;

-- A-R2-04 (Sev B): gate de 150 também na transição link->foto.
create trigger trg_limite_inspiracoes_upd
  before update on public.inspiracoes
  for each row execute function public.checar_limite_imagens();

-- A-R2-05 (Sev B): funções-gatilho fora do alcance de /rest/v1/rpc/*.
revoke execute on function public.criar_perfil_no_cadastro() from public, anon, authenticated;
revoke execute on function public.set_codigo_trabalho()      from public, anon, authenticated;
revoke execute on function public.set_codigo_inspiracao()    from public, anon, authenticated;
revoke execute on function public.checar_limite_imagens()    from public, anon, authenticated;
revoke execute on function public.marcar_atualizado()        from public, anon, authenticated;
alter function public.marcar_atualizado() set search_path = public;
