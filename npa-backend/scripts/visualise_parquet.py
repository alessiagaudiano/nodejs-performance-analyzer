from pathlib import Path
import pandas as pd

# Parquet source path
PARQUET_PATH = "app/database/memory_gc_timeseries_v1.7.parquet"

def inspect_parquet_sources():
    print(f"Reading file: {PARQUET_PATH} ...")
    
    try:
        df = pd.read_parquet(PARQUET_PATH)
    except Exception as e:
        print(f"Error reading parquet file: {e}")
        return

    # Show 10 GC rows
    print("\n" + "="*50)
    print("SOURCE: GC (Garbage Collection Events)")
    print("="*50)
    gc_rows = df[df['source'] == 'gc'].head(10)
    print(gc_rows.dropna(axis=1, how='all')) 
    
    # Show 10 memory rows
    print("\n" + "="*50)
    print("SOURCE: MEMORY (System/CPU Samples)")
    print("="*50)
    mem_rows = df[df['source'] == 'memory'].head(10)
    print(mem_rows.dropna(axis=1, how='all')) 

    # Print all column names
    print("\n" + "="*50)
    print(f"ALL COLUMNS FOUND ({len(df.columns)} Total)")
    print("="*50)
    
    sorted_cols = sorted(df.columns.tolist())
    for i, col in enumerate(sorted_cols, 1):
        print(f"{i:03}. {col}")

    # Time range analysis and chunk size suggestion
    print("\n" + "="*50)
    print("TIME RANGE & CHUNKING ANALYSIS")
    print("="*50)

    # Convert memory sample times (wall_time)
    mem_times = df[df['source'] == 'memory']['wall_time'].dropna()
    mem_dt = pd.to_datetime(mem_times, unit='s')

    # Convert GC event times (process_start_time + timestamp_ms)
    gc_df = df[df['source'] == 'gc']
    # Filter out rows where timestamps might be missing
    if not gc_df.empty and 'process_start_time' in gc_df.columns and 'timestamp_ms' in gc_df.columns:
        gc_times = gc_df['process_start_time'] + (gc_df['timestamp_ms'] / 1000.0)
        gc_dt = pd.to_datetime(gc_times, unit='s')
    else:
        gc_dt = pd.Series(dtype='datetime64[ns]')

    # Combine both to find the global range
    all_dt = pd.concat([mem_dt, gc_dt])

    if not all_dt.empty:
        min_time = all_dt.min()
        max_time = all_dt.max()
        duration = max_time - min_time
        
        print(f"Earliest Timestamp : {min_time}")
        print(f"Latest Timestamp   : {max_time}")
        print(f"Total Duration     : {duration}")
        print("-" * 30)
        
        # Suggest a TimescaleDB chunk_time_interval
        print("RECOMMENDATION:")
        total_hours = duration.total_seconds() / 3600
        
        if total_hours < 24:
            print(f"Dataset is short ({total_hours:.1f} hours).")
            print(">> Use chunk_time_interval => INTERVAL '1 hour'")
        elif total_hours < (24 * 30):  # less than a month
            print(f"Dataset spans {duration.days} days.")
            print(">> Use chunk_time_interval => INTERVAL '1 day'")
        else:
            print(f"Dataset spans {duration.days} days (Long term).")
            print(">> Use chunk_time_interval => INTERVAL '1 week' or '1 month'")
    else:
        print("No valid time data found to analyze.")

if __name__ == "__main__":
    try:
        inspect_parquet_sources()
    except FileNotFoundError:
        print(f"Error: Could not find file at {PARQUET_PATH}")
    except Exception as e:
        print(f"An error occurred: {e}")
