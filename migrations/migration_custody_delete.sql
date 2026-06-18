-- Permite exclusão de registros de custódia apenas para administradores
DROP POLICY IF EXISTS "Admins can delete asset_custody_history" ON public.asset_custody_history;

CREATE POLICY "Admins can delete asset_custody_history"
  ON public.asset_custody_history FOR DELETE TO authenticated
  USING (public.is_admin());
