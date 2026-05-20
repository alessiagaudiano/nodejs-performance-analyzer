from pathlib import Path
import time
import pandas as pd
import pyarrow.parquet as pq
from sqlalchemy import create_engine, inspect, text
from app.config import db_settings
from app.core.constants import (
  EMPTY_COLS_IN_SYSTEM_METRICS,
  EMPTY_COLS_IN_GC_EVENTS
)

BASE_DIR = Path(__file__).resolve().parent
PARQUET_PATH = BASE_DIR / "memory_gc_timeseries_v1.7.parquet"
CHUNK_SIZE = 50_000

TABLE_GC = "gc_events"
TABLE_SYS = "system_metrics"
DB_URL = db_settings.POSTGRES_SYNC_URL

def process_gc_data(df_full):
    """Filter GC rows and drop system-only columns present in the frame."""
    # Keep only GC rows
    df = df_full[df_full['source'] == 'gc'].copy()
    if df.empty:
        return df
    # Drop columns that exist in this frame
    existing_drop_cols = [c for c in EMPTY_COLS_IN_GC_EVENTS if c in df.columns]
    df.drop(columns=existing_drop_cols, inplace=True)

    # Derive absolute event_time
    if 'process_start_time' in df.columns and 'timestamp_ms' in df.columns:
        df['event_time'] = pd.to_datetime(
            df['process_start_time'] + (df['timestamp_ms'] / 1000.0), 
            unit='s'
        )

    # Convert units to MB (from KB/bytes)
    for col in df.columns:
        # Verbose heap (KB -> MB)
        if col.endswith('_kb'):
            new_col = col.replace('_kb', '_mb')
            df[new_col] = df[col] / 1024.0
            df.drop(columns=[col], inplace=True)
        # V8 byte metrics (bytes -> MB)
        elif col in ['total_size_before', 'total_size_after', 'allocated', 'promoted', 
                     'new_space_survived', 'holes_size_before', 'holes_size_after']:
            new_col = f"{col}_mb"
            df[new_col] = df[col] / (1024.0 * 1024.0)
            df.drop(columns=[col], inplace=True)

    return df


def process_system_data(df_full):
    """Filter system rows and drop GC-only columns present in the frame."""
    # Keep only memory rows
    df = df_full[df_full['source'] == 'memory'].copy()
    if df.empty:
        return df
    
    all_drops = list(set(EMPTY_COLS_IN_SYSTEM_METRICS))
    existing_drops = [c for c in all_drops if c in df.columns]
    df.drop(columns=existing_drops, inplace=True)

    # Standardize event_time
    if 'wall_time' in df.columns:
        df['event_time'] = pd.to_datetime(df['wall_time'], unit='s')

    # Convert units to MB (from KiB/bytes)
    for col in df.columns:
        # System memory (KiB -> MB)
        if col.endswith('_kib'):
            new_col = col.replace('_kib', '_mb')
            df[new_col] = df[col] / 1024.0
            df.drop(columns=[col], inplace=True)
        # cgroup bytes (bytes -> MB)
        elif col in ['cgroup_limit_bytes', 'cgroup_usage_bytes', 'cgroup_cache_bytes']:
            new_col = col.replace('_bytes', '_mb')
            df[new_col] = df[col] / (1024.0 * 1024.0)
            df.drop(columns=[col], inplace=True)

    return df


def parquet_to_postgres_chunked(engine=None):
    local_engine = engine or create_engine(DB_URL)
    start_time = time.time()
    
    try:
        print(f"Reading Parquet: {PARQUET_PATH} ...")
        pf = pq.ParquetFile(str(PARQUET_PATH))

        total_gc = 0
        total_sys = 0
        if_exists_strategy = "replace"

        for batch in pf.iter_batches(batch_size=CHUNK_SIZE):
            df_batch = batch.to_pandas()
            
            gc_df = process_gc_data(df_batch)
            sys_df = process_system_data(df_batch)
            
            # Write chunk to DB
            if not gc_df.empty:
                gc_df.to_sql(TABLE_GC, con=local_engine, if_exists=if_exists_strategy, index=False)
                total_gc += len(gc_df)
                
            if not sys_df.empty:
                sys_df.to_sql(TABLE_SYS, con=local_engine, if_exists=if_exists_strategy, index=False)
                total_sys += len(sys_df)

            # Append after the initial batch
            if_exists_strategy = "append"
            print(f"  -> Batch processed. Total: {total_gc:,} GC | {total_sys:,} System")

        print(f"DONE! Processed {total_gc + total_sys:,} rows in {time.time() - start_time:.2f}s.")
        
    finally:
        if engine is None:
            local_engine.dispose()


def ensure_database_seeded():
    engine = create_engine(DB_URL)
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        # Seed if either table is missing
        if TABLE_GC not in tables or TABLE_SYS not in tables:
            print("Tables missing. Starting import...")
            
            # Ensure TimescaleDB extension exists
            with engine.connect() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"))
                conn.commit()

            # Import Parquet data into tables
            parquet_to_postgres_chunked(engine=engine)
            
            # Convert to TimescaleDB hypertables
            print("Converting to TimescaleDB Hypertables...")
            with engine.connect() as conn:
                # GC table hypertable
                conn.execute(text(f"""
                    SELECT create_hypertable(
                        '{TABLE_GC}', 
                        'event_time', 
                        chunk_time_interval => INTERVAL '1 hour', 
                        if_not_exists => TRUE, 
                        migrate_data => TRUE
                    );
                """))
                
                # System table hypertable
                conn.execute(text(f"""
                    SELECT create_hypertable(
                        '{TABLE_SYS}', 
                        'event_time', 
                        chunk_time_interval => INTERVAL '1 hour', 
                        if_not_exists => TRUE, 
                        migrate_data => TRUE
                    );
                """))
                
                # Create indexes
                print("Creating indexes...")
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS idx_gc_search ON {TABLE_GC} (app_name, event_time DESC);"))
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS idx_sys_search ON {TABLE_SYS} (app_name, event_time DESC);"))
                conn.commit()
                
            print("Database setup complete: Tables, Hypertables, and Indexes ready.")
        else:
            print("Tables already exist.")
            
    finally:
        engine.dispose()

if __name__ == "__main__":
    ensure_database_seeded()
