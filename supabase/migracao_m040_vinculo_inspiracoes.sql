-- ============================================================
-- M-040 · Vínculo de inspirações pelo pedido (Onda B)
--
-- Duas colunas novas em `pedidos`, ambas opcionais e retrocompatíveis:
--
--  • link_inspiracao — URL que a cliente mandou (Pinterest, Instagram…),
--    texto livre, só exibição (abre no navegador).
--
--  • tag_id — a "tag-ponte" do pedido. O botão "Guardar inspirações deste
--    pedido" cria/reusa uma tag (tabela `tags`, compartilhada entre acervo e
--    inspirações) e grava o vínculo aqui. "Ver inspirações do pedido" abre a
--    galeria filtrada por essa tag. FK direta (não derivação por nome) para
--    sobreviver a renomeações de tag e de pedido; se a tag for apagada, o
--    vínculo some junto (set null) e o botão deixa de aparecer.
--
-- Não toca em pedidos.tema (que no app é o campo "Detalhes do pedido") nem
-- em pedidos.inspiracao_id (anexo 1:1 existente, que segue funcionando).
-- ============================================================

alter table pedidos add column if not exists link_inspiracao text;

alter table pedidos add column if not exists tag_id uuid
  references tags (id) on delete set null;
