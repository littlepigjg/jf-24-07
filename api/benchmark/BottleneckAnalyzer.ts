import type {
  PerformanceMetrics,
  BottleneckAnalysis,
  LatencyMetrics,
} from '../../shared/types.js'

export class BottleneckAnalyzer {
  static analyze(
    metrics: PerformanceMetrics,
    inconsistencies: { requestId: string; expected: any; actual: any }[] = [],
  ): BottleneckAnalysis[] {
    const bottlenecks: BottleneckAnalysis[] = []

    bottlenecks.push(...this.analyzeLatency(metrics.latency))
    bottlenecks.push(...this.analyzeThroughput(metrics.throughput.requestsPerSecond))
    bottlenecks.push(...this.analyzeErrors(metrics.errors.errorRate, metrics.errors.errorBreakdown))
    bottlenecks.push(...this.analyzeConsistency(metrics.consistency.consistencyRate, inconsistencies))
    bottlenecks.push(...this.analyzeLatencyDistribution(metrics.latency))

    return bottlenecks.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
  }

  private static analyzeLatency(latency: LatencyMetrics): BottleneckAnalysis[] {
    const bottlenecks: BottleneckAnalysis[] = []

    if (latency.p95 > 2000) {
      bottlenecks.push({
        id: this.makeId(),
        type: 'latency',
        severity: latency.p95 > 5000 ? 'critical' : 'high',
        description: `P95延迟 ${latency.p95.toFixed(1)}ms 严重超标 (>2000ms)`,
        affectedMetric: 'latency.p95',
        value: latency.p95,
        threshold: 2000,
        recommendation: latency.p95 > 5000
          ? '检查数据库查询性能、网络延迟和服务端CPU使用率，考虑增加缓存或优化慢查询'
          : '优化关键路径处理逻辑，增加异步处理，检查是否存在锁竞争或资源等待',
      })
    } else if (latency.p95 > 1000) {
      bottlenecks.push({
        id: this.makeId(),
        type: 'latency',
        severity: 'medium',
        description: `P95延迟 ${latency.p95.toFixed(1)}ms 偏高 (>1000ms)`,
        affectedMetric: 'latency.p95',
        value: latency.p95,
        threshold: 1000,
        recommendation: '检查热点代码路径，考虑增加缓存层或优化I/O操作',
      })
    }

    if (latency.p99 > 5000) {
      bottlenecks.push({
        id: this.makeId(),
        type: 'latency',
        severity: latency.p99 > 10000 ? 'critical' : 'high',
        description: `P99延迟 ${latency.p99.toFixed(1)}ms 严重超标 (>5000ms)，尾延迟过长`,
        affectedMetric: 'latency.p99',
        value: latency.p99,
        threshold: 5000,
        recommendation: '排查GC停顿、磁盘I/O尖刺、连接池耗尽等间歇性问题，考虑请求超时和降级策略',
      })
    }

    if (latency.avg > 0 && latency.stdDev / latency.avg > 1.0) {
      bottlenecks.push({
        id: this.makeId(),
        type: 'latency',
        severity: 'medium',
        description: `延迟标准差 ${latency.stdDev.toFixed(1)}ms，波动系数 ${(latency.stdDev / latency.avg * 100).toFixed(1)}%，响应时间极不稳定`,
        affectedMetric: 'latency.stdDev',
        value: latency.stdDev,
        recommendation: '高延迟波动通常由资源竞争、GC或请求排队导致，建议检查连接池配置和内存使用',
      })
    }

    return bottlenecks
  }

  private static analyzeLatencyDistribution(latency: LatencyMetrics): BottleneckAnalysis[] {
    const bottlenecks: BottleneckAnalysis[] = []

    const p50p99Ratio = latency.p50 > 0 ? latency.p99 / latency.p50 : 0
    if (p50p99Ratio > 10) {
      bottlenecks.push({
        id: this.makeId(),
        type: 'latency',
        severity: 'high',
        description: `P99/P50比值 ${p50p99Ratio.toFixed(1)}x，长尾延迟严重`,
        affectedMetric: 'latency.p99/p50',
        value: p50p99Ratio,
        recommendation: '长尾延迟问题通常由偶发慢请求导致，建议实现请求超时、断路器和降级策略',
      })
    }

    if (latency.max > latency.p99 * 3 && latency.max > 10000) {
      bottlenecks.push({
        id: this.makeId(),
        type: 'latency',
        severity: 'medium',
        description: `最大延迟 ${latency.max.toFixed(1)}ms 远超P99 ${latency.p99.toFixed(1)}ms，存在极端慢请求`,
        affectedMetric: 'latency.max',
        value: latency.max,
        recommendation: '检查是否有超时未设置的下游调用或大请求导致的特殊慢请求',
      })
    }

    return bottlenecks
  }

  private static analyzeThroughput(rps: number): BottleneckAnalysis[] {
    const bottlenecks: BottleneckAnalysis[] = []

    if (rps > 0 && rps < 10) {
      bottlenecks.push({
        id: this.makeId(),
        type: 'throughput',
        severity: rps < 5 ? 'critical' : 'high',
        description: `吞吐量仅 ${rps.toFixed(1)} req/s，系统处理能力不足`,
        affectedMetric: 'throughput.requestsPerSecond',
        value: rps,
        threshold: 10,
        recommendation: '检查是否存在CPU瓶颈、数据库连接池耗尽、或同步阻塞操作，考虑增加并发处理能力',
      })
    } else if (rps >= 10 && rps < 50) {
      bottlenecks.push({
        id: this.makeId(),
        type: 'throughput',
        severity: 'low',
        description: `吞吐量 ${rps.toFixed(1)} req/s，有优化空间`,
        affectedMetric: 'throughput.requestsPerSecond',
        value: rps,
        threshold: 50,
        recommendation: '考虑异步处理、批量操作、连接复用等优化手段',
      })
    }

    return bottlenecks
  }

  private static analyzeErrors(
    errorRate: number,
    errorBreakdown: Record<string, number>,
  ): BottleneckAnalysis[] {
    const bottlenecks: BottleneckAnalysis[] = []

    if (errorRate > 0.1) {
      bottlenecks.push({
        id: this.makeId(),
        type: 'error',
        severity: errorRate > 0.3 ? 'critical' : 'high',
        description: `错误率 ${(errorRate * 100).toFixed(1)}% 严重超标 (>10%)`,
        affectedMetric: 'errors.errorRate',
        value: errorRate,
        threshold: 0.1,
        recommendation: this.getErrorRecommendation(errorBreakdown),
      })
    } else if (errorRate > 0.05) {
      bottlenecks.push({
        id: this.makeId(),
        type: 'error',
        severity: 'medium',
        description: `错误率 ${(errorRate * 100).toFixed(1)}% 偏高 (>5%)`,
        affectedMetric: 'errors.errorRate',
        value: errorRate,
        threshold: 0.05,
        recommendation: this.getErrorRecommendation(errorBreakdown),
      })
    }

    const timeoutErrors = Object.entries(errorBreakdown).find(
      ([key]) => key.toLowerCase().includes('timeout') || key.toLowerCase().includes('abort'),
    )
    if (timeoutErrors && timeoutErrors[1] > 3) {
      bottlenecks.push({
        id: this.makeId(),
        type: 'error',
        severity: 'high',
        description: `超时错误 ${timeoutErrors[1]} 次，服务端响应可能跟不上请求速率`,
        affectedMetric: 'errors.timeout',
        value: timeoutErrors[1],
        recommendation: '增加请求超时时间、降低并发度或优化服务端处理速度',
      })
    }

    return bottlenecks
  }

  private static analyzeConsistency(
    consistencyRate: number,
    inconsistencies: { requestId: string; expected: any; actual: any }[],
  ): BottleneckAnalysis[] {
    const bottlenecks: BottleneckAnalysis[] = []

    if (consistencyRate < 0.95) {
      bottlenecks.push({
        id: this.makeId(),
        type: 'consistency',
        severity: consistencyRate < 0.9 ? 'critical' : 'high',
        description: `数据一致性率 ${(consistencyRate * 100).toFixed(1)}% 低于阈值 (<95%)`,
        affectedMetric: 'consistency.consistencyRate',
        value: consistencyRate,
        threshold: 0.95,
        recommendation: '检查是否存在竞态条件、缓存不一致、或读写冲突，考虑引入分布式锁或事务保障',
      })
    } else if (consistencyRate < 0.99) {
      bottlenecks.push({
        id: this.makeId(),
        type: 'consistency',
        severity: 'low',
        description: `数据一致性率 ${(consistencyRate * 100).toFixed(1)}% 轻微下降 (<99%)`,
        affectedMetric: 'consistency.consistencyRate',
        value: consistencyRate,
        threshold: 0.99,
        recommendation: '并发场景下少量不一致属正常，关注是否持续恶化',
      })
    }

    if (inconsistencies.length > 0 && inconsistencies.length <= 5) {
      const details = inconsistencies
        .map((i) => `期望: ${JSON.stringify(i.expected)}, 实际: ${JSON.stringify(i.actual)}`)
        .join('; ')
      bottlenecks.push({
        id: this.makeId(),
        type: 'consistency',
        severity: 'low',
        description: `发现 ${inconsistencies.length} 处数据不一致: ${details}`,
        affectedMetric: 'consistency.inconsistencies',
        value: inconsistencies.length,
        recommendation: '检查具体不一致的数据项和时序，判断是否为并发写入导致',
      })
    }

    return bottlenecks
  }

  private static getErrorRecommendation(errorBreakdown: Record<string, number>): string {
    const topError = Object.entries(errorBreakdown).sort((a, b) => b[1] - a[1])[0]
    if (!topError) return '分析错误日志定位根因'

    const errorType = topError[0].toLowerCase()
    if (errorType.includes('timeout') || errorType.includes('abort')) {
      return '超时错误占比最高，建议增加超时时间、降低并发度或优化服务端响应速度'
    }
    if (errorType.includes('429') || errorType.includes('rate')) {
      return '限流错误占比最高，系统过载，建议降低并发或增加限流阈值'
    }
    if (errorType.includes('500') || errorType.includes('internal')) {
      return '服务端内部错误占比最高，检查服务端日志和异常堆栈'
    }
    if (errorType.includes('connect') || errorType.includes('econnrefused')) {
      return '连接被拒绝，可能服务端连接数达到上限，检查连接池和最大连接数配置'
    }
    return `最高频错误: "${topError[0]}" (${topError[1]}次)，建议分析该错误类型的根因`
  }

  private static makeId(): string {
    return 'bn_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  }
}
