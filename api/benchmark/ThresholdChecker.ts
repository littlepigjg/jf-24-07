import type {
  PerformanceMetrics,
  ThresholdConfig,
  AlertConfig,
  Alert,
  AlertSeverity,
} from '../../shared/types.js'

export class ThresholdChecker {
  static check(
    metrics: PerformanceMetrics,
    thresholds?: ThresholdConfig,
    alertConfigs?: AlertConfig[],
  ): Alert[] {
    const alerts: Alert[] = []

    if (thresholds) {
      alerts.push(...this.checkThresholds(metrics, thresholds))
    }

    if (alertConfigs) {
      alerts.push(...this.checkCustomAlerts(metrics, alertConfigs))
    }

    return alerts.sort((a, b) => {
      const severityOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
  }

  private static checkThresholds(metrics: PerformanceMetrics, thresholds: ThresholdConfig): Alert[] {
    const alerts: Alert[] = []
    const timestamp = Date.now()

    if (thresholds.maxLatencyP95 !== undefined && metrics.latency.p95 > thresholds.maxLatencyP95) {
      const severity: AlertSeverity = metrics.latency.p95 > thresholds.maxLatencyP95 * 2 ? 'critical' : 'warning'
      alerts.push({
        id: `alert_p95_${timestamp}`,
        name: 'P95延迟超标',
        severity,
        metric: 'latency.p95',
        value: metrics.latency.p95,
        threshold: thresholds.maxLatencyP95,
        operator: 'gt',
        message: `P95延迟 ${metrics.latency.p95.toFixed(1)}ms 超过阈值 ${thresholds.maxLatencyP95}ms`,
        triggeredAt: timestamp,
      })
    }

    if (thresholds.maxLatencyP99 !== undefined && metrics.latency.p99 > thresholds.maxLatencyP99) {
      const severity: AlertSeverity = metrics.latency.p99 > thresholds.maxLatencyP99 * 2 ? 'critical' : 'warning'
      alerts.push({
        id: `alert_p99_${timestamp}`,
        name: 'P99延迟超标',
        severity,
        metric: 'latency.p99',
        value: metrics.latency.p99,
        threshold: thresholds.maxLatencyP99,
        operator: 'gt',
        message: `P99延迟 ${metrics.latency.p99.toFixed(1)}ms 超过阈值 ${thresholds.maxLatencyP99}ms`,
        triggeredAt: timestamp,
      })
    }

    if (thresholds.minThroughput !== undefined && metrics.throughput.requestsPerSecond < thresholds.minThroughput) {
      const severity: AlertSeverity = metrics.throughput.requestsPerSecond < thresholds.minThroughput * 0.5 ? 'critical' : 'warning'
      alerts.push({
        id: `alert_tps_${timestamp}`,
        name: '吞吐量不足',
        severity,
        metric: 'throughput.requestsPerSecond',
        value: metrics.throughput.requestsPerSecond,
        threshold: thresholds.minThroughput,
        operator: 'lt',
        message: `吞吐量 ${metrics.throughput.requestsPerSecond.toFixed(1)} req/s 低于阈值 ${thresholds.minThroughput} req/s`,
        triggeredAt: timestamp,
      })
    }

    if (thresholds.maxErrorRate !== undefined && metrics.errors.errorRate > thresholds.maxErrorRate) {
      const severity: AlertSeverity = metrics.errors.errorRate > thresholds.maxErrorRate * 2 ? 'critical' : 'warning'
      alerts.push({
        id: `alert_err_${timestamp}`,
        name: '错误率超标',
        severity,
        metric: 'errors.errorRate',
        value: metrics.errors.errorRate,
        threshold: thresholds.maxErrorRate,
        operator: 'gt',
        message: `错误率 ${(metrics.errors.errorRate * 100).toFixed(1)}% 超过阈值 ${(thresholds.maxErrorRate * 100).toFixed(1)}%`,
        triggeredAt: timestamp,
      })
    }

    if (thresholds.minConsistencyRate !== undefined && metrics.consistency.consistencyRate < thresholds.minConsistencyRate) {
      const severity: AlertSeverity = metrics.consistency.consistencyRate < thresholds.minConsistencyRate * 0.9 ? 'critical' : 'warning'
      alerts.push({
        id: `alert_cons_${timestamp}`,
        name: '一致性率不达标',
        severity,
        metric: 'consistency.consistencyRate',
        value: metrics.consistency.consistencyRate,
        threshold: thresholds.minConsistencyRate,
        operator: 'lt',
        message: `一致性率 ${(metrics.consistency.consistencyRate * 100).toFixed(1)}% 低于阈值 ${(thresholds.minConsistencyRate * 100).toFixed(1)}%`,
        triggeredAt: timestamp,
      })
    }

    return alerts
  }

  private static checkCustomAlerts(metrics: PerformanceMetrics, alertConfigs: AlertConfig[]): Alert[] {
    const alerts: Alert[] = []
    const timestamp = Date.now()

    for (const config of alertConfigs) {
      const value = this.resolveMetricValue(metrics, config.metric)
      if (value === undefined) continue

      const triggered = this.evaluateCondition(value, config.operator, config.threshold)
      if (triggered) {
        alerts.push({
          id: `alert_${config.id}_${timestamp}`,
          name: config.name,
          severity: config.severity,
          metric: config.metric,
          value,
          threshold: config.threshold,
          operator: config.operator,
          message: config.message || `${config.name}: ${value} ${config.operator} ${config.threshold}`,
          triggeredAt: timestamp,
        })
      }
    }

    return alerts
  }

  private static resolveMetricValue(metrics: PerformanceMetrics, path: string): number | undefined {
    const parts = path.split('.')
    let current: any = metrics
    for (const part of parts) {
      if (current === null || current === undefined) return undefined
      current = current[part]
    }
    return typeof current === 'number' ? current : undefined
  }

  private static evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold
      case 'lt': return value < threshold
      case 'gte': return value >= threshold
      case 'lte': return value <= threshold
      case 'eq': return value === threshold
      case 'neq': return value !== threshold
      default: return false
    }
  }
}
