-- Ordem manual do histórico de custódia (sem apagar dados)
ALTER TABLE public.asset_custody_history
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY asset_id ORDER BY started_at DESC) AS rn
  FROM public.asset_custody_history
)
UPDATE public.asset_custody_history h
SET sort_order = ranked.rn
FROM ranked
WHERE h.id = ranked.id;

COMMENT ON COLUMN public.asset_custody_history.sort_order IS
  'Ordem de exibição do registro no histórico (menor = mais acima).';
