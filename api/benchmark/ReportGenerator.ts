import type {
  TestRun,
  PerformanceReport,
  ReportChart,
  RequestSample,
} from '../../shared/types.js'

export class ReportGenerator {
  static generate(run: TestRun): PerformanceReport {
    const metrics = run.metrics!
    const reportId = 'rpt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

    return {
      id: reportId,
      runId: run.id,
      scenarioName: run.scenarioName,
      generatedAt: Date.now(),
      summary: {
        totalRequests: metrics.throughput.totalRequests,
        avgLatency: metrics.latency.avg,
        p95Latency: metrics.latency.p95,
        p99Latency: metrics.latency.p99,
        throughput: metrics.throughput.requestsPerSecond,
        errorRate: metrics.errors.errorRate,
        consistencyRate: metrics.consistency.consistencyRate,
        passed: run.passed ?? true,
      },
      metrics,
      alerts: run.alerts ?? [],
      bottlenecks: run.bottlenecks ?? [],
      charts: this.generateCharts(metrics.samples),
    }
  }

  private static generateCharts(samples: RequestSample[]): ReportChart[] {
    const charts: ReportChart[] = []

    charts.push(this.generateLatencyOverTimeChart(samples))
    charts.push(this.generateLatencyHistogramChart(samples))
    charts.push(this.generateStatusCodeDistributionChart(samples))
    charts.push(this.generateThroughputOverTimeChart(samples))
    charts.push(this.generateLatencyByEndpointChart(samples))
    charts.push(this.generateErrorBreakdownChart(samples))

    return charts
  }

  private static generateLatencyOverTimeChart(samples: RequestSample[]): ReportChart {
    const timeBuckets = this.bucketByTime(samples, 20)
    const data = timeBuckets.map((bucket) => {
      const latencies = bucket.samples.map((s) => s.latency).sort((a, b) => a - b)
      const count = latencies.length
      const p = (pct: number) => latencies[Math.min(Math.ceil((pct / 100) * count) - 1, count - 1)] ?? 0
      return {
        time: bucket.label,
        avg: count > 0 ? latencies.reduce((a, b) => a + b, 0) / count : 0,
        p50: p(50),
        p95: p(95),
        p99: p(99),
      }
    })

    return {
      id: 'chart_latency_time',
      type: 'line',
      title: '延迟趋势',
      data,
      xAxis: 'time',
      yAxis: 'latency (ms)',
    }
  }

  private static generateLatencyHistogramChart(samples: RequestSample[]): ReportChart {
    const latencies = samples.map((s) => s.latency)
    const maxLatency = Math.max(...latencies, 1)
    const bucketCount = 20
    const bucketSize = maxLatency / bucketCount

    const buckets: { range: string; count: number }[] = []
    for (let i = 0; i < bucketCount; i++) {
      const low = Math.round(bucketSize * i)
      const high = Math.round(bucketSize * (i + 1))
      const count = latencies.filter((l) => l >= low && l < high).length
      buckets.push({ range: `${low}-${high}`, count })
    }

    return {
      id: 'chart_latency_hist',
      type: 'histogram',
      title: '延迟分布直方图',
      data: buckets,
      xAxis: 'range',
      yAxis: 'count',
    }
  }

  private static generateStatusCodeDistributionChart(samples: RequestSample[]): ReportChart {
    const statusGroups: Record<string, number> = {}
    for (const sample of samples) {
      const group = `${Math.floor(sample.statusCode / 100)}xx`
      statusGroups[group] = (statusGroups[group] || 0) + 1
    }

    const data = Object.entries(statusGroups).map(([code, count]) => ({
      label: code,
      value: count,
    }))

    return {
      id: 'chart_status_dist',
      type: 'pie',
      title: '状态码分布',
      data,
    }
  }

  private static generateThroughputOverTimeChart(samples: RequestSample[]): ReportChart {
    const timeBuckets = this.bucketByTime(samples, 20)
    const data = timeBuckets.map((bucket) => ({
      time: bucket.label,
      rps: bucket.duration > 0 ? bucket.samples.length / (bucket.duration / 1000) : 0,
      requestCount: bucket.samples.length,
    }))

    return {
      id: 'chart_throughput_time',
      type: 'line',
      title: '吞吐量趋势',
      data,
      xAxis: 'time',
      yAxis: 'req/s',
    }
  }

  private static generateLatencyByEndpointChart(samples: RequestSample[]): ReportChart {
    const endpointGroups: Record<string, number[]> = {}
    for (const sample of samples) {
      const key = `${sample.method} ${sample.url}`
      if (!endpointGroups[key]) endpointGroups[key] = []
      endpointGroups[key].push(sample.latency)
    }

    const data = Object.entries(endpointGroups)
      .map(([endpoint, latencies]) => {
        const sorted = [...latencies].sort((a, b) => a - b)
        const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length
        const p95 = sorted[Math.min(Math.ceil(0.95 * sorted.length) - 1, sorted.length - 1)]
        return { endpoint, avg: Math.round(avg), p95: Math.round(p95), count: sorted.length }
      })
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 10)

    return {
      id: 'chart_latency_endpoint',
      type: 'bar',
      title: '各端点延迟对比',
      data,
      xAxis: 'endpoint',
      yAxis: 'latency (ms)',
    }
  }

  private static generateErrorBreakdownChart(samples: RequestSample[]): ReportChart {
    const errorSamples = samples.filter((s) => !s.success)
    const errorGroups: Record<string, number> = {}
    for (const sample of errorSamples) {
      const key = sample.error || `HTTP ${sample.statusCode}`
      errorGroups[key] = (errorGroups[key] || 0) + 1
    }

    const data = Object.entries(errorGroups)
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      id: 'chart_error_breakdown',
      type: 'bar',
      title: '错误类型分布',
      data,
      xAxis: 'error',
      yAxis: 'count',
    }
  }

  private static bucketByTime(
    samples: RequestSample[],
    bucketCount: number,
  ): { label: string; samples: RequestSample[]; duration: number }[] {
    if (samples.length === 0) return []

    const sorted = [...samples].sort((a, b) => a.timestamp - b.timestamp)
    const startTime = sorted[0].timestamp
    const endTime = sorted[sorted.length - 1].timestamp
    const totalDuration = endTime - startTime || 1
    const bucketDuration = totalDuration / bucketCount

    const buckets: { label: string; samples: RequestSample[]; duration: number }[] = []
    for (let i = 0; i < bucketCount; i++) {
      const low = startTime + bucketDuration * i
      const high = startTime + bucketDuration * (i + 1)
      const bucketSamples = sorted.filter((s) => s.timestamp >= low && s.timestamp < high)
      const elapsed = Math.round((low - startTime) / 1000)
      buckets.push({
        label: `${elapsed}s`,
        samples: bucketSamples,
        duration: bucketDuration,
      })
    }

    return buckets
  }
}
