-- =============================================
--  Histórico de custódia + senha do dispositivo
--  Aplicado via Supabase MCP (sem exclusão de dados)
--  Execute manualmente se precisar replicar em outro ambiente
-- =============================================

-- Senha do dispositivo (notebook e celular)
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS senha_dispositivo VARCHAR(200);

-- Histórico de custódia (responsável + setor + período)
CREATE TABLE IF NOT EXISTS public.asset_custody_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id     UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  responsavel  VARCHAR(200),
  departamento VARCHAR(100) NOT NULL,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_asset_custody_history_asset_id
  ON public.asset_custody_history(asset_id);

CREATE INDEX IF NOT EXISTS idx_asset_custody_history_active
  ON public.asset_custody_history(asset_id)
  WHERE ended_at IS NULL;

ALTER TABLE public.asset_custody_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read asset_custody_history" ON public.asset_custody_history;
DROP POLICY IF EXISTS "Authenticated users can insert asset_custody_history" ON public.asset_custody_history;
DROP POLICY IF EXISTS "Authenticated users can update asset_custody_history" ON public.asset_custody_history;

CREATE POLICY "Authenticated users can read asset_custody_history"
  ON public.asset_custody_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert asset_custody_history"
  ON public.asset_custody_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update asset_custody_history"
  ON public.asset_custody_history FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Backfill: registra custódia atual dos ativos existentes (sem apagar dados)
INSERT INTO public.asset_custody_history (asset_id, responsavel, departamento, started_at, ended_at)
SELECT
  a.id,
  a.responsavel,
  a.departamento,
  COALESCE(a.created_at, NOW()),
  NULL
FROM public.assets a
WHERE NOT EXISTS (
  SELECT 1 FROM public.asset_custody_history h WHERE h.asset_id = a.id
);
