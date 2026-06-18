-- =============================================
--  Log de custódia: situação (Estoque) + edição admin
--  Aplicado via Supabase MCP (sem exclusão de dados)
-- =============================================

ALTER TABLE public.asset_custody_history
  ADD COLUMN IF NOT EXISTS asset_status VARCHAR(20) DEFAULT 'Em uso',
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.asset_custody_history h
SET asset_status = COALESCE(a.status, 'Em uso')
FROM public.assets a
WHERE h.asset_id = a.id
  AND (h.asset_status IS NULL OR h.asset_status = 'Em uso')
  AND h.ended_at IS NULL;

UPDATE public.asset_custody_history
SET asset_status = 'Em uso'
WHERE asset_status IS NULL;

COMMENT ON COLUMN public.asset_custody_history.asset_status IS
  'Situação do ativo no período: Em uso, Estoque ou Manutenção.';

COMMENT ON COLUMN public.asset_custody_history.observacoes IS
  'Observações do registro. Editável por administradores.';
