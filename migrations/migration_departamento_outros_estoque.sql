-- =============================================
--  Departamento "Outros" + responsável em Estoque
--  Aplicado via Supabase MCP (sem exclusão de dados)
-- =============================================

COMMENT ON COLUMN public.assets.departamento IS
  'Setor do ativo. Lista predefinida ou texto livre cadastrado via opção Outros.';

COMMENT ON COLUMN public.assets.responsavel IS
  'Responsável atual. Automaticamente NULL quando status = Estoque.';

CREATE OR REPLACE FUNCTION public.clear_responsavel_on_estoque()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'Estoque' THEN
    NEW.responsavel := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assets_clear_responsavel_on_estoque ON public.assets;

CREATE TRIGGER assets_clear_responsavel_on_estoque
  BEFORE INSERT OR UPDATE OF status, responsavel ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_responsavel_on_estoque();
