import type {
  RequestSample,
  LatencyMetrics,
  ThroughputMetrics,
  ErrorMetrics,
  ConsistencyMetrics,
  PerformanceMetrics,
} from '../../shared/types.js'

export class MetricsCollector {
  private samples: RequestSample[] = []
  private startTime = Date.now()
  private totalBytes = 0

  addSample(sample: RequestSample): void {
    this.samples.push(sample)
    if (sample.bytes) {
      this.totalBytes += sample.bytes
    }
  }

  addInconsistency(requestId: string, expected: any, actual: any): void {
    const sample = this.samples.find((s) => s.id === requestId)
    if (sample) {
      sample.success = false
      sample.error = 'Data inconsistency detected'
    }
  }

  calculateLatencyMetrics(latencies: number[]): LatencyMetrics {
    if (latencies.length === 0) {
      return {
        min: 0,
        max: 0,
        avg: 0,
        median: 0,
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        p999: 0,
        stdDev: 0,
      }
    }

    const sorted = [...latencies].sort((a, b) => a - b)
    const count = sorted.length
    const sum = sorted.reduce((a, b) => a + b, 0)
    const avg = sum / count
    const variance = sorted.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / count
    const stdDev = Math.sqrt(variance)

    const percentile = (p: number): number => {
      const index = Math.ceil((p / 100) * count) - 1
      return sorted[Math.min(index, count - 1)]
    }

    return {
      min: sorted[0],
      max: sorted[count - 1],
      avg,
      median: percentile(50),
      p50: percentile(50),
      p75: percentile(75),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
      p999: percentile(99.9),
      stdDev,
    }
  }

  calculateThroughputMetrics(): ThroughputMetrics {
    const duration = (Date.now() - this.startTime) / 1000
    const totalRequests = this.samples.length

    return {
      totalRequests,
      requestsPerSecond: duration > 0 ? totalRequests / duration : 0,
      bytesTransferred: this.totalBytes,
      bytesPerSecond: duration > 0 ? this.totalBytes / duration : 0,
    }
  }

  calculateErrorMetrics(): ErrorMetrics {
    const totalRequests = this.samples.length
    const errors = this.samples.filter((s) => !s.success)
    const errorBreakdown: Record<string, number> = {}
    const statusCodeBreakdown: Record<number, number> = {}

    for (const sample of errors) {
      const errorType = sample.error || 'Unknown error'
      errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1
      statusCodeBreakdown[sample.statusCode] = (statusCodeBreakdown[sample.statusCode] || 0) + 1
    }

    return {
      totalErrors: errors.length,
      errorRate: totalRequests > 0 ? errors.length / totalRequests : 0,
      errorBreakdown,
      statusCodeBreakdown,
    }
  }

  calculateConsistencyMetrics(
    inconsistencies: { requestId: string; expected: any; actual: any }[],
  ): ConsistencyMetrics {
    const totalChecks = this.samples.filter((s) => s.method !== undefined).length
    const inconsistentCount = inconsistencies.length

    return {
      totalChecks,
      inconsistentResults: inconsistentCount,
      consistencyRate: totalChecks > 0 ? (totalChecks - inconsistentCount) / totalChecks : 1,
      inconsistencies,
    }
  }

  getMetrics(
    inconsistencies: { requestId: string; expected: any; actual: any }[] = [],
  ): PerformanceMetrics {
    const latencies = this.samples.map((s) => s.latency)

    return {
      latency: this.calculateLatencyMetrics(latencies),
      throughput: this.calculateThroughputMetrics(),
      errors: this.calculateErrorMetrics(),
      consistency: this.calculateConsistencyMetrics(inconsistencies),
      samples: [...this.samples],
      timestamp: Date.now(),
    }
  }

  getSamples(): RequestSample[] {
    return [...this.samples]
  }

  reset(): void {
    this.samples = []
    this.startTime = Date.now()
    this.totalBytes = 0
  }

  getStartTime(): number {
    return this.startTime
  }

  getSampleCount(): number {
    return this.samples.length
  }
}
