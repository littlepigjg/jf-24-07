import type {
  LoadConfig,
  RequestTemplate,
  RequestSample,
} from '../../shared/types.js'
import { MetricsCollector } from './MetricsCollector.js'

interface LoadWorkerState {
  activeWorkers: number
  targetWorkers: number
  startTime: number
  endTime: number
  requestCount: number
}

export class LoadGenerator {
  private state: LoadWorkerState = {
    activeWorkers: 0,
    targetWorkers: 0,
    startTime: 0,
    endTime: 0,
    requestCount: 0,
  }

  private abortController: AbortController | null = null
  private metricsCollector: MetricsCollector
  private baseUrl: string
  private inconsistencies: { requestId: string; expected: any; actual: any }[] = []

  constructor(
    private config: LoadConfig,
    private requests: RequestTemplate[],
    baseUrl: string,
    private consistencyCheck = false,
  ) {
    this.metricsCollector = new MetricsCollector()
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  async executeRequest(template: RequestTemplate): Promise<RequestSample> {
    const id = this.generateId()
    const startTime = performance.now()
    const method = template.method
    const url = this.buildUrl(template)
    const timestamp = Date.now()

    let statusCode = 200
    let success = true
    let error: string | undefined
    let bytes = 0
    let responseBody: any

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...template.headers,
      }

      const fetchUrl = this.baseUrl + url

      const response = await fetch(fetchUrl, {
        method,
        headers,
        body: template.body ? JSON.stringify(template.body) : undefined,
        signal: this.abortController?.signal,
      })

      statusCode = response.status
      bytes = Number(response.headers.get('content-length') || 0)
      responseBody = await response.text()

      try {
        responseBody = JSON.parse(responseBody)
      } catch {
        // Keep as string if not JSON
      }

      success = response.ok

      if (template.validationFn) {
        const validationResult = this.executeValidation(template.validationFn, responseBody)
        if (!validationResult.valid) {
          success = false
          error = validationResult.error
        }
      }

      if (this.consistencyCheck && method === 'GET') {
        this.checkConsistency(id, responseBody)
      }
    } catch (err) {
      success = false
      error = err instanceof Error ? err.message : String(err)
      statusCode = 0
    }

    const latency = performance.now() - startTime

    return {
      id,
      timestamp,
      method,
      url,
      latency,
      statusCode,
      success,
      error,
      bytes,
      requestBody: template.body,
      responseBody,
    }
  }

  private executeValidation(validationFn: string, responseBody: any): { valid: boolean; error?: string } {
    try {
      const fn = new Function('response', `return (${validationFn})(response)`)
      const result = fn(responseBody)
      if (result === true) {
        return { valid: true }
      }
      return { valid: false, error: typeof result === 'string' ? result : 'Validation failed' }
    } catch (err) {
      return { valid: false, error: `Validation function error: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  private checkConsistency(requestId: string, responseBody: any): void {
    if (responseBody && typeof responseBody === 'object' && responseBody.data) {
      const data = responseBody.data
      if (Array.isArray(data)) {
        const ids = new Set(data.map((item: any) => item.id))
        if (ids.size !== data.length) {
          this.inconsistencies.push({
            requestId,
            expected: `Unique count: ${data.length}`,
            actual: `Unique count: ${ids.size}`,
          })
        }
      }
    }
  }

  private buildUrl(template: RequestTemplate): string {
    let url = template.url
    if (template.params) {
      for (const [key, value] of Object.entries(template.params)) {
        url = url.replace(`{${key}}`, String(value))
      }
    }
    return url
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  }

  private calculateTargetWorkers(elapsed: number): number {
    const { duration, pattern, concurrency, minConcurrency = 1, maxConcurrency = concurrency, steps = 10 } = this.config
    const progress = Math.min(elapsed / duration, 1)

    switch (pattern) {
      case 'constant':
        return concurrency

      case 'ramp':
        return Math.floor(minConcurrency + (maxConcurrency - minConcurrency) * progress)

      case 'spike':
        if (progress < 0.1) {
          return Math.floor(minConcurrency + (maxConcurrency - minConcurrency) * (progress / 0.1))
        } else if (progress < 0.2) {
          return Math.floor(maxConcurrency - (maxConcurrency - minConcurrency) * ((progress - 0.1) / 0.1))
        }
        return minConcurrency

      case 'staircase':
        const stepSize = (maxConcurrency - minConcurrency) / steps
        const currentStep = Math.floor(progress * steps)
        return Math.floor(minConcurrency + stepSize * currentStep)

      case 'random':
        return Math.floor(minConcurrency + Math.random() * (maxConcurrency - minConcurrency))

      default:
        return concurrency
    }
  }

  async run(
    onProgress?: (metrics: any) => void,
    onWorkerUpdate?: (active: number, target: number) => void,
  ): Promise<{ metrics: any; inconsistencies: any[] }> {
    this.abortController = new AbortController()
    this.state.startTime = Date.now()
    this.state.endTime = this.state.startTime + this.config.duration * 1000
    this.inconsistencies = []
    this.metricsCollector.reset()

    const runLoop = async (): Promise<void> => {
      const elapsed = (Date.now() - this.state.startTime) / 1000
      if (elapsed >= this.config.duration) return

      this.state.targetWorkers = this.calculateTargetWorkers(elapsed)
      onWorkerUpdate?.(this.state.activeWorkers, this.state.targetWorkers)

      while (this.state.activeWorkers < this.state.targetWorkers) {
        this.state.activeWorkers++
        this.runWorker().finally(() => {
          this.state.activeWorkers--
        })
      }

      if (Date.now() < this.state.endTime) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return runLoop()
      }
    }

    const progressInterval = setInterval(() => {
      const metrics = this.metricsCollector.getMetrics(this.inconsistencies)
      onProgress?.(metrics)
    }, 500)

    try {
      await runLoop()
    } finally {
      clearInterval(progressInterval)
    }

    const metrics = this.metricsCollector.getMetrics(this.inconsistencies)
    return { metrics, inconsistencies: this.inconsistencies }
  }

  private async runWorker(): Promise<void> {
    while (Date.now() < this.state.endTime && !this.abortController?.signal.aborted) {
      const template = this.requests[Math.floor(Math.random() * this.requests.length)]
      const sample = await this.executeRequest(template)
      this.metricsCollector.addSample(sample)
      this.state.requestCount++

      if (this.config.requestsPerSecond) {
        const delay = 1000 / this.config.requestsPerSecond
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  stop(): void {
    this.abortController?.abort()
  }

  getMetrics(): any {
    return this.metricsCollector.getMetrics(this.inconsistencies)
  }
}