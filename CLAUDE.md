# Cabideia Encanto

PWA de gestão para o ateliê da Josiane: acervo, clientes, propostas, pedidos,
cardápio, assinatura. React 18 + TypeScript + Vite (`vite-plugin-pwa`),
backend em Supabase (Postgres + RLS + Edge Functions). Pagamentos via Mercado Pago.

## Stack e estrutura

- `src/pages/` — telas (uma por rota). `src/components/` — UI reutilizável.
- `src/hooks/` — acesso a dados por domínio (`usePropostas`, `usePedidos`,
  `useClientes`, …). É aqui que fica a maior parte da lógica de negócio do front.
- `src/lib/` — infra: `supabase.ts` (client), `storage.ts`, `imagem.ts`,
  `proposta.ts`, `datas.ts`, `tema.ts`, `compartilhar.ts`.
- `supabase/` — `cabideia_encanto_schema.sql` (schema base) e arquivos
  `migracao_*.sql` (paridade de cada alteração aplicada). `supabase/functions/`
  guarda as Edge Functions (`criar-pagamento`, `mercadopago-webhook`,
  `excluir-conta`).

## Build

- `npm run dev` — servidor de desenvolvimento (Vite).
- `npm run build` — `tsc --noEmit` + build + `scripts/pos-build.mjs`. O typecheck
  faz parte do build; rode antes de entregar um PR.

## Processo de trabalho (decisão #28 da Josiane — vale para todas as fases)

### 1. Front-end — implementação em bloco
Pode implementar em bloco, sem aguardar OK item a item. A Josiane valida no
device via PR. O relatório de 5 partes **não** é mais obrigatório por item no
front. **Mas sinalize no corpo do PR toda decisão de design não trivial**
(layout, comportamento, trade-off de UX) para ela decidir.

### 2. Migrações / Schema — LINHA VERMELHA INEGOCIÁVEL
Nenhuma alteração de banco — `create`/`alter table`, coluna, constraint, RLS,
função, trigger — pode ser aplicada sem o crivo completo:

1. Apresentar o **DDL exato** à gestão.
2. A gestão inspeciona.
3. **OK explícito da Josiane.**
4. A **gestão aplica** a migração. O agente **apenas commita o arquivo de
   paridade** correspondente em `supabase/` (`migracao_*.sql`).

Quando o trabalho esbarrar em schema: **PARE no DDL e aguarde.** Não aplique,
não use atalho de MCP para aplicar, não peça para aplicar antes do OK. Schema é
difícil de reverter e é onde mora o risco.

> Exceção histórica (não repetir): na F2a a coluna `modo_preco` (text NULL +
> CHECK `fechado`/`itens`/`sem`) foi aplicada sem esse crivo. O resultado foi
> aceito, mas o processo não se repete.

### 3. Sem acompanhamento automático de PR
Não ativar autofix nem CI-watch, não se inscrever em eventos de PR. Fluxo:
o agente entrega o PR → a Josiane testa no device → a gestão faz a ponte.
