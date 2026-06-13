import { BenchmarkRunner } from '../benchmark/BenchmarkRunner.js'
import type { TestScenario, TestRun, CreateScenarioRequest } from '../../shared/types.js'

function parseArgs(): { scenario?: string; baseUrl: string; failOnRegression: boolean; tags: string[]; listOnly: boolean } {
  const args = process.argv.slice(2)
  let scenario: string | undefined
  let baseUrl = process.env.BENCHMARK_BASE_URL || 'http://localhost:3001'
  let failOnRegression = true
  const tags: string[] = []
  let listOnly = false

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--scenario':
      case '-s':
        scenario = args[++i]
        break
      case '--base-url':
      case '-u':
        baseUrl = args[++i]
        break
      case '--no-fail':
        failOnRegression = false
        break
      case '--tag':
      case '-t':
        tags.push(args[++i])
        break
      case '--list':
      case '-l':
        listOnly = true
        break
      case '--help':
      case '-h':
        console.log(`
QR Code Benchmark CI Runner

Usage: tsx api/benchmark/ci-runner.ts [options]

Options:
  -s, --scenario <id>     Run specific scenario by ID
  -u, --base-url <url>    Target base URL (default: http://localhost:3001)
  -t, --tag <tag>         Filter scenarios by tag (can be repeated)
  --no-fail               Don't exit with error code on regression
  -l, --list              List available scenarios and exit
  -h, --help              Show this help message

Environment Variables:
  BENCHMARK_BASE_URL      Target base URL (overridden by -u)

Examples:
  tsx api/benchmark/ci-runner.ts
  tsx api/benchmark/ci-runner.ts -s sc_abc123
  tsx api/benchmark/ci-runner.ts -t throughput -t concurrency
  tsx api/benchmark/ci-runner.ts -u http://staging.example.com
`)
        process.exit(0)
    }
  }

  return { scenario, baseUrl, failOnRegression, tags, listOnly }
}

function printRunResult(run: TestRun): void {
  const status = run.passed ? '✅ PASSED' : '❌ FAILED'
  const duration = run.duration ? (run.duration / 1000).toFixed(1) : '?'

  console.log('\n' + '='.repeat(70))
  console.log(`  ${run.scenarioName} - ${status}`)
  console.log('='.repeat(70))
  console.log(`  Duration: ${duration}s | Status: ${run.status}`)

  if (run.metrics) {
    const m = run.metrics
    console.log('\n  📊 Metrics:')
    console.log(`    Total Requests:  ${m.throughput.totalRequests}`)
    console.log(`    Throughput:      ${m.throughput.requestsPerSecond.toFixed(1)} req/s`)
    console.log(`    Avg Latency:     ${m.latency.avg.toFixed(1)} ms`)
    console.log(`    P50 Latency:     ${m.latency.p50.toFixed(1)} ms`)
    console.log(`    P95 Latency:     ${m.latency.p95.toFixed(1)} ms`)
    console.log(`    P99 Latency:     ${m.latency.p99.toFixed(1)} ms`)
    console.log(`    Error Rate:      ${(m.errors.errorRate * 100).toFixed(2)}%`)
    console.log(`    Consistency:     ${(m.consistency.consistencyRate * 100).toFixed(2)}%`)
  }

  if (run.alerts && run.alerts.length > 0) {
    console.log('\n  🚨 Alerts:')
    for (const alert of run.alerts) {
      const icon = alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵'
      console.log(`    ${icon} ${alert.name}: ${alert.message}`)
    }
  }

  if (run.bottlenecks && run.bottlenecks.length > 0) {
    console.log('\n  🔍 Bottlenecks:')
    for (const bn of run.bottlenecks) {
      const icon = bn.severity === 'critical' ? '🔴' : bn.severity === 'high' ? '🟠' : bn.severity === 'medium' ? '🟡' : '🔵'
      console.log(`    ${icon} [${bn.type}] ${bn.description}`)
      console.log(`       💡 ${bn.recommendation}`)
    }
  }

  console.log('')
}

function printSummary(runs: TestRun[]): void {
  const passed = runs.filter((r) => r.passed).length
  const failed = runs.filter((r) => !r.passed).length

  console.log('\n' + '='.repeat(70))
  console.log('  SUMMARY')
  console.log('='.repeat(70))
  console.log(`  Total: ${runs.length} | Passed: ${passed} | Failed: ${failed}`)

  if (failed > 0) {
    console.log('\n  Failed scenarios:')
    for (const run of runs.filter((r) => !r.passed)) {
      console.log(`    ❌ ${run.scenarioName} (${run.id})`)
    }
  }

  console.log('')
}

async function main(): Promise<void> {
  const { scenario, baseUrl, failOnRegression, tags, listOnly } = parseArgs()

  console.log('🚀 QR Code Performance Benchmark CI Runner')
  console.log(`   Target: ${baseUrl}`)
  console.log('')

  const runner = new BenchmarkRunner(baseUrl)

  const allScenarios: CreateScenarioRequest[] = [
    {
      name: '单请求延迟基准',
      description: '单并发下测量各端点基础延迟，建立延迟基线',
      loadConfig: { concurrency: 1, duration: 15, pattern: 'constant' },
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
      loadConfig: { concurrency: 50, duration: 30, pattern: 'staircase', minConcurrency: 5, maxConcurrency: 50, steps: 5 },
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
      loadConfig: { concurrency: 10, duration: 15, pattern: 'constant' },
      requests: [
        { method: 'GET', url: '/api/qrcodes' },
        { method: 'GET', url: '/api/stats/overview' },
      ],
      consistencyCheck: true,
      thresholds: { minConsistencyRate: 0.99 },
      tags: ['consistency'],
    },
  ]

  for (const req of allScenarios) {
    const id = 'sc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    runner.registerScenario({ ...req, id })
  }

  const scenarios = runner.listScenarios()

  if (listOnly) {
    console.log('Available scenarios:\n')
    for (const sc of scenarios) {
      console.log(`  ${sc.id} - ${sc.name}`)
      console.log(`    ${sc.description}`)
      console.log(`    Tags: ${(sc.tags || []).join(', ')} | Pattern: ${sc.loadConfig.pattern} | Concurrency: ${sc.loadConfig.concurrency} | Duration: ${sc.loadConfig.duration}s`)
      console.log('')
    }
    process.exit(0)
  }

  let scenariosToRun: TestScenario[] = scenarios

  if (scenario) {
    const found = scenarios.find((s) => s.id === scenario)
    if (!found) {
      console.error(`❌ Scenario not found: ${scenario}`)
      process.exit(1)
    }
    scenariosToRun = [found]
  } else if (tags.length > 0) {
    scenariosToRun = scenarios.filter((s) =>
      tags.some((t) => s.tags?.includes(t)),
    )
    if (scenariosToRun.length === 0) {
      console.error(`❌ No scenarios found with tags: ${tags.join(', ')}`)
      process.exit(1)
    }
  }

  console.log(`Running ${scenariosToRun.length} scenario(s)...\n`)

  const results: TestRun[] = []

  for (const sc of scenariosToRun) {
    console.log(`⏳ Running: ${sc.name}...`)
    try {
      const run = await runner.runScenario(sc.id)
      results.push(run)
      printRunResult(run)
    } catch (err) {
      console.error(`❌ Failed to run scenario ${sc.name}: ${(err as Error).message}`)
    }
  }

  printSummary(results)

  const hasRegression = results.some((r) => !r.passed)
  if (hasRegression && failOnRegression) {
    console.log('❌ Performance regression detected! Exiting with code 1.')
    process.exit(1)
  } else if (hasRegression) {
    console.log('⚠️  Performance regression detected (no-fail mode).')
  } else {
    console.log('✅ All benchmarks passed!')
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(2)
})
