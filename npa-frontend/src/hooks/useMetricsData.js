import { useEffect, useState, useRef } from "react";
import { apiFetch } from "../api/apiClient";

const useMetricsData = ({
  endpoint,
  appId,
  paramsBuilder,
  filters,
  enabled = true,
}) => {
  // Initialize with paginated structure instead of empty array
  const [data, setData] = useState({ items: [], page: 1, per_page: 100, has_next: false });
  const [loading, setLoading] = useState(false);
  
  // Use ref to track the latest fetch to avoid race conditions
  const fetchIdRef = useRef(0);

  useEffect(() => {
    if (!enabled || !appId) return;

    const currentFetchId = ++fetchIdRef.current;
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        const qs = paramsBuilder(filters);
        console.log(`Fetching ${endpoint}?${qs}`); // Debug log
        
        const res = await apiFetch(`${endpoint}?${qs}`);
        
        console.log(`Response from ${endpoint}:`, res); // Debug log

        // Only update if this is still the latest fetch
        if (!cancelled && currentFetchId === fetchIdRef.current) {
          // Handle both paginated responses and legacy array responses
          if (res && typeof res === 'object' && 'items' in res) {
            // Paginated response
            console.log(`Received ${res.items.length} items from ${endpoint}`); // Debug log
            setData(res);
          } else if (Array.isArray(res)) {
            // Legacy array response - wrap it in pagination structure
            console.log(`Received ${res.length} items (legacy format) from ${endpoint}`); // Debug log
            setData({
              items: res,
              page: 1,
              per_page: res.length,
              has_next: false
            });
          } else {
            // Invalid response
            console.warn(`Unexpected response format from ${endpoint}:`, res);
            setData({ items: [], page: 1, per_page: 100, has_next: false });
          }
        }
      } catch (e) {
        console.error(`Error fetching ${endpoint}`, e);
        if (!cancelled && currentFetchId === fetchIdRef.current) {
          setData({ items: [], page: 1, per_page: 100, has_next: false });
        }
      } finally {
        if (!cancelled && currentFetchId === fetchIdRef.current) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [endpoint, appId, JSON.stringify(filters), paramsBuilder, enabled]);

  return { data, loading };
};

export default useMetricsData;