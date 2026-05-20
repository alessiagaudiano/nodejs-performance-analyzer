/* * Dictionary mapping backend keywords to technical tuning advice.
 */
export const INSIGHT_ADVICE = {
  "Analyzed": "Baseline analysis context. If no anomalies are listed, your current filters represent a healthy state or insufficient load for the selected configuration.",
  "High System CPU": "Kernel-mode saturation detected. Consider switching the 'Garbage Collection Type' to Multi-threaded (mc) to reduce management overhead.",
  "Memory Swapping": "The OS is using disk as RAM. Your selected 'Heap Capacity' bin is likely too large for the simulated host memory. Try a smaller bin.",
  "Low System Memory": "System memory near exhaustion. Select a more conservative 'Heap Capacity' filter to prevent potential OOM crashes.",
  "Minor GCs": "High temporary object churn. Compare Serial (s) vs Multi-threaded (mc) performance to find the most efficient algorithm for this workload.",
  "Major GCs": "Stop-the-World latency. Increase the 'Heap Capacity' filter to allow V8 more headroom, reducing the frequency of long pauses.",
  "High Promotion Rate": "Objects are moving to Old Space too quickly. Verify if a different 'GC Type' stabilizes the long-term heap memory.",
  "Old space used": "Potential Memory Leak. Overlay this run with a 'Healthy' configuration in the Compare View to confirm the growth trend."
};