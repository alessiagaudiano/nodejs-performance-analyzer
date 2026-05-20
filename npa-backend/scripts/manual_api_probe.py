"""
Ad-hoc API probe script.

Calls the apps list, then for each app fetches configs and exercises every
metrics endpoint twice: once with only required params and once with optional
params derived from configs. Responses are printed to stdout.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import requests


BASE_URL = os.environ.get("NPA_BASE_URL", "http://127.0.0.1:8000")
SESSION = requests.Session()


def _pretty(obj: Any) -> str:
    try:
        return json.dumps(obj, indent=2, sort_keys=True)
    except Exception:
        return str(obj)


def _call(path: str, params: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{BASE_URL}{path}"
    response = SESSION.get(url, params=params, timeout=30)
    try:
        body = response.json()
    except Exception:
        body = response.text

    rendered_params = f"?{urlencode(params, doseq=True)}" if params else ""
    print(f"\nGET {path}{rendered_params}")
    print(f"Status: {response.status_code}")
    print(_pretty(body))
    return {"status": response.status_code, "body": body}


def _first_or_none(vals: Optional[List[Any]]) -> Any:
    if not vals:
        return None
    return vals[0]


def _pick_flag(run_status: Dict[str, List[bool]], name: str) -> Optional[bool]:
    vals = run_status.get(name) or []
    if True in vals:
        return True
    if False in vals:
        return False
    return None


def _optional_params(configs: Dict[str, Any]) -> Dict[str, Any]:
    time_range = configs.get("time_range") or {}
    start_ts = time_range.get("start_ts") or None
    end_ts = time_range.get("end_ts") or None
    heap_bin_mb = _first_or_none(configs.get("heap_capacity_mb_bins"))
    run_id = _first_or_none(configs.get("runs"))
    cpu = configs.get("cpu_active") or {}
    cpu_active_min = cpu.get("p50") or cpu.get("p95")
    run_status = configs.get("run_status") or {}

    return {
        "start_ts": start_ts,
        "end_ts": end_ts,
        "heap_bin_mb": heap_bin_mb,
        "run_id": run_id,
        "cpu_active_min": cpu_active_min,
        # New failure flags
        "failed": _pick_flag(run_status, "failed"),
        "crash_detected": _pick_flag(run_status, "crash_detected"),
        "oom_detected": _pick_flag(run_status, "oom_detected"),
        "limit": 5,
    }


def probe_app(app_name: str) -> None:
    cfg = _call("/api/apps/configs", {"app_name": app_name}).get("body") or {}
    optional = _optional_params(cfg)

    endpoints = [
        ("/api/metrics/time-series", {"app_name": app_name}),
        ("/api/metrics/cpu-usage", {"app_name": app_name}),
        ("/api/metrics/memory-usage", {"app_name": app_name}),
        ("/api/metrics/heap-spaces", {"app_name": app_name}),
        ("/api/metrics/gc-pauses", {"app_name": app_name}),
        ("/api/metrics/gc-stats", {"app_name": app_name}),
        ("/api/metrics/correlations", {"app_name": app_name}),
        ("/api/metrics/leak-trend", {"app_name": app_name}),
        ("/api/metrics/anomalies", {"app_name": app_name}),
    ]

    for path, base_params in endpoints:
        _call(path, base_params)
        enriched = {k: v for k, v in {**base_params, **optional}.items() if v is not None}
        _call(path, enriched)


def main() -> None:
    apps_resp = _call("/api/apps/", {})
    apps = apps_resp.get("body") if isinstance(apps_resp.get("body"), list) else []
    if not apps:
        print("No apps returned; nothing to probe.")
        return

    for app_name in apps:
        print(f"\n=== Probing app: {app_name} ===")
        probe_app(app_name)


if __name__ == "__main__":
    main()
