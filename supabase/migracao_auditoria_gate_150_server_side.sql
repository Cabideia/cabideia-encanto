-- ============================================================
-- Auditoria 360 — enforcement server-side do limite de 150 imagens
-- Aplicada em produção via migration `auditoria_gate_150_imagens_server_side`.
-- ------------------------------------------------------------
-- Até aqui o teto de 150 imagens do plano Grátis era checado SÓ no cliente
-- (podeAdicionar/LimiteModal), burlável por quem chamasse a API direto com a
-- chave anon. Este trigger é o backstop no banco.
--
-- Conta como imagem (igual a total_imagens_usuaria):
--   trabalhos (toda linha) + inspiracoes.foto_path + pedidos.foto_referencia_path
-- Ilimitado (fundadora ou plano vitrine ativo) nunca é barrado.
-- BEFORE INSERT nas 3 tabelas; em pedidos também BEFORE UPDATE, pois a foto de
-- referência costuma ser anexada depois (transição null -> não-null).
--
-- Verificado em produção (bloco com ROLLBACK): usuário grátis é barrado no 151º;
-- fundadora/vitrine passa. Os hooks do cliente já fazem rollback do upload no
-- storage quando o INSERT falha, então uma rejeição do trigger não deixa órfão.
-- ============================================================

create or replace function public.checar_limite_imagens()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  consome boolean := false;
  ja_tinha boolean := false;
  a record;
  total int;
begin
  if TG_TABLE_NAME = 'trabalhos' then
    consome := true;  -- todo trabalho tem foto
  elsif TG_TABLE_NAME = 'inspiracoes' then
    consome := (NEW.foto_path is not null);
    if TG_OP = 'UPDATE' then ja_tinha := (OLD.foto_path is not null); end if;
  elsif TG_TABLE_NAME = 'pedidos' then
    consome := (NEW.foto_referencia_path is not null);
    if TG_OP = 'UPDATE' then ja_tinha := (OLD.foto_referencia_path is not null); end if;
  end if;

  -- Só barra quando a operação passa a consumir um slot novo (0 -> 1).
  if not consome or ja_tinha then
    return NEW;
  end if;

  -- Plano ilimitado nunca é barrado.
  select fundadora, plano, status into a from assinaturas where usuaria_id = NEW.usuaria_id;
  if a.fundadora or (a.plano = 'vitrine' and a.status = 'ativa') then
    return NEW;
  end if;

  total := public.total_imagens_usuaria(NEW.usuaria_id);
  if total >= 150 then
    raise exception 'limite_imagens_atingido'
      using hint = 'Plano Gratis permite ate 150 imagens.',
            errcode = 'check_violation';
  end if;

  return NEW;
end $fn$;

drop trigger if exists trg_limite_trabalhos on trabalhos;
drop trigger if exists trg_limite_inspiracoes on inspiracoes;
drop trigger if exists trg_limite_pedidos on pedidos;

create trigger trg_limite_trabalhos   before insert            on trabalhos
  for each row execute function public.checar_limite_imagens();
create trigger trg_limite_inspiracoes before insert            on inspiracoes
  for each row execute function public.checar_limite_imagens();
create trigger trg_limite_pedidos     before insert or update  on pedidos
  for each row execute function public.checar_limite_imagens();
