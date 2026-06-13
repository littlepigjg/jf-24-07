export type QrCodeType = 'static' | 'dynamic'
export type ErrorLevel = 'L' | 'M' | 'Q' | 'H'
export type BatchStatus = 'pending' | 'running' | 'done' | 'failed'

export interface QrCode {
  id: string
  name: string
  type: QrCodeType
  targetUrl: string
  shortCode: string
  size: number
  foreground: string
  background: string
  errorLevel: ErrorLevel
  logoDataUrl?: string
  enabled: boolean
  scanCount: number
  createdAt: string
  updatedAt: string
}

export interface ScanRecord {
  id: string
  qrcodeId: string
  shortCode: string
  timestamp: string
  ip: string
  userAgent: string
  referer?: string
}

export interface BatchTask {
  id: string
  name: string
  baseUrl: string
  paramName: string
  totalCount: number
  successCount: number
  status: BatchStatus
  qrcodeIds: string[]
  createdAt: string
}

export interface CreateQrCodeRequest {
  name: string
  type: QrCodeType
  targetUrl: string
  shortCode?: string
  size?: number
  foreground?: string
  background?: string
  errorLevel?: ErrorLevel
  logoDataUrl?: string
}

export interface UpdateQrCodeRequest {
  name?: string
  targetUrl?: string
  size?: number
  foreground?: string
  background?: string
  errorLevel?: ErrorLevel
  logoDataUrl?: string
}

export interface BatchGenerateRequest {
  name: string
  baseUrl: string
  paramName: string
  paramValues: string[]
  template?: Partial<CreateQrCodeRequest>
}

export interface TrendPoint {
  date: string
  count: number
}

export interface OverviewStats {
  totalQrCodes: number
  activeQrCodes: number
  totalScans: number
  todayScans: number
  thisWeekScans: number
  topQrCodes: { id: string; name: string; scanCount: number }[]
  trendByDay: TrendPoint[]
}

export interface QrCodeStats {
  qrcode: QrCode
  totalScans: number
  todayScans: number
  thisWeekScans: number
  avgDaily: number
  trendByDay: TrendPoint[]
  trendByHour: TrendPoint[]
  recentRecords: ScanRecord[]
}

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export type PerformanceTestStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
export type LoadPattern = 'constant' | 'ramp' | 'spike' | 'staircase' | 'random'
export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface LatencyMetrics {
  min: number
  max: number
  avg: number
  median: number
  p50: number
  p75: number
  p90: number
  p95: number
  p99: number
  p999: number
  stdDev: number
}

export interface ThroughputMetrics {
  totalRequests: number
  requestsPerSecond: number
  bytesTransferred: number
  bytesPerSecond: number
}

export interface ErrorMetrics {
  totalErrors: number
  errorRate: number
  errorBreakdown: Record<string, number>
  statusCodeBreakdown: Record<number, number>
}

export interface ConsistencyMetrics {
  totalChecks: number
  inconsistentResults: number
  consistencyRate: number
  inconsistencies: { requestId: string; expected: any; actual: any }[]
}

export interface RequestSample {
  id: string
  timestamp: number
  method: RequestMethod
  url: string
  latency: number
  statusCode: number
  success: boolean
  error?: string
  bytes?: number
  requestBody?: any
  responseBody?: any
}

export interface ThresholdConfig {
  maxLatencyP95?: number
  maxLatencyP99?: number
  minThroughput?: number
  maxErrorRate?: number
  minConsistencyRate?: number
}

export interface AlertConfig {
  id: string
  name: string
  severity: AlertSeverity
  threshold: number
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq'
  metric: keyof PerformanceMetrics | string
  message: string
}

export interface Alert {
  id: string
  name: string
  severity: AlertSeverity
  metric: string
  value: number
  threshold: number
  operator: string
  message: string
  triggeredAt: number
}

export interface PerformanceMetrics {
  latency: LatencyMetrics
  throughput: ThroughputMetrics
  errors: ErrorMetrics
  consistency: ConsistencyMetrics
  samples: RequestSample[]
  timestamp: number
}

export interface LoadConfig {
  concurrency: number
  duration: number
  rampUpDuration?: number
  rampDownDuration?: number
  pattern: LoadPattern
  minConcurrency?: number
  maxConcurrency?: number
  steps?: number
  requestsPerSecond?: number
}

export interface RequestTemplate {
  method: RequestMethod
  url: string
  headers?: Record<string, string>
  body?: any
  params?: Record<string, any>
  validationFn?: string
}

export interface TestScenario {
  id: string
  name: string
  description: string
  loadConfig: LoadConfig
  requests: RequestTemplate[]
  thresholds?: ThresholdConfig
  alerts?: AlertConfig[]
  consistencyCheck?: boolean
  tags?: string[]
}

export interface TestRun {
  id: string
  scenarioId: string
  scenarioName: string
  status: PerformanceTestStatus
  startTime: number
  endTime?: number
  duration?: number
  metrics?: PerformanceMetrics
  alerts?: Alert[]
  bottlenecks?: BottleneckAnalysis[]
  passed?: boolean
  config: LoadConfig
}

export interface BottleneckAnalysis {
  id: string
  type: 'latency' | 'throughput' | 'error' | 'consistency' | 'resource'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  affectedMetric: string
  value: number
  threshold?: number
  recommendation: string
}

export interface PerformanceReport {
  id: string
  runId: string
  scenarioName: string
  generatedAt: number
  summary: {
    totalRequests: number
    avgLatency: number
    p95Latency: number
    p99Latency: number
    throughput: number
    errorRate: number
    consistencyRate: number
    passed: boolean
  }
  metrics: PerformanceMetrics
  alerts: Alert[]
  bottlenecks: BottleneckAnalysis[]
  charts: ReportChart[]
}

export interface ReportChart {
  id: string
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'histogram'
  title: string
  data: any[]
  xAxis?: string
  yAxis?: string
}

export interface BenchmarkHistory {
  runs: TestRun[]
  baseline?: TestRun
}

export interface CreateScenarioRequest {
  name: string
  description: string
  loadConfig: LoadConfig
  requests: RequestTemplate[]
  thresholds?: ThresholdConfig
  alerts?: AlertConfig[]
  consistencyCheck?: boolean
  tags?: string[]
}

export interface RunScenarioRequest {
  scenarioId: string
  overrides?: Partial<LoadConfig>
}
