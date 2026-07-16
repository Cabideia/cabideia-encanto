-- M-044 / Decisão #45 = A (A1-completo). Itens de proposta e pedido com
-- quantidade + unidade congelada; total calculado na aplicação (não persistido).
-- Aditiva e idempotente. Não toca cardapio_itens (tabela de preços = só preço unitário).

-- 1) PROPOSTA: quantidade + unidade congelada
ALTER TABLE public.proposta_itens
  ADD COLUMN IF NOT EXISTS quantidade numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unidade_snapshot text;

-- 2) PEDIDO: tabela de itens espelhando proposta_itens
CREATE TABLE IF NOT EXISTS public.pedido_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  cardapio_item_id uuid REFERENCES public.cardapio_itens(id) ON DELETE SET NULL,
  nome_snapshot text NOT NULL,
  preco_snapshot numeric,
  unidade_snapshot text,
  quantidade numeric NOT NULL DEFAULT 1,
  ordem integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;

-- RLS por subquery no pedido (padrão de dona_pedido_referencias / dona_proposta_itens)
DROP POLICY IF EXISTS dona_pedido_itens ON public.pedido_itens;
CREATE POLICY dona_pedido_itens ON public.pedido_itens
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_itens.pedido_id AND p.usuaria_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_itens.pedido_id AND p.usuaria_id = auth.uid()));

-- Defesa em profundidade: anon nunca acessa (espelha proposta_itens)
REVOKE ALL ON public.pedido_itens FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedido_itens TO authenticated;
