-- Controle de acessos: papéis admin | viewer
-- Execute no Supabase SQL Editor ou via migração

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'viewer');
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT public.get_user_role() = 'admin';
$$;

REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores';
  END IF;
  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    coalesce(u.raw_app_meta_data ->> 'role', 'viewer'),
    u.created_at,
    u.last_sign_in_at
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(target_user_id uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores';
  END IF;
  IF new_role NOT IN ('admin', 'viewer') THEN
    RAISE EXCEPTION 'Papel inválido. Use admin ou viewer.';
  END IF;
  UPDATE auth.users
  SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role)
  WHERE id = target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;

-- RLS: escrita somente admin
DROP POLICY IF EXISTS "Authenticated users can insert assets" ON public.assets;
DROP POLICY IF EXISTS "Authenticated users can update assets" ON public.assets;
DROP POLICY IF EXISTS "Authenticated users can delete assets" ON public.assets;
DROP POLICY IF EXISTS "Admins can insert assets" ON public.assets;
DROP POLICY IF EXISTS "Admins can update assets" ON public.assets;
DROP POLICY IF EXISTS "Admins can delete assets" ON public.assets;

CREATE POLICY "Admins can insert assets"
  ON public.assets FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update assets"
  ON public.assets FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete assets"
  ON public.assets FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can insert asset_photos" ON public.asset_photos;
DROP POLICY IF EXISTS "Authenticated users can delete asset_photos" ON public.asset_photos;
DROP POLICY IF EXISTS "Admins can insert asset_photos" ON public.asset_photos;
DROP POLICY IF EXISTS "Admins can delete asset_photos" ON public.asset_photos;

CREATE POLICY "Admins can insert asset_photos"
  ON public.asset_photos FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete asset_photos"
  ON public.asset_photos FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can insert asset_custody_history" ON public.asset_custody_history;
DROP POLICY IF EXISTS "Authenticated users can update asset_custody_history" ON public.asset_custody_history;
DROP POLICY IF EXISTS "Admins can insert asset_custody_history" ON public.asset_custody_history;
DROP POLICY IF EXISTS "Admins can update asset_custody_history" ON public.asset_custody_history;

CREATE POLICY "Admins can insert asset_custody_history"
  ON public.asset_custody_history FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update asset_custody_history"
  ON public.asset_custody_history FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Auth upload assets storage" ON storage.objects;
DROP POLICY IF EXISTS "Auth update assets storage" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete assets storage" ON storage.objects;
DROP POLICY IF EXISTS "Admins upload assets storage" ON storage.objects;
DROP POLICY IF EXISTS "Admins update assets storage" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete assets storage" ON storage.objects;

CREATE POLICY "Admins upload assets storage"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assets' AND public.is_admin());

CREATE POLICY "Admins update assets storage"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'assets' AND public.is_admin());

CREATE POLICY "Admins delete assets storage"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'assets' AND public.is_admin());
