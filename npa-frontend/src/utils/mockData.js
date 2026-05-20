export const generateMockData = () => {
  // FR-02: Lista applicazioni disponibili
  const applications = [
    { id: "app-1", name: "E-Commerce API", type: "REST API", version: "2.3.1" },
    {
      id: "app-2",
      name: "Real-Time Chat Service",
      type: "WebSocket",
      version: "1.8.0",
    },
    {
      id: "app-3",
      name: "Data Processing Pipeline",
      type: "Worker",
      version: "3.1.5",
    },
    { id: "app-4", name: "GraphQL Gateway", type: "GraphQL", version: "2.0.3" },
  ];

  // FR-04: Parametri di esecuzione per ogni applicazione
  const executionParameters = {
    "app-1": [
      {
        id: "heap-512",
        name: "Heap Size",
        value: "512MB",
        config: { heapSize: 512 },
      },
      {
        id: "heap-1024",
        name: "Heap Size",
        value: "1024MB",
        config: { heapSize: 1024 },
      },
      {
        id: "heap-2048",
        name: "Heap Size",
        value: "2048MB",
        config: { heapSize: 2048 },
      },
      {
        id: "threads-4",
        name: "Thread Pool",
        value: "4 threads",
        config: { threadPool: 4 },
      },
      {
        id: "threads-8",
        name: "Thread Pool",
        value: "8 threads",
        config: { threadPool: 8 },
      },
    ],
    "app-2": [
      {
        id: "heap-1024",
        name: "Heap Size",
        value: "1024MB",
        config: { heapSize: 1024 },
      },
      {
        id: "heap-2048",
        name: "Heap Size",
        value: "2048MB",
        config: { heapSize: 2048 },
      },
      {
        id: "gc-default",
        name: "GC Strategy",
        value: "Default",
        config: { gc: "default" },
      },
      {
        id: "gc-aggressive",
        name: "GC Strategy",
        value: "Aggressive",
        config: { gc: "aggressive" },
      },
    ],
  };

  // Generazione timeseries
  const generateTimeseries = (
    configId,
    duration = 300,
    hasMemoryLeak = false
  ) => {
    const data = [];
    const startTime = Date.now() - duration * 1000;

    for (let i = 0; i < duration; i++) {
      const timestamp = startTime + i * 1000;

      const cpuBase = 30 + Math.sin(i / 20) * 15;
      const cpuSpike = i % 50 === 0 ? Math.random() * 30 : 0;
      const cpuUsage = Math.min(95, cpuBase + cpuSpike + Math.random() * 10);

      const memoryBase = hasMemoryLeak
        ? 400 + i * 0.5
        : 400 + Math.sin(i / 30) * 100;
      const heapUsed = memoryBase + Math.random() * 50;
      const heapTotal = heapUsed * 1.3;
      const rss = heapTotal * 1.2;

      const newSpace = heapUsed * 0.15;
      const oldSpace = heapUsed * 0.7;
      const codeSpace = heapUsed * 0.08;
      const mapSpace = heapUsed * 0.05;
      const largeObjectSpace = heapUsed * 0.02;

      const isGCEvent = Math.random() < 0.04;
      const gcType = isGCEvent
        ? Math.random() < 0.7
          ? "scavenge"
          : "mark-sweep"
        : null;
      const gcPauseTime = isGCEvent
        ? gcType === "scavenge"
          ? 2 + Math.random() * 5
          : 15 + Math.random() * 30
        : null;

      data.push({
        timestamp,
        time: new Date(timestamp).toLocaleTimeString(),
        cpuUsage: parseFloat(cpuUsage.toFixed(2)),
        heapUsed: parseFloat(heapUsed.toFixed(2)),
        heapTotal: parseFloat(heapTotal.toFixed(2)),
        rss: parseFloat(rss.toFixed(2)),
        newSpace: parseFloat(newSpace.toFixed(2)),
        oldSpace: parseFloat(oldSpace.toFixed(2)),
        codeSpace: parseFloat(codeSpace.toFixed(2)),
        mapSpace: parseFloat(mapSpace.toFixed(2)),
        largeObjectSpace: parseFloat(largeObjectSpace.toFixed(2)),
        gcEvent: isGCEvent,
        gcType,
        gcPauseTime,
      });
    }

    return data;
  };

  const calculateGCStats = (timeseries) => {
    const gcEvents = timeseries.filter((d) => d.gcEvent);
    const scavenges = gcEvents.filter((e) => e.gcType === "scavenge");
    const markSweeps = gcEvents.filter((e) => e.gcType === "mark-sweep");

    return {
      totalCollections: gcEvents.length,
      scavengeCount: scavenges.length,
      markSweepCount: markSweeps.length,
      avgPauseTime:
        gcEvents.reduce((sum, e) => sum + e.gcPauseTime, 0) / gcEvents.length,
      maxPauseTime: Math.max(...gcEvents.map((e) => e.gcPauseTime)),
      totalPauseTime: gcEvents.reduce((sum, e) => sum + e.gcPauseTime, 0),
      gcFrequency: gcEvents.length / (timeseries.length / 60),
    };
  };

  const configurations = {};
  // Build configurations from executionParameters for all apps
  applications.forEach((app) => {
    const params = executionParameters[app.id] || [];
    params.forEach((param) => {
      const key = `${app.id}-${param.id}`;
      if (!configurations[key]) {
        const hasLeak = /1024|2048|aggressive/i.test(param.id) ? true : false;
        configurations[key] = {
          data: generateTimeseries(param.id, 300, hasLeak),
          config: { appId: app.id, paramId: param.id, ...param.config },
        };
      }
    });
  });

  const generateAnalysis = (configKey, timeseries) => {
    const gcStats = calculateGCStats(timeseries);
    const avgCpu =
      timeseries.reduce((sum, d) => sum + d.cpuUsage, 0) / timeseries.length;
    const heapTrend =
      (timeseries[timeseries.length - 1].heapUsed - timeseries[0].heapUsed) /
      timeseries.length;

    const issues = [];
    const recommendations = [];

    if (avgCpu > 70) {
      issues.push({
        type: "high-cpu",
        severity: "warning",
        metric: "CPU Usage",
        value: `${avgCpu.toFixed(1)}%`,
        description: "CPU usage consistently above 70%",
      });
      recommendations.push({
        id: "rec-cpu-1",
        title: "Optimize CPU-intensive operations",
        description:
          "High CPU usage detected. Consider implementing caching, optimizing algorithms, or scaling horizontally.",
        impact: "high",
        effort: "medium",
      });
    }

    if (heapTrend > 0.1) {
      issues.push({
        type: "memory-leak",
        severity: "critical",
        metric: "Heap Memory",
        value: `+${heapTrend.toFixed(2)} MB/s`,
        description: "Continuous memory growth detected - possible memory leak",
      });
      recommendations.push({
        id: "rec-mem-1",
        title: "Investigate memory leak",
        description:
          "Memory is continuously growing over time. Use heap snapshots to identify objects that are not being garbage collected.",
        impact: "critical",
        effort: "high",
      });
    }

    if (gcStats.avgPauseTime > 50) {
      issues.push({
        type: "gc-pause",
        severity: "warning",
        metric: "GC Pause Time",
        value: `${gcStats.avgPauseTime.toFixed(1)} ms`,
        description: "Long garbage collection pauses affecting performance",
      });
      recommendations.push({
        id: "rec-gc-1",
        title: "Increase heap size",
        description:
          "Average GC pause time is high. Consider increasing the heap size.",
        impact: "medium",
        effort: "low",
      });
    }

    return { issues, recommendations, gcStats };
  };

  Object.keys(configurations).forEach((key) => {
    configurations[key].analysis = generateAnalysis(
      key,
      configurations[key].data
    );
  });

  return {
    applications,
    executionParameters,
    configurations,
  };
};
