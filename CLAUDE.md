# CLAUDE.md — Cabideia · Encanto

Orientações de trabalho para o agente (Claude / "o Code") neste repositório.

## Fluxo de PR e merge

**Decisão #33 — o Code ABRE PRs e NUNCA mescla.**
O merge é sempre da Josiane. Sem exceção — nem para documentação, nem para
mudanças triviais. O agente:

- desenvolve na branch designada da tarefa;
- faz commit e push;
- abre o Pull Request para `main`;
- **para por aí.** Nunca clica em merge, nunca faz squash/rebase-and-merge,
  nunca usa auto-merge. Quem decide e mescla é a Josiane.

Depois que a Josiane mescla, o agente reporta o SHA quando pedido.

## Banco de dados

**Decisão #28 — ZERO schema pelo agente.**
Nenhuma DDL (create/alter/drop de tabela, coluna, tipo, RPC, policy) parte do
agente. Antes de codar qualquer coisa que toque o banco, **faça introspecção**
do schema em produção (via MCP do Supabase) e programe contra o que já existe.
Se a tarefa *parecer* precisar de DDL, **PARE e reporte** — a DDL é aplicada
pela gestão via MCP, e o PR do agente é só **paridade** (versiona o SQL já
aplicado, sem reaplicar nem alterar).

## Decisões de produto referenciadas

- **Decisão #32 — M-048 = B1.** A conversão proposta → pedido leva a coleção
  de referências (`proposta_referencias` → `pedido_referencias`), e a UI de
  referências fica disponível também nos pedidos convertidos.

## Estilo

- Português nos textos de UI, comentários e mensagens de commit.
- Toast único (`useAviso`); tokens visuais v5; mobile-first; sem barra inferior
  nas telas públicas.
- Espelhar os padrões existentes (proposta ↔ pedido costumam andar em paridade).
