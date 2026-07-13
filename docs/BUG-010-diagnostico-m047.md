# BUG-010 (Sev A) — Diagnóstico: M-047 não persiste token nem referência

**Escopo:** somente diagnóstico (sem correção — lição M-040).
**Evidência de produção:** teste da usuária em 11/07/2026, 21:55–22:05 (SP); `pedido_referencias` com 0 linhas (histórico total); 0 tokens em `pedidos`; logs do postgres sem rejeição no período; proposta pública funciona.
**Método:** leitura do código em `origin/main` (HEAD `6e35e4d`) + introspecção **somente-leitura** do banco de produção (projeto `chrlexerkurmydavalgd`) em 13/07.

## Fatos novos levantados no banco (base das conclusões)

| Verificação | Resultado |
|---|---|
| Migração `m047_pedido_publico` | **Aplicada** em 10/07 17:19 UTC — coluna `pedidos.token`, índice único, `pedido_referencias.foto_publica_path` e RPC `pedido_publico` existem |
| `pedidos` | 5 linhas, **0 com token**; **3 das 5 vieram de proposta** (`proposta_id` preenchido), incluindo a mais recente (10/07); **nenhum pedido criado em 11/07** |
| `pedido_referencias` | 0 linhas (confirma a evidência) |
| `proposta_referencias` / `propostas` | 35 linhas / 4 propostas com token — o lado proposta é usado e funciona |
| RLS | `dona_pedidos` ≡ `dona_propostas` (ALL, `usuaria_id = auth.uid()`); `dona_pedido_referencias` ≡ `dona_proposta_referencias` (subquery de posse). **RLS não é a causa** |
| Migração fora do repo | `seguranca_r2_selecoes_grants_gatilhos` aplicada 2× em 12/07 00:20/00:22 UTC = **11/07 21:20/21:22 SP, ~35 min antes do teste**. Revoga escrita só de `anon` e EXECUTE de funções-gatilho. **Não bloqueou o teste** — prova abaixo |
| Única escrita na janela do teste | INSERT em `trabalhos` às 12/07 00:59:28 UTC (**21:59:28 SP, meio da janela**), com `pedido_id = NULL` e sem descrição — os triggers `set_codigo_trabalho` e `checar_limite_imagens` dispararam normalmente |

A escrita em `trabalhos` às 21:59 SP prova que **sessão, rede, grants, triggers e RLS funcionavam no device durante o teste**. Nenhuma tentativa de escrita (nem com erro) chegou a `pedidos` ou `pedido_referencias`: o código do M-047 **nunca executou** naquele fluxo.

---

## D1 — Botão compartilhar: o token é persistido antes de montar a URL? Qual URL?

**Sim, a ordem está correta e não há UI otimista.** `compartilharLink` (`src/pages/PedidoDetalhe.tsx:170-198`):

1. `await garantirToken(pedido.id)` (`src/hooks/usePedidos.ts:296-310`) — reusa `token` se existir; senão gera (`gerarToken`, 24 chars, alfabeto sem ambíguos) e persiste via `update({ token }).eq('id', id).select('token').single()`. O `.select().single()` confirma a linha gravada; **erro ⇒ retorna `null`**.
2. Se `null` ⇒ toast "Não consegui gerar o link. Tente de novo." e **retorno antecipado — nenhuma URL é montada** (`PedidoDetalhe.tsx:175-178`).
3. Só depois: `garantirFotosPublicas` (melhor esforço) e a URL.

**URL exata:** `https://cabideia.com.br/encanto/pedido/${token}` (`PedidoDetalhe.tsx:147-149`) — casa com a rota `/pedido/:token` (`src/App.tsx:124`, basename `/encanto`) e espelha a proposta (`PropostaForm.tsx:479`; `usePropostas.ts:178-192` é o mesmo código com outra tabela).

**Conclusão D1:** sem defeito no mecanismo. Se o botão tivesse sido tocado no bundle M-047, ou existiria token no banco, ou existiria um erro registrado/toast de falha. Zero token + zero erro + zero tentativa ⇒ **o botão não existia (ou não foi tocado) no bundle que rodava no device** — ver D3/D4.

## D2 — "Selecionar referências": insere? copia para o bucket? catch engolindo? UI otimista?

**O anexar insere e propaga erro; não é otimista.** `usePedidoReferencias.adicionar` (`src/hooks/usePedidoReferencias.ts:83-125`): deduplica, calcula `ordem`, `insert` em `pedido_referencias` e **retorna a mensagem de erro** do Supabase, que o picker exibe em toast (`PedidoReferencias.tsx:72-73`). A lista é recarregada do banco (`carregar()`) após o insert; a navegação de volta só acontece no sucesso. Não há `catch` engolindo o insert.

**Ressalvas encontradas (não explicam 0 linhas, mas são reais):**

- **A cópia para o bucket `publico` NÃO acontece no anexar** — só no compartilhar (`garantirFotosPublicas`, chamada em `compartilharLink`). E essa etapa é melhor-esforço com **erros engolidos**: `copiarParaPublico` retorna `null` em qualquer falha (download/upload) e `garantirFotosPublicas` simplesmente segue (`usePedidoReferencias.ts:150-192`). Falha ali ⇒ página pública sem fotos, silenciosamente. (É espelho fiel da proposta F2b, que convive com o mesmo risco.)
- Caso degenerado: se todos os itens selecionados já forem referência, `adicionar` devolve `null` e o picker mostra "Referência adicionada ✓" sem inserir (`usePedidoReferencias.ts:110`). Inalcançável no uso normal (a grade filtra os já referenciados) — só em corrida de duas abas.

**Conclusão D2:** a persistência do anexar é sólida. O problema não está aqui — está em **quando o picker está acessível** (D3).

## D3 — Por que `proposta_referencias` funciona e `pedido_referencias` nunca recebeu uma linha?

Os hooks e pickers são espelhos linha a linha (`usePedidoReferencias` ≡ `usePropostaReferencias`; `PedidoReferencias.tsx` ≡ `PropostaReferencias.tsx`), com RLS idêntica. **A divergência não é de persistência — é de acesso ao fluxo:**

1. **Gate por `proposta_id` no detalhe do pedido.** A seção "Referências" e o botão "Selecionar referências" só aparecem para pedido avulso: `(referencias.length > 0 || !pedido.proposta_id)` (`PedidoDetalhe.tsx:327`) e `{!pedido.proposta_id && …}` (`PedidoDetalhe.tsx:396-405`). **Pedido convertido de proposta não tem nenhuma UI para receber referências.** Em produção, 3 dos 5 pedidos (incluindo o mais recente) vieram de proposta.
2. **A conversão M-039 não copia as referências.** O comentário do hook antecipa isso — "`adicionar` recebe o pedido alvo explicitamente, para a Fase 2 conseguir copiar as referências da proposta para o pedido recém-criado na conversão" (`usePedidoReferencias.ts:13-15`) — mas **nenhum chamador faz a cópia**: `PedidoForm.salvar` (`PedidoForm.tsx:216-293`) copia só a foto de capa (`blobNovo → subirReferencia`) e grava `proposta_id`; `proposta_referencias → pedido_referencias` nunca acontece. A "Fase 2" ficou não implementada.
3. **Consequência direta no M-047:** a RPC `pedido_publico` monta o array `fotos` exclusivamente de `pedido_referencias` (migração, linhas 54-65). Logo, o link público de um pedido convertido **nunca terá as fotos escolhidas na proposta** — mesmo com token funcionando.
4. **No lado proposta, o picker está sempre acessível** no form (`/propostas/:id/referencias`), por isso a tabela tem 35 linhas e 4 tokens — o hábito de uso real da usuária está todo na proposta.

**Reconstrução do teste de 11/07:** a única escrita foi um trabalho avulso às 21:59 SP (`pedido_id NULL` — fluxo "Meus Trabalhos", não vinculado a pedido). Duas leituras compatíveis com "completou anexar → compartilhar → abrir link" sem nenhum toque em `pedidos`/`pedido_referencias`:

- **(a) Bundle anterior ao M-047 no device.** O app é PWA com `vite-plugin-pwa` `registerType: 'autoUpdate'` — o bundle novo só ativa na **abertura seguinte** do app. M-047 entrou em main às 09:35 SP do próprio dia 11/07 (merge #32; HEAD #33 às 15:54 SP). Se o device servia bundle velho, o botão "Compartilhar com a cliente" nem existia, e o "compartilhar → abrir link" completado foi o da **proposta** (que funciona — consistente com a evidência).
- **(b) Bundle atual, mas pedido testado veio de proposta.** Sem picker no pedido (gate do item 1), o "anexar" foi feito na proposta, e o compartilhar/abrir idem.

Em ambas, o código M-047 nunca rodou — exatamente o que o banco mostra (zero escrita, zero rejeição). **O SHA do rodapé (D4) decide entre (a) e (b).**

## D4 — Os 5 itens do spec M-047 estão em main e no deploy?

**Em `origin/main` (HEAD `6e35e4d`): os 5 itens presentes e conferidos.**

| # | Item do spec | Onde | Status |
|---|---|---|---|
| 1 | Botão "Compartilhar com a cliente" (gera/reusa token, fotos públicas, WhatsApp/share) | `PedidoDetalhe.tsx:170-198, 290-298` | ✓ |
| 2 | `usePedidos`: coluna/estado `token` + `garantirToken` | `usePedidos.ts:23, 296-310` | ✓ |
| 3 | `usePedidoReferencias`: `garantirFotosPublicas` + limpeza da cópia pública no remover | `usePedidoReferencias.ts:128-192` | ✓ |
| 4 | Rota pública `/pedido/:token` + `PedidoPublico` consumindo **só** a RPC | `App.tsx:124`; `PedidoPublico.tsx:74` | ✓ |
| 5 | Migração `m047_pedido_publico` (paridade) | repo + **aplicada em produção 10/07 17:19 UTC** (verificado por introspecção) | ✓ |

**Deploy:** esta sessão não alcança `cabideia.com.br` (política de rede) — a comparação final fica pendente do **SHA do rodapé que a Josiane vai informar** (selo `semver · SHA · dd/mm hh:mm`, lido no próprio device — o selo reflete o bundle que o service worker está de fato servindo).

Gabarito para a comparação:

- **`6e35e4d`** (merge #33, 11/07 15:54 SP) ou **`6f8b378`** (merge #32, 11/07 09:35 SP) ⇒ bundle **com** M-047 ⇒ hipótese (b) do D3.
- Qualquer outro SHA (ex.: `05f0e80`, `b78fade`) ou data de build anterior a 11/07 09:35 ⇒ bundle **sem** M-047 no device ⇒ hipótese (a) confirmada.

Obs.: o clone desta sessão tinha `main` local desatualizado em `b78fade` — o M-047 **está** em `origin/main`; não há problema no repositório.

## T2 — `usePedidos.ts:203`: write legado alcançável ou morto?

A linha 203 é o `.from('acervo').upload(...)` dentro de `subirReferencia` (`usePedidos.ts:199-207`), que grava a foto de referência legada em `acervo/{uid}/referencias/`.

**Alcançável, por um único caminho:** `PedidoForm.tsx:239` chama `subirReferencia(blobNovo)`, e `blobNovo` só é preenchido na **conversão proposta → pedido quando a proposta tem capa** (`PedidoForm.tsx:181-188`: baixa `proposta.foto_path` do bucket `publico` e sobe uma cópia). Para pedido avulso e para edição o caminho está **morto** — o I4 removeu a captura de foto do form (`fotoPath` só preserva o valor legado ao salvar edição, `PedidoForm.tsx:83-87, 144-145`).

**Não remover sem decisão:** esse write legado é o que alimenta `pedidos.foto_referencia_path` na conversão, e a RPC `pedido_publico` usa exatamente essa coluna como **fallback de foto** do link público (migração, linha 53). Hoje, para pedido convertido (que não tem `pedido_referencias` — D3.2), é a única imagem que a página pública consegue mostrar.

---

## Síntese e próximos passos (sem correção neste ciclo)

1. **Nenhum defeito de persistência foi encontrado** no código M-047: token e insert de referências gravam e propagam erro corretamente; RLS e migração de produção estão certas.
2. A causa do BUG-010 é que **o código M-047 não executou no teste**: bundle velho no device (PWA/SW) e/ou pedido de teste convertido de proposta, que não expõe o fluxo. O SHA do rodapé decide.
3. **Defeitos reais e independentes a registrar** (para correção futura, mediante OK):
   - **(i)** Conversão M-039 não copia `proposta_referencias → pedido_referencias` (a "Fase 2" prevista no comentário do hook nunca foi implementada).
   - **(ii)** Pedido vindo de proposta não tem UI para gerenciar referências, mas seu link público depende delas — combinado com (i), o link público de pedido convertido sai sempre sem galeria.
   - **(iii)** `garantirFotosPublicas`/`copiarParaPublico` engolem erros — falha na cópia gera página pública sem fotos, sem qualquer aviso.
4. **Reteste sugerido:** com o selo do rodapé confirmando `6e35e4d` (ou posterior) **no device**, repetir o fluxo com um pedido **avulso**: anexar referências → compartilhar → conferir `pedidos.token` e `pedido_referencias` no banco.
