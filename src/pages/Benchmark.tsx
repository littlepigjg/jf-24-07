import { useState, useEffect, useCallback } from 'react'
import {
  Gauge,
  Play,
  Square,
  PlusCircle,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  TrendingUp,
  Shield,
  Activity,
  BarChart3,
  FileText,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { api } from '@/lib/api'
import type {
  TestScenario,
  TestRun,
  PerformanceReport,
  BottleneckAnalysis,
  Alert,
  PerformanceMetrics,
  LoadPattern,
  RequestMethod,
  CreateScenarioRequest,
} from '@shared/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#94a3b8', font: { size: 11 } },
    },
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      borderWidth: 1,
      titleColor: '#e2e8f0',
      bodyColor: '#cbd5e1',
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(148,163,184,0.06)' },
      ticks: { color: '#64748b', font: { size: 10 } },
      border: { display: false },
    },
    y: {
      grid: { color: 'rgba(148,163,184,0.06)' },
      ticks: { color: '#64748b', font: { size: 10 } },
      border: { display: false },
    },
  },
}

const patternOptions: { value: LoadPattern; label: string; desc: string }[] = [
  { value: 'constant', label: '恒定', desc: '固定并发数' },
  { value: 'ramp', label: '渐增', desc: '从低到高线性增加' },
  { value: 'spike', label: '尖峰', desc: '模拟突发流量' },
  { value: 'staircase', label: '阶梯', desc: '逐级增加并发' },
  { value: 'random', label: '随机', desc: '随机并发波动' },
]

const methodOptions: RequestMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

type TabId = 'scenarios' | 'runs' | 'report'

export default function Benchmark() {
  const [tab, setTab] = useState<TabId>('scenarios')
  const [scenarios, setScenarios] = useState<TestScenario[]>([])
  const [runs, setRuns] = useState<TestRun[]>([])
  const [selectedReport, setSelectedReport] = useState<PerformanceReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null)

  const loadScenarios = useCallback(async () => {
    try {
      const data = await api.listBenchmarkScenarios()
      setScenarios(data)
    } catch {
      setScenarios([])
    }
  }, [])

  const loadRuns = useCallback(async () => {
    try {
      const data = await api.listBenchmarkRuns()
      setRuns(data)
    } catch {
      setRuns([])
    }
  }, [])

  useEffect(() => {
    loadScenarios()
    loadRuns()
  }, [loadScenarios, loadRuns])

  const handleRun = async (scenarioId: string) => {
    setRunning(scenarioId)
    try {
      await api.runBenchmarkScenario(scenarioId)
      await loadRuns()
      if (tab === 'scenarios') setTab('runs')
    } catch (err) {
      console.error('Run failed:', err)
    } finally {
      setRunning(null)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.deleteBenchmarkScenario(id)
      await loadScenarios()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const handleViewReport = async (runId: string) => {
    setLoading(true)
    try {
      const report = await api.getBenchmarkReport(runId)
      setSelectedReport(report)
      setTab('report')
    } catch (err) {
      console.error('Report failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const tabs: { id: TabId; label: string; icon: typeof Gauge }[] = [
    { id: 'scenarios', label: '测试场景', icon: Gauge },
    { id: 'runs', label: '运行记录', icon: Activity },
    { id: 'report', label: '性能报告', icon: FileText },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">性能基准测试</h1>
          <p className="text-dark-400 mt-1 text-sm">自动化模拟不同负载，检测性能瓶颈，防止回归</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowCreate(true)}
        >
          <PlusCircle className="w-4 h-4" />
          新建场景
        </button>
      </div>

      <div className="flex gap-1 bg-dark-800/40 p-1 rounded-lg w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-brand-gradient text-white shadow-glow-sm'
                : 'text-dark-400 hover:text-white hover:bg-dark-700/50'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'scenarios' && (
        <ScenariosTab
          scenarios={scenarios}
          expandedScenario={expandedScenario}
          setExpandedScenario={setExpandedScenario}
          onRun={handleRun}
          onDelete={handleDelete}
          running={running}
          onRefresh={loadScenarios}
        />
      )}

      {tab === 'runs' && (
        <RunsTab
          runs={runs}
          onViewReport={handleViewReport}
          onRefresh={loadRuns}
          loading={loading}
        />
      )}

      {tab === 'report' && (
        <ReportTab report={selectedReport} />
      )}

      {showCreate && (
        <CreateScenarioModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false)
            await loadScenarios()
          }}
        />
      )}
    </div>
  )
}

function ScenariosTab({
  scenarios,
  expandedScenario,
  setExpandedScenario,
  onRun,
  onDelete,
  running,
  onRefresh,
}: {
  scenarios: TestScenario[]
  expandedScenario: string | null
  setExpandedScenario: (id: string | null) => void
  onRun: (id: string) => void
  onDelete: (id: string) => void
  running: string | null
  onRefresh: () => void
}) {
  const patternLabel: Record<string, string> = {
    constant: '恒定',
    ramp: '渐增',
    spike: '尖峰',
    staircase: '阶梯',
    random: '随机',
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-dark-400 text-sm">共 {scenarios.length} 个场景</span>
        <button className="btn-ghost text-sm" onClick={onRefresh}>
          <RefreshCw className="w-3.5 h-3.5" />
          刷新
        </button>
      </div>

      {scenarios.map((sc) => (
        <div key={sc.id} className="card overflow-hidden">
          <div
            className="flex items-center gap-3 p-4 cursor-pointer hover:bg-dark-700/30 transition-colors"
            onClick={() => setExpandedScenario(expandedScenario === sc.id ? null : sc.id)}
          >
            {expandedScenario === sc.id ? (
              <ChevronDown className="w-4 h-4 text-dark-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-dark-500" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{sc.name}</span>
                <span className="tag-blue">{patternLabel[sc.loadConfig.pattern] || sc.loadConfig.pattern}</span>
                {sc.tags?.map((t) => (
                  <span key={t} className="tag-gray">{t}</span>
                ))}
              </div>
              <p className="text-dark-500 text-xs mt-0.5">{sc.description}</p>
            </div>
            <div className="flex items-center gap-4 text-sm text-dark-400 flex-shrink-0">
              <span>并发: {sc.loadConfig.concurrency}</span>
              <span>时长: {sc.loadConfig.duration}s</span>
              <span>请求: {sc.requests.length}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                className="btn-primary text-xs py-1 px-3"
                onClick={(e) => { e.stopPropagation(); onRun(sc.id) }}
                disabled={running === sc.id}
              >
                {running === sc.id ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 运行中</>
                ) : (
                  <><Play className="w-3.5 h-3.5" /> 运行</>
                )}
              </button>
              <button
                className="btn-ghost text-xs py-1 px-2 text-danger-400 hover:text-danger-300"
                onClick={(e) => { e.stopPropagation(); onDelete(sc.id) }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {expandedScenario === sc.id && (
            <div className="border-t border-dark-700 p-4 bg-dark-900/30 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-dark-300 mb-2">请求模板</h4>
                <div className="space-y-1">
                  {sc.requests.map((req, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className={`tag ${
                        req.method === 'GET' ? 'tag-green' :
                        req.method === 'POST' ? 'tag-blue' :
                        req.method === 'PUT' ? 'tag-orange' : 'tag-red'
                      }`}>
                        {req.method}
                      </span>
                      <span className="text-dark-200 font-mono text-xs">{req.url}</span>
                      {req.validationFn && <span className="tag-gray">含验证</span>}
                    </div>
                  ))}
                </div>
              </div>

              {sc.thresholds && (
                <div>
                  <h4 className="text-sm font-medium text-dark-300 mb-2">阈值配置</h4>
                  <div className="flex flex-wrap gap-2">
                    {sc.thresholds.maxLatencyP95 !== undefined && (
                      <span className="tag-orange">P95 &lt; {sc.thresholds.maxLatencyP95}ms</span>
                    )}
                    {sc.thresholds.maxLatencyP99 !== undefined && (
                      <span className="tag-orange">P99 &lt; {sc.thresholds.maxLatencyP99}ms</span>
                    )}
                    {sc.thresholds.minThroughput !== undefined && (
                      <span className="tag-blue">TPS &gt; {sc.thresholds.minThroughput}</span>
                    )}
                    {sc.thresholds.maxErrorRate !== undefined && (
                      <span className="tag-red">错误率 &lt; {(sc.thresholds.maxErrorRate * 100).toFixed(0)}%</span>
                    )}
                    {sc.thresholds.minConsistencyRate !== undefined && (
                      <span className="tag-green">一致性 &gt; {(sc.thresholds.minConsistencyRate * 100).toFixed(0)}%</span>
                    )}
                  </div>
                </div>
              )}

              {sc.alerts && sc.alerts.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-dark-300 mb-2">告警规则</h4>
                  <div className="space-y-1">
                    {sc.alerts.map((alert, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={`tag ${alert.severity === 'critical' ? 'tag-red' : alert.severity === 'warning' ? 'tag-orange' : 'tag-blue'}`}>
                          {alert.severity}
                        </span>
                        <span className="text-dark-300">{alert.name}: {alert.metric} {alert.operator} {alert.threshold}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {scenarios.length === 0 && (
        <div className="card p-12 text-center">
          <Gauge className="w-12 h-12 text-dark-600 mx-auto mb-3" />
          <p className="text-dark-400">暂无测试场景，点击右上角新建</p>
        </div>
      )}
    </div>
  )
}

function RunsTab({
  runs,
  onViewReport,
  onRefresh,
  loading,
}: {
  runs: TestRun[]
  onViewReport: (id: string) => void
  onRefresh: () => void
  loading: boolean
}) {
  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-success-500" />
      case 'running': return <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
      case 'failed': return <XCircle className="w-4 h-4 text-danger-500" />
      case 'cancelled': return <Square className="w-4 h-4 text-dark-500" />
      default: return <Clock className="w-4 h-4 text-dark-500" />
    }
  }

  const statusLabel: Record<string, string> = {
    idle: '空闲',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
  }

  const sorted = [...runs].sort((a, b) => b.startTime - a.startTime)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-dark-400 text-sm">共 {runs.length} 条记录</span>
        <button className="btn-ghost text-sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-700">
              <th className="table-head">状态</th>
              <th className="table-head">场景</th>
              <th className="table-head">模式</th>
              <th className="table-head">并发</th>
              <th className="table-head">耗时</th>
              <th className="table-head">结果</th>
              <th className="table-head">时间</th>
              <th className="table-head">操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((run) => (
              <tr key={run.id} className="table-row">
                <td className="table-cell">
                  <div className="flex items-center gap-1.5">
                    {statusIcon(run.status)}
                    <span className="text-xs">{statusLabel[run.status] || run.status}</span>
                  </div>
                </td>
                <td className="table-cell font-medium text-white">{run.scenarioName}</td>
                <td className="table-cell">
                  <span className="tag-blue">{run.config.pattern}</span>
                </td>
                <td className="table-cell">{run.config.concurrency}</td>
                <td className="table-cell">{run.duration ? `${(run.duration / 1000).toFixed(1)}s` : '—'}</td>
                <td className="table-cell">
                  {run.passed !== undefined ? (
                    run.passed ? (
                      <span className="tag-green">通过</span>
                    ) : (
                      <span className="tag-red">未通过</span>
                    )
                  ) : '—'}
                </td>
                <td className="table-cell text-xs text-dark-500">
                  {new Date(run.startTime).toLocaleString('zh-CN')}
                </td>
                <td className="table-cell">
                  {run.status === 'completed' && (
                    <button
                      className="btn-ghost text-xs py-1 px-2"
                      onClick={() => onViewReport(run.id)}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      报告
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {runs.length === 0 && (
          <div className="p-12 text-center">
            <Activity className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">暂无运行记录，先运行一个场景</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ReportTab({ report }: { report: PerformanceReport | null }) {
  if (!report) {
    return (
      <div className="card p-12 text-center">
        <FileText className="w-12 h-12 text-dark-600 mx-auto mb-3" />
        <p className="text-dark-400">选择一个运行记录查看报告</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-display font-bold text-white">{report.scenarioName}</h2>
        {report.summary.passed ? (
          <span className="tag-green"><CheckCircle2 className="w-3 h-3" /> 通过</span>
        ) : (
          <span className="tag-red"><XCircle className="w-3 h-3" /> 未通过</span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="总请求数"
          value={report.summary.totalRequests.toString()}
          icon={Activity}
          color="from-brand-500 to-accent-500"
        />
        <SummaryCard
          label="P95 延迟"
          value={`${report.summary.p95Latency.toFixed(1)}ms`}
          icon={Clock}
          color="from-warning-500 to-brand-500"
          warn={report.summary.p95Latency > 1000}
        />
        <SummaryCard
          label="吞吐量"
          value={`${report.summary.throughput.toFixed(1)} req/s`}
          icon={Zap}
          color="from-accent-500 to-success-500"
          warn={report.summary.throughput < 50}
        />
        <SummaryCard
          label="错误率"
          value={`${(report.summary.errorRate * 100).toFixed(2)}%`}
          icon={AlertTriangle}
          color="from-danger-500 to-warning-500"
          warn={report.summary.errorRate > 0.05}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="grid grid-cols-2 gap-4">
          <SummaryCard
            label="P50 延迟"
            value={`${report.metrics.latency.p50.toFixed(1)}ms`}
            icon={Clock}
            color="from-dark-500 to-dark-400"
          />
          <SummaryCard
            label="P99 延迟"
            value={`${report.metrics.latency.p99.toFixed(1)}ms`}
            icon={Clock}
            color="from-dark-500 to-dark-400"
          />
          <SummaryCard
            label="一致性率"
            value={`${(report.summary.consistencyRate * 100).toFixed(2)}%`}
            icon={Shield}
            color="from-success-500 to-accent-500"
          />
          <SummaryCard
            label="平均延迟"
            value={`${report.metrics.latency.avg.toFixed(1)}ms`}
            icon={TrendingUp}
            color="from-dark-500 to-dark-400"
          />
        </div>

        <StatusCodeChart metrics={report.metrics} />
      </div>

      <LatencyChart report={report} />
      <ThroughputChart report={report} />

      {report.bottlenecks.length > 0 && (
        <BottleneckSection bottlenecks={report.bottlenecks} />
      )}

      {report.alerts.length > 0 && (
        <AlertSection alerts={report.alerts} />
      )}

      <EndpointLatencyChart report={report} />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
  warn,
}: {
  label: string
  value: string
  icon: typeof Gauge
  color: string
  warn?: boolean
}) {
  return (
    <div className={`stat-card ${warn ? 'border-danger-500/50' : ''}`}>
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-dark-400 text-xs">{label}</p>
            <p className={`text-xl font-display font-bold mt-1 ${warn ? 'text-danger-400' : 'text-white'}`}>{value}</p>
          </div>
          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>
    </div>
  )
}

function LatencyChart({ report }: { report: PerformanceReport }) {
  const latencyChart = report.charts.find((c) => c.id === 'chart_latency_time')
  if (!latencyChart) return null

  const data = {
    labels: latencyChart.data.map((d: any) => d.time),
    datasets: [
      {
        label: 'P50',
        data: latencyChart.data.map((d: any) => d.p50),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.1)',
        fill: false,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 2,
      },
      {
        label: 'P95',
        data: latencyChart.data.map((d: any) => d.p95),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245,158,11,0.1)',
        fill: false,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 2,
      },
      {
        label: 'P99',
        data: latencyChart.data.map((d: any) => d.p99),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.1)',
        fill: false,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 2,
      },
    ],
  }

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-brand-400" />
        延迟趋势 (P50 / P95 / P99)
      </h3>
      <div className="h-64">
        <Line data={data} options={chartOptions} />
      </div>
    </div>
  )
}

function ThroughputChart({ report }: { report: PerformanceReport }) {
  const tpsChart = report.charts.find((c) => c.id === 'chart_throughput_time')
  if (!tpsChart) return null

  const data = {
    labels: tpsChart.data.map((d: any) => d.time),
    datasets: [
      {
        label: 'req/s',
        data: tpsChart.data.map((d: any) => Math.round(d.rps * 10) / 10),
        borderColor: '#1677FF',
        backgroundColor: 'rgba(22,119,255,0.15)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 2,
      },
    ],
  }

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-accent-400" />
        吞吐量趋势
      </h3>
      <div className="h-52">
        <Line data={data} options={chartOptions} />
      </div>
    </div>
  )
}

function StatusCodeChart({ metrics }: { metrics: PerformanceMetrics }) {
  const statusBreakdown = metrics.errors.statusCodeBreakdown
  const okCount = metrics.throughput.totalRequests - metrics.errors.totalErrors
  const labels: string[] = []
  const values: number[] = []
  const colors: string[] = []

  if (okCount > 0) {
    labels.push('2xx/3xx')
    values.push(okCount)
    colors.push('#22c55e')
  }

  for (const [code, count] of Object.entries(statusBreakdown)) {
    labels.push(code)
    values.push(count)
    colors.push(Number(code) >= 500 ? '#ef4444' : Number(code) >= 400 ? '#f59e0b' : '#64748b')
  }

  const data = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: colors,
      borderWidth: 0,
    }],
  }

  const opts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: '#94a3b8', font: { size: 11 }, padding: 12 },
      },
    },
  }

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-success-400" />
        状态码分布
      </h3>
      <div className="h-48">
        <Doughnut data={data} options={opts} />
      </div>
    </div>
  )
}

function EndpointLatencyChart({ report }: { report: PerformanceReport }) {
  const epChart = report.charts.find((c) => c.id === 'chart_latency_endpoint')
  if (!epChart || epChart.data.length === 0) return null

  const data = {
    labels: epChart.data.map((d: any) => d.endpoint),
    datasets: [
      {
        label: '平均延迟',
        data: epChart.data.map((d: any) => d.avg),
        backgroundColor: 'rgba(22,119,255,0.6)',
        borderWidth: 0,
        borderRadius: 4,
      },
      {
        label: 'P95延迟',
        data: epChart.data.map((d: any) => d.p95),
        backgroundColor: 'rgba(245,158,11,0.6)',
        borderWidth: 0,
        borderRadius: 4,
      },
    ],
  }

  const opts = {
    ...chartOptions,
    indexAxis: 'y' as const,
  }

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-warning-400" />
        各端点延迟对比
      </h3>
      <div className="h-64">
        <Bar data={data} options={opts} />
      </div>
    </div>
  )
}

function BottleneckSection({ bottlenecks }: { bottlenecks: BottleneckAnalysis[] }) {
  const severityIcon = (s: string) => {
    switch (s) {
      case 'critical': return <span className="w-2 h-2 rounded-full bg-danger-500" />
      case 'high': return <span className="w-2 h-2 rounded-full bg-warning-500" />
      case 'medium': return <span className="w-2 h-2 rounded-full bg-brand-400" />
      default: return <span className="w-2 h-2 rounded-full bg-dark-500" />
    }
  }

  const severityLabel: Record<string, string> = {
    critical: '严重',
    high: '高',
    medium: '中',
    low: '低',
  }

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-danger-400" />
        瓶颈分析 ({bottlenecks.length})
      </h3>
      <div className="space-y-3">
        {bottlenecks.map((bn) => (
          <div key={bn.id} className="p-3 rounded-lg bg-dark-900/40 border border-dark-700">
            <div className="flex items-center gap-2 mb-1">
              {severityIcon(bn.severity)}
              <span className={`tag ${
                bn.severity === 'critical' ? 'tag-red' :
                bn.severity === 'high' ? 'tag-orange' :
                bn.severity === 'medium' ? 'tag-blue' : 'tag-gray'
              }`}>
                {severityLabel[bn.severity] || bn.severity}
              </span>
              <span className="tag-gray">{bn.type}</span>
              <span className="text-white text-sm font-medium">{bn.description}</span>
            </div>
            <p className="text-dark-400 text-xs mt-1">💡 {bn.recommendation}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function AlertSection({ alerts }: { alerts: Alert[] }) {
  const severityIcon = (s: string) => {
    switch (s) {
      case 'critical': return '🔴'
      case 'warning': return '🟡'
      default: return '🔵'
    }
  }

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-warning-400" />
        告警 ({alerts.length})
      </h3>
      <div className="space-y-2">
        {alerts.map((alert) => (
          <div key={alert.id} className="flex items-start gap-2 p-2 rounded-lg bg-dark-900/40">
            <span>{severityIcon(alert.severity)}</span>
            <div>
              <p className="text-sm text-white font-medium">{alert.name}</p>
              <p className="text-xs text-dark-400">{alert.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CreateScenarioModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [pattern, setPattern] = useState<LoadPattern>('constant')
  const [concurrency, setConcurrency] = useState(10)
  const [duration, setDuration] = useState(30)
  const [minConcurrency, setMinConcurrency] = useState(1)
  const [maxConcurrency, setMaxConcurrency] = useState(50)
  const [steps, setSteps] = useState(5)
  const [requests, setRequests] = useState<{ method: RequestMethod; url: string }[]>([
    { method: 'GET', url: '/api/qrcodes' },
  ])
  const [p95Threshold, setP95Threshold] = useState(1000)
  const [rpsThreshold, setRpsThreshold] = useState(50)
  const [errorRateThreshold, setErrorRateThreshold] = useState(5)
  const [consistencyThreshold, setConsistencyThreshold] = useState(99)
  const [submitting, setSubmitting] = useState(false)

  const addRequest = () => {
    setRequests([...requests, { method: 'GET', url: '' }])
  }

  const removeRequest = (index: number) => {
    setRequests(requests.filter((_, i) => i !== index))
  }

  const updateRequest = (index: number, field: 'method' | 'url', value: string) => {
    const updated = [...requests]
    updated[index] = { ...updated[index], [field]: value }
    setRequests(updated)
  }

  const handleSubmit = async () => {
    if (!name || requests.some((r) => !r.url)) return
    setSubmitting(true)
    try {
      const req: CreateScenarioRequest = {
        name,
        description,
        loadConfig: {
          concurrency,
          duration,
          pattern,
          minConcurrency: pattern !== 'constant' ? minConcurrency : undefined,
          maxConcurrency: pattern !== 'constant' ? maxConcurrency : undefined,
          steps: pattern === 'staircase' ? steps : undefined,
        },
        requests: requests.map((r) => ({ method: r.method, url: r.url })),
        thresholds: {
          maxLatencyP95: p95Threshold,
          minThroughput: rpsThreshold,
          maxErrorRate: errorRateThreshold / 100,
          minConsistencyRate: consistencyThreshold / 100,
        },
        tags: [pattern],
      }
      await api.createBenchmarkScenario(req)
      onCreated()
    } catch (err) {
      console.error('Create failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-dark-700">
          <h2 className="text-xl font-display font-bold text-white">新建测试场景</h2>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="label">场景名称</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：并发读写测试" />
          </div>

          <div>
            <label className="label">描述</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="测试目的和说明" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">负载模式</label>
              <select className="input" value={pattern} onChange={(e) => setPattern(e.target.value as LoadPattern)}>
                {patternOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label} - {o.desc}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">并发数</label>
              <input className="input" type="number" value={concurrency} onChange={(e) => setConcurrency(Number(e.target.value))} min={1} />
            </div>
            <div>
              <label className="label">持续时间(s)</label>
              <input className="input" type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={5} />
            </div>
          </div>

          {pattern !== 'constant' && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">最小并发</label>
                <input className="input" type="number" value={minConcurrency} onChange={(e) => setMinConcurrency(Number(e.target.value))} min={1} />
              </div>
              <div>
                <label className="label">最大并发</label>
                <input className="input" type="number" value={maxConcurrency} onChange={(e) => setMaxConcurrency(Number(e.target.value))} min={1} />
              </div>
              {pattern === 'staircase' && (
                <div>
                  <label className="label">阶梯数</label>
                  <input className="input" type="number" value={steps} onChange={(e) => setSteps(Number(e.target.value))} min={2} />
                </div>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">请求模板</label>
              <button className="btn-ghost text-xs py-1" onClick={addRequest}>
                <PlusCircle className="w-3.5 h-3.5" /> 添加
              </button>
            </div>
            <div className="space-y-2">
              {requests.map((req, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    className="input w-24"
                    value={req.method}
                    onChange={(e) => updateRequest(i, 'method', e.target.value)}
                  >
                    {methodOptions.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <input
                    className="input flex-1"
                    value={req.url}
                    onChange={(e) => updateRequest(i, 'url', e.target.value)}
                    placeholder="/api/endpoint"
                  />
                  {requests.length > 1 && (
                    <button className="btn-ghost text-danger-400 p-1" onClick={() => removeRequest(i)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="label">阈值配置</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-dark-500">P95延迟上限(ms)</label>
                <input className="input" type="number" value={p95Threshold} onChange={(e) => setP95Threshold(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs text-dark-500">最小吞吐量(req/s)</label>
                <input className="input" type="number" value={rpsThreshold} onChange={(e) => setRpsThreshold(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs text-dark-500">最大错误率(%)</label>
                <input className="input" type="number" value={errorRateThreshold} onChange={(e) => setErrorRateThreshold(Number(e.target.value))} min={0} max={100} />
              </div>
              <div>
                <label className="text-xs text-dark-500">最低一致性(%)</label>
                <input className="input" type="number" value={consistencyThreshold} onChange={(e) => setConsistencyThreshold(Number(e.target.value))} min={0} max={100} />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-dark-700 flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!name || requests.some((r) => !r.url) || submitting}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
            创建
          </button>
        </div>
      </div>
    </div>
  )
}
