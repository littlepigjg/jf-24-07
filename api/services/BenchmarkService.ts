import type {
  TestScenario,
  TestRun,
  PerformanceReport,
  CreateScenarioRequest,
  LoadConfig,
} from '../../shared/types.js'
import { BenchmarkRunner } from '../benchmark/BenchmarkRunner.js'

const DEFAULT_SCENARIOS: CreateScenarioRequest[] = [
  {
    name: '单请求延迟基准',
    description: '单并发下测量各端点基础延迟，建立延迟基线',
    loadConfig: { concurrency: 1, duration: 30, pattern: 'constant' },
    requests: [
      { method: 'GET', url: '/api/qrcodes' },
      { method: 'GET', url: '/api/stats/overview' },
      { method: 'GET', url: '/api/health' },
    ],
    thresholds: { maxLatencyP95: 500, maxLatencyP99: 1000 },
    tags: ['latency', 'baseline'],
  },
  {
    name: '并发吞吐量测试',
    description: '阶梯式增加并发，测量系统最大吞吐量',
    loadConfig: { concurrency: 50, duration: 60, pattern: 'staircase', minConcurrency: 5, maxConcurrency: 50, steps: 10 },
    requests: [
      { method: 'GET', url: '/api/qrcodes' },
      { method: 'GET', url: '/api/stats/overview' },
    ],
    thresholds: { minThroughput: 50, maxLatencyP95: 1000, maxErrorRate: 0.05 },
    tags: ['throughput', 'concurrency'],
  },
  {
    name: '数据一致性验证',
    description: '并发读写场景下验证数据一致性',
    loadConfig: { concurrency: 10, duration: 30, pattern: 'constant' },
    requests: [
      { method: 'GET', url: '/api/qrcodes' },
      { method: 'GET', url: '/api/stats/overview' },
    ],
    consistencyCheck: true,
    thresholds: { minConsistencyRate: 0.99 },
    tags: ['consistency'],
  },
  {
    name: '尖峰负载测试',
    description: '模拟流量突增场景，验证系统弹性',
    loadConfig: { concurrency: 100, duration: 60, pattern: 'spike', minConcurrency: 5, maxConcurrency: 100 },
    requests: [
      { method: 'GET', url: '/api/qrcodes' },
      { method: 'GET', url: '/api/stats/overview' },
      { method: 'GET', url: '/api/health' },
    ],
    thresholds: { maxLatencyP95: 3000, maxErrorRate: 0.1 },
    tags: ['spike', 'resilience'],
  },
]

class BenchmarkService {
  private runner: BenchmarkRunner
  private static instance: BenchmarkService

  private constructor() {
    const baseUrl = process.env.BENCHMARK_BASE_URL || 'http://localhost:3001'
    this.runner = new BenchmarkRunner(baseUrl)
    this.initDefaultScenarios()
  }

  static getInstance(): BenchmarkService {
    if (!BenchmarkService.instance) {
      BenchmarkService.instance = new BenchmarkService()
    }
    return BenchmarkService.instance
  }

  private initDefaultScenarios(): void {
    for (const req of DEFAULT_SCENARIOS) {
      const scenario = this.createScenario(req)
      this.runner.registerScenario(scenario)
    }
  }

  createScenario(req: CreateScenarioRequest): TestScenario {
    const scenario: TestScenario = {
      id: 'sc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: req.name,
      description: req.description,
      loadConfig: req.loadConfig,
      requests: req.requests,
      thresholds: req.thresholds,
      alerts: req.alerts,
      consistencyCheck: req.consistencyCheck,
      tags: req.tags,
    }
    return scenario
  }

  listScenarios(): TestScenario[] {
    return this.runner.listScenarios()
  }

  getScenario(id: string): TestScenario | undefined {
    return this.runner.getScenario(id)
  }

  addScenario(req: CreateScenarioRequest): TestScenario {
    const scenario = this.createScenario(req)
    this.runner.registerScenario(scenario)
    return scenario
  }

  removeScenario(id: string): boolean {
    return this.runner.removeScenario(id)
  }

  async runScenario(
    scenarioId: string,
    overrides?: Partial<LoadConfig>,
  ): Promise<TestRun> {
    return this.runner.runScenario(scenarioId, { overrides })
  }

  cancelRun(runId: string): boolean {
    return this.runner.cancelRun(runId)
  }

  listRuns(scenarioId?: string): TestRun[] {
    return this.runner.listRuns(scenarioId)
  }

  getRun(runId: string): TestRun | undefined {
    return this.runner.getRun(runId)
  }

  getReport(runId: string): PerformanceReport | null {
    return this.runner.generateReport(runId)
  }

  getHistory(scenarioId?: string, limit?: number): TestRun[] {
    return this.runner.getHistory(scenarioId, limit)
  }

  compareWithBaseline(runId: string, baselineId: string) {
    return this.runner.compareWithBaseline(runId, baselineId)
  }

  getRunner(): BenchmarkRunner {
    return this.runner
  }
}

export { BenchmarkService }
