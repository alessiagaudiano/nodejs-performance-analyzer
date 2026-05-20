
CREATE EXTENSION IF NOT EXISTS timescaledb;

--Add new timestamp column
ALTER TABLE memory_gc_timeseries
  ADD COLUMN IF NOT EXISTS ts timestamptz;

--Populate ts
UPDATE memory_gc_timeseries
SET ts = to_timestamp(process_start_time::double precision)
WHERE ts IS NULL;

-- Convert to hypertable
SELECT create_hypertable(
  'memory_gc_timeseries',
  'ts',
  chunk_time_interval => INTERVAL '1 hour',
  migrate_data => TRUE
);

-- Create index on app_name and timestamp 
CREATE INDEX IF NOT EXISTS idx_memory_gc_app_name
  ON memory_gc_timeseries (app_name);

CREATE INDEX IF NOT EXISTS idx_memory_gc_ts
  ON memory_gc_timeseries (ts DESC);

-- Verify hypertable 
SELECT * FROM timescaledb_information.hypertables
  WHERE hypertable_name = 'memory_gc_timeseries';

SELECT * FROM show_chunks('memory_gc_timeseries') LIMIT 10;
