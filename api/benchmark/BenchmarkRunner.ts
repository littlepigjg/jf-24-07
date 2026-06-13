import type {
  TestScenario,
  TestRun,
  PerformanceTestStatus,
  PerformanceMetrics,
  Alert,
  BottleneckAnalysis,
  LoadConfig,
} from '../../shared/types.js'
import { LoadGenerator } from './LoadGenerator.js'
import { MetricsCollector } from './MetricsCollector.js'
import { BottleneckAnalyzer } from './BottleneckAnalyzer.js'
import { ThresholdChecker } from './ThresholdChecker.js'
import { ReportGenerator } from './ReportGenerator.js'

interface RunOptions {
  overrides?: Partial<LoadConfig>
  onProgress?: (metrics: PerformanceMetrics) => void
  onWorkerUpdate?: (active: number, target: number) => void
}

export class BenchmarkRunner {
  private scenarios: Map<string, TestScenario> = new Map()
  private runs: Map<string, TestRun> = new Map()
  private activeGenerators: Map<string, LoadGenerator> = new Map()
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  registerScenario(scenario: TestScenario): void {
    this.scenarios.set(scenario.id, scenario)
  }

  removeScenario(scenarioId: string): boolean {
    return this.scenarios.delete(scenarioId)
  }

  getScenario(scenarioId: string): TestScenario | undefined {
    return this.scenarios.get(scenarioId)
  }

  listScenarios(): TestScenario[] {
    return Array.from(this.scenarios.values())
  }

  getRun(runId: string): TestRun | undefined {
    return this.runs.get(runId)
  }

  listRuns(scenarioId?: string): TestRun[] {
    const all = Array.from(this.runs.values())
    if (scenarioId) {
      return all.filter((r) => r.scenarioId === scenarioId)
    }
    return all
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  }

  async runScenario(scenarioId: string, options: RunOptions = {}): Promise<TestRun> {
    const scenario = this.scenarios.get(scenarioId)
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioId}`)
    }

    const mergedConfig: LoadConfig = {
      ...scenario.loadConfig,
      ...options.overrides,
    }

    const runId = this.generateId()
    const run: TestRun = {
      id: runId,
      scenarioId,
      scenarioName: scenario.name,
      status: 'running',
      startTime: Date.now(),
      config: mergedConfig,
    }
    this.runs.set(runId, run)

    const generator = new LoadGenerator(
      mergedConfig,
      scenario.requests,
      this.baseUrl,
      scenario.consistencyCheck,
    )
    this.activeGenerators.set(runId, generator)

    try {
      const { metrics, inconsistencies } = await generator.run(
        (m) => options.onProgress?.(m as PerformanceMetrics),
        options.onWorkerUpdate,
      )

      const alerts = ThresholdChecker.check(metrics, scenario.thresholds, scenario.alerts)
      const bottlenecks = BottleneckAnalyzer.analyze(metrics, inconsistencies)
      const passed = this.evaluatePass(alerts, bottlenecks)

      run.status = 'completed'
      run.endTime = Date.now()
      run.duration = run.endTime - run.startTime
      run.metrics = metrics
      run.alerts = alerts
      run.bottlenecks = bottlenecks
      run.passed = passed
    } catch (err) {
      run.status = 'failed'
      run.endTime = Date.now()
      run.duration = run.endTime - run.startTime
    } finally {
      this.activeGenerators.delete(runId)
    }

    return run
  }

  cancelRun(runId: string): boolean {
    const generator = this.activeGenerators.get(runId)
    if (generator) {
      generator.stop()
      const run = this.runs.get(runId)
      if (run && run.status === 'running') {
        run.status = 'cancelled'
        run.endTime = Date.now()
        run.duration = run.endTime - run.startTime
      }
      return true
    }
    return false
  }

  generateReport(runId: string): import('../../shared/types.js').PerformanceReport | null {
    const run = this.runs.get(runId)
    if (!run || !run.metrics) return null
    return ReportGenerator.generate(run)
  }

  getHistory(scenarioId?: string, limit = 20): TestRun[] {
    const runs = this.listRuns(scenarioId)
    return runs
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit)
  }

  compareWithBaseline(runId: string, baselineId: string): {
    regression: boolean
    details: { metric: string; current: number; baseline: number; change: number; regression: boolean }[]
  } | null {
    const run = this.runs.get(runId)
    const baseline = this.runs.get(baselineId)
    if (!run?.metrics || !baseline?.metrics) return null

    const comparisons: { metric: string; current: number; baseline: number; change: number; regression: boolean }[] = []

    const compare = (name: string, current: number, base: number, higherIsWorse: boolean) => {
      const change = base > 0 ? ((current - base) / base) * 100 : 0
      const regression = higherIsWorse ? change > 20 : change < -20
      comparisons.push({ metric: name, current, baseline: base, change, regression })
    }

    compare('P95延迟', run.metrics.latency.p95, baseline.metrics.latency.p95, true)
    compare('P99延迟', run.metrics.latency.p99, baseline.metrics.latency.p99, true)
    compare('平均延迟', run.metrics.latency.avg, baseline.metrics.latency.avg, true)
    compare('吞吐量(req/s)', run.metrics.throughput.requestsPerSecond, baseline.metrics.throughput.requestsPerSecond, false)
    compare('错误率', run.metrics.errors.errorRate, baseline.metrics.errors.errorRate, true)
    compare('一致性率', run.metrics.consistency.consistencyRate, baseline.metrics.consistency.consistencyRate, false)

    return {
      regression: comparisons.some((c) => c.regression),
      details: comparisons,
    }
  }

  private evaluatePass(alerts: Alert[], bottlenecks: BottleneckAnalysis[]): boolean {
    const hasCriticalAlert = alerts.some((a) => a.severity === 'critical')
    const hasCriticalBottleneck = bottlenecks.some((b) => b.severity === 'critical' || b.severity === 'high')
    return !hasCriticalAlert && !hasCriticalBottleneck
  }
}
