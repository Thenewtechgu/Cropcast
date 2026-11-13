-- ==============================================================================
-- AgriNASA AI: Supabase Centralized NASA Data Warehouse Schema
-- PostgreSQL DDL with Unique Constraints, Foreign Keys & Row Level Security (RLS)
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. NASA Grid Cells Table (531 cells covering Vietnam at 0.5° resolution)
CREATE TABLE IF NOT EXISTS public.nasa_grid_cells (
  cell_id VARCHAR(50) PRIMARY KEY,
  lat NUMERIC(6, 3) NOT NULL,
  lon NUMERIC(6, 3) NOT NULL,
  region TEXT NOT NULL,
  sub_region TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for spatial lookup
CREATE INDEX IF NOT EXISTS idx_grid_coords ON public.nasa_grid_cells (lat, lon);

-- 3. NASA Daily Observations Table
-- Unique constraint on (cell_id, date, indicator_code) to prevent duplicates!
CREATE TABLE IF NOT EXISTS public.nasa_daily_data (
  id BIGSERIAL PRIMARY KEY,
  cell_id VARCHAR(50) NOT NULL REFERENCES public.nasa_grid_cells(cell_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  indicator_code VARCHAR(30) NOT NULL, -- T2M, T2M_MIN, T2M_MAX, PRECTOTCORR, GWETTOP, GWETROOT, RH2M, ALLSKY_SFC_SW_DWN
  value NUMERIC(10, 3) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  data_source VARCHAR(50) DEFAULT 'NASA_POWER_DAILY', -- NASA_POWER_HISTORICAL, NASA_POWER_DAILY, CSV_IMPORT
  quality_flag VARCHAR(20) DEFAULT 'VALID', -- VALID, ESTIMATED, FILL_VALUE_REPLACED
  version VARCHAR(20) DEFAULT 'v1.0',
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_cell_date_indicator UNIQUE (cell_id, date, indicator_code)
);

CREATE INDEX IF NOT EXISTS idx_daily_cell_date ON public.nasa_daily_data (cell_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_date_indicator ON public.nasa_daily_data (date, indicator_code);

-- 4. Data Import Manifest Table (Tracks uploaded CSV/Excel files and versions)
CREATE TABLE IF NOT EXISTS public.data_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT,
  storage_path TEXT, -- Reference to Supabase Storage bucket 'nasa-data-files'
  record_count INT DEFAULT 0,
  cell_count INT DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, COMPLETED, FAILED, ROLLED_BACK
  version VARCHAR(30) NOT NULL,
  imported_by TEXT DEFAULT 'admin',
  error_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Synchronization Logs Table (Tracks automated daily NASA POWER API syncs)
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sync_type VARCHAR(30) NOT NULL DEFAULT 'NASA_POWER_API', -- NASA_POWER_API, CSV_UPLOAD, MANUAL_SYNC
  target_cells_count INT DEFAULT 0,
  records_synced INT DEFAULT 0,
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'RUNNING', -- RUNNING, SUCCESS, FAILED, PARTIAL
  latest_nasa_date DATE,
  error_message TEXT,
  details JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_time ON public.sync_logs (start_time DESC);

-- 6. Farms / Fields Table
CREATE TABLE IF NOT EXISTS public.farms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL, -- User identifier
  name TEXT NOT NULL,
  province TEXT NOT NULL,
  district TEXT,
  lat NUMERIC(6, 3) NOT NULL,
  lon NUMERIC(6, 3) NOT NULL,
  area_ha NUMERIC(8, 2) DEFAULT 1.0,
  cell_id VARCHAR(50) REFERENCES public.nasa_grid_cells(cell_id),
  soil_type VARCHAR(30) NOT NULL,
  drainage VARCHAR(20) DEFAULT 'moderate',
  water_source VARCHAR(30),
  crop_name VARCHAR(100) NOT NULL,
  crop_variety VARCHAR(100),
  crop_stage VARCHAR(100),
  planting_date DATE,
  primary_goal VARCHAR(50) DEFAULT 'minimize_risk',
  adaptive_memory JSONB DEFAULT '{}'::jsonb,
  last_analyzed_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Agronomic Recommendations Table (Linked to Farms & Data Versions)
CREATE TABLE IF NOT EXISTS public.recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  risk_level VARCHAR(20) NOT NULL,
  headline TEXT NOT NULL,
  situation TEXT NOT NULL,
  analysis TEXT NOT NULL,
  top_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  postpone_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  explanation TEXT,
  uncertainties TEXT,
  next_check_time TEXT,
  data_version VARCHAR(30) DEFAULT 'v2026.11',
  ai_model VARCHAR(50) DEFAULT 'gemini-3.8-flash',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rec_farm_date ON public.recommendations (farm_id, date);

-- ==============================================================================
-- Row Level Security (RLS) Setup
-- ==============================================================================

ALTER TABLE public.nasa_grid_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nasa_daily_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

-- Public can read grid cells and daily climate data
CREATE POLICY "Public read access for nasa_grid_cells" 
  ON public.nasa_grid_cells FOR SELECT USING (true);

CREATE POLICY "Public read access for nasa_daily_data" 
  ON public.nasa_daily_data FOR SELECT USING (true);

-- Only authenticated admins or service role can modify grid/climate data
CREATE POLICY "Admin write access for nasa_grid_cells" 
  ON public.nasa_grid_cells FOR ALL 
  USING (auth.jwt() ->> 'role' = 'admin' OR auth.role() = 'service_role');

CREATE POLICY "Admin write access for nasa_daily_data" 
  ON public.nasa_daily_data FOR ALL 
  USING (auth.jwt() ->> 'role' = 'admin' OR auth.role() = 'service_role');

CREATE POLICY "Admin access for data_imports" 
  ON public.data_imports FOR ALL 
  USING (auth.jwt() ->> 'role' = 'admin' OR auth.role() = 'service_role');

CREATE POLICY "Admin access for sync_logs" 
  ON public.sync_logs FOR ALL 
  USING (auth.jwt() ->> 'role' = 'admin' OR auth.role() = 'service_role');

-- Users manage their own farms and recommendations
CREATE POLICY "Users can manage their own farms" 
  ON public.farms FOR ALL 
  USING (auth.uid()::text = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can view recommendations for their farms" 
  ON public.recommendations FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.farms 
      WHERE farms.id = recommendations.farm_id 
      AND (farms.user_id = auth.uid()::text OR auth.role() = 'service_role')
    )
  );

-- ==============================================================================
-- Supabase Storage Bucket Setup Script (Run in Supabase Dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('nasa-data-files', 'nasa-data-files', false);
-- ==============================================================================
