-- =============================================
--  HubOn Gestão de Patrimônio - Database Setup
--  Execute no Supabase SQL Editor (Dashboard → SQL Editor)
-- =============================================

-- 1. Tabela de ativos (notebooks e celulares)
CREATE TABLE IF NOT EXISTS public.assets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                VARCHAR(20) NOT NULL CHECK (type IN ('notebook', 'celular')),
  patrimonio          VARCHAR(100) NOT NULL,
  imei                VARCHAR(20),
  modelo              VARCHAR(200) NOT NULL,
  armazenamento       VARCHAR(50),
  ano                 INTEGER NOT NULL CHECK (ano >= 2000 AND ano <= 2099),
  status              VARCHAR(20) NOT NULL CHECK (status IN ('Em uso', 'Manutenção', 'Estoque')),
  departamento        VARCHAR(100) NOT NULL,
  responsavel         VARCHAR(200),
  observacoes         TEXT,
  nota                DECIMAL(3,1) DEFAULT 5.0 CHECK (nota >= 0 AND nota <= 10),
  -- Campos exclusivos de Notebook
  ram                 VARCHAR(50),
  placa_video         VARCHAR(100),
  estado_bateria      VARCHAR(50),
  estado_carregador   VARCHAR(100),
  versao_windows      VARCHAR(50),
  teclado_funcionando BOOLEAN DEFAULT TRUE,
  observacoes_teclado TEXT,
  tem_leitora         BOOLEAN DEFAULT FALSE,
  tipo_conexao        VARCHAR(50),
  banda_wifi          VARCHAR(50),
  usb_funcionando     BOOLEAN DEFAULT TRUE,
  observacoes_usb     TEXT,
  precisa_adaptador   BOOLEAN DEFAULT FALSE,
  antivirus           VARCHAR(100),
  pastas_servidor     TEXT,
  pastas_dropbox      TEXT,
  office_instalado    BOOLEAN DEFAULT FALSE,
  -- Campos exclusivos de Celular
  numero_linha        VARCHAR(20),
  operadora           VARCHAR(50),
  conta_nuvem         VARCHAR(200),
  pin_bloqueio        VARCHAR(50),
  condicao_tela       VARCHAR(50),
  acessorios          TEXT,
  -- Metadados
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Tabela de fotos dos ativos
CREATE TABLE IF NOT EXISTS public.asset_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id     UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_assets_updated_at ON public.assets;
CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Habilitar Row Level Security
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_photos ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS para assets
DROP POLICY IF EXISTS "Authenticated users can read assets"   ON public.assets;
DROP POLICY IF EXISTS "Authenticated users can insert assets" ON public.assets;
DROP POLICY IF EXISTS "Authenticated users can update assets" ON public.assets;
DROP POLICY IF EXISTS "Authenticated users can delete assets" ON public.assets;

CREATE POLICY "Authenticated users can read assets"
  ON public.assets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert assets"
  ON public.assets FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update assets"
  ON public.assets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete assets"
  ON public.assets FOR DELETE TO authenticated USING (true);

-- 6. Políticas RLS para asset_photos
DROP POLICY IF EXISTS "Authenticated users can read asset_photos"   ON public.asset_photos;
DROP POLICY IF EXISTS "Authenticated users can insert asset_photos" ON public.asset_photos;
DROP POLICY IF EXISTS "Authenticated users can delete asset_photos" ON public.asset_photos;

CREATE POLICY "Authenticated users can read asset_photos"
  ON public.asset_photos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert asset_photos"
  ON public.asset_photos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete asset_photos"
  ON public.asset_photos FOR DELETE TO authenticated USING (true);

-- 7. Bucket de Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assets', 'assets', true, 10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 8. Políticas de Storage
DROP POLICY IF EXISTS "Public read assets storage"    ON storage.objects;
DROP POLICY IF EXISTS "Auth upload assets storage"    ON storage.objects;
DROP POLICY IF EXISTS "Auth update assets storage"    ON storage.objects;
DROP POLICY IF EXISTS "Auth delete assets storage"    ON storage.objects;

CREATE POLICY "Public read assets storage"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'assets');

CREATE POLICY "Auth upload assets storage"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assets');

CREATE POLICY "Auth update assets storage"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'assets');

CREATE POLICY "Auth delete assets storage"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'assets');
