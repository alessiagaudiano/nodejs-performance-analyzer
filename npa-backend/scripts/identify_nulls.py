from pathlib import Path
import pandas as pd
import pyarrow.parquet as pq

PARQUET_PATH = "app/database/memory_gc_timeseries_v1.7.parquet"

def get_null_columns_by_source():
    print(f"Scanning file: {PARQUET_PATH} ...")

    if not Path(PARQUET_PATH).exists():
        print(f"Error: File not found at {PARQUET_PATH}")
        return

    parquet_file = pq.ParquetFile(PARQUET_PATH)

    all_columns = set(parquet_file.schema.names)
    gc_null_cols = all_columns.copy()
    mem_null_cols = all_columns.copy()

    print(f"Total columns to check: {len(all_columns)}")
    print("Processing batches...")

    for batch in parquet_file.iter_batches(batch_size=50000):
        df = batch.to_pandas()

        gc_df = df[df["source"] == "gc"]
        if not gc_df.empty:
            non_null = gc_df.count()
            gc_null_cols -= set(non_null[non_null > 0].index)

        mem_df = df[df["source"] == "memory"]
        if not mem_df.empty:
            non_null = mem_df.count()
            mem_null_cols -= set(non_null[non_null > 0].index)

        if not gc_null_cols and not mem_null_cols:
            break

    common_cols = sorted(all_columns - gc_null_cols - mem_null_cols)

    print("\n" + "=" * 60)
    print(f"COLUMNS THAT ARE ALWAYS NULL IN SOURCE='gc' ({len(gc_null_cols)})")
    print("=" * 60)
    for col in sorted(gc_null_cols):
        print(f"'{col}',")

    print("\n" + "=" * 60)
    print(f"COLUMNS THAT ARE ALWAYS NULL IN SOURCE='memory' ({len(mem_null_cols)})")
    print("=" * 60)
    for col in sorted(mem_null_cols):
        print(f"'{col}',")

    print("\n" + "=" * 60)
    print(f"COLUMNS WITH DATA IN BOTH SOURCES ({len(common_cols)})")
    print("=" * 60)
    for col in common_cols:
        print(f"'{col}',")

    full_df = pq.read_table(PARQUET_PATH).to_pandas()

    print("\n" + "=" * 60)
    print("GC rows – values for gc-null columns (should all be null)")
    print("=" * 60)
    print(full_df[full_df["source"] == "gc"][sorted(gc_null_cols)])

    print("\n" + "=" * 60)
    print("Memory rows – values for memory-null columns (should all be null)")
    print("=" * 60)
    print(full_df[full_df["source"] == "memory"][sorted(mem_null_cols)])

    print("\n" + "=" * 60)
    print("GC rows – values for common columns")
    print("=" * 60)
    print(full_df[full_df["source"] == "gc"][common_cols])

    print("\n" + "=" * 60)
    print("Memory rows – values for common columns")
    print("=" * 60)
    print(full_df[full_df["source"] == "memory"][common_cols])

if __name__ == "__main__":
    get_null_columns_by_source()
