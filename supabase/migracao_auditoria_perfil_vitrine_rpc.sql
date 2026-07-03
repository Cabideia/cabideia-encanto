-- ============================================================
-- Auditoria 360 — cabeçalho da vitrine por RPC + revoga anon em perfis
-- Aplicada em produção via migration
-- `auditoria_perfil_vitrine_rpc_revoke_anon_perfis`.
-- ------------------------------------------------------------
-- A VitrinePublica lia `perfis` direto (SELECT do papel anon), o que permitia
-- raspar em massa telefones/dados de todas as vitrines publicadas usando a
-- chave anon pública. Passamos a servir só as colunas públicas de um perfil
-- PUBLICADO por uma RPC SECURITY DEFINER e revogamos o SELECT direto do anon.
--
-- A policy `vitrine_perfil_publico` é MANTIDA de propósito: o pré-check de
-- "@ já em uso" (PerfilForm) depende dela para o papel `authenticated`. Ela é
-- inócua para o anon após o revoke (GRANT é checado antes da RLS).
--
-- Residual conhecido (menor): um usuário `authenticated` ainda consegue ler
-- perfis publicados direto — mesmos dados já exibidos nas vitrines públicas,
-- porém agora atrás de cadastro. Fechar isso exigiria trocar o pré-check de @
-- por uma RPC dedicada e então dropar `vitrine_perfil_publico`.
-- ============================================================

create or replace function public.perfil_vitrine(arroba text)
returns table (
  id uuid,
  nome_negocio text,
  bio text,
  cidade text,
  nicho text,
  whatsapp text,
  logo_path text,
  tema text
)
language sql
security definer
set search_path to 'public'
as $fn$
  select p.id, p.nome_negocio, p.bio, p.cidade, p.nicho, p.whatsapp, p.logo_path,
         coalesce(p.tema, 'oficina')
  from perfis p
  where p.arroba = perfil_vitrine.arroba
    and p.vitrine_publicada = true;
$fn$;

revoke all on function public.perfil_vitrine(text) from public;
grant execute on function public.perfil_vitrine(text) to anon, authenticated;

revoke select on public.perfis from anon;
