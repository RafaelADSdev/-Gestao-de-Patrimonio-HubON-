-- Fix: adiciona colunas faltantes na tabela assets
-- Execute no Supabase SQL Editor

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS imei                VARCHAR(20),
  ADD COLUMN IF NOT EXISTS observacoes         TEXT,
  ADD COLUMN IF NOT EXISTS ram                 VARCHAR(50),
  ADD COLUMN IF NOT EXISTS placa_video         VARCHAR(100),
  ADD COLUMN IF NOT EXISTS estado_bateria      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS estado_carregador   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS versao_windows      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS teclado_funcionando BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS observacoes_teclado TEXT,
  ADD COLUMN IF NOT EXISTS tem_leitora         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tipo_conexao        VARCHAR(50),
  ADD COLUMN IF NOT EXISTS banda_wifi          VARCHAR(50),
  ADD COLUMN IF NOT EXISTS usb_funcionando     BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS observacoes_usb     TEXT,
  ADD COLUMN IF NOT EXISTS precisa_adaptador   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS antivirus           VARCHAR(100),
  ADD COLUMN IF NOT EXISTS pastas_servidor     TEXT,
  ADD COLUMN IF NOT EXISTS pastas_dropbox      TEXT,
  ADD COLUMN IF NOT EXISTS office_instalado    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS numero_linha        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS operadora           VARCHAR(50),
  ADD COLUMN IF NOT EXISTS conta_nuvem         VARCHAR(200),
  ADD COLUMN IF NOT EXISTS pin_bloqueio        VARCHAR(50),
  ADD COLUMN IF NOT EXISTS condicao_tela       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS acessorios          TEXT;
