import { Router, type Request, type Response } from 'express'
import { BenchmarkService } from '../services/BenchmarkService.js'
import type { CreateScenarioRequest, RunScenarioRequest } from '../../shared/types.js'

const router = Router()
const service = BenchmarkService.getInstance()

router.get('/scenarios', (_req: Request, res: Response): void => {
  try {
    const scenarios = service.listScenarios()
    res.json({ success: true, data: scenarios })
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message })
  }
})

router.get('/scenarios/:id', (req: Request, res: Response): void => {
  try {
    const scenario = service.getScenario(req.params.id)
    if (!scenario) {
      res.status(404).json({ success: false, error: 'Scenario not found' })
      return
    }
    res.json({ success: true, data: scenario })
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message })
  }
})

router.post('/scenarios', (req: Request, res: Response): void => {
  try {
    const body = req.body as CreateScenarioRequest
    if (!body.name || !body.loadConfig || !body.requests || body.requests.length === 0) {
      res.status(400).json({ success: false, error: 'name, loadConfig, requests are required' })
      return
    }
    const scenario = service.addScenario(body)
    res.status(201).json({ success: true, data: scenario })
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message })
  }
})

router.delete('/scenarios/:id', (req: Request, res: Response): void => {
  try {
    const removed = service.removeScenario(req.params.id)
    if (!removed) {
      res.status(404).json({ success: false, error: 'Scenario not found' })
      return
    }
    res.json({ success: true, message: 'Scenario deleted' })
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message })
  }
})

router.post('/run', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as RunScenarioRequest
    if (!body.scenarioId) {
      res.status(400).json({ success: false, error: 'scenarioId is required' })
      return
    }
    const run = await service.runScenario(body.scenarioId, body.overrides)
    res.json({ success: true, data: run })
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message })
  }
})

router.post('/run/:id/cancel', (req: Request, res: Response): void => {
  try {
    const cancelled = service.cancelRun(req.params.id)
    if (!cancelled) {
      res.status(404).json({ success: false, error: 'Run not found or not running' })
      return
    }
    res.json({ success: true, message: 'Run cancelled' })
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message })
  }
})

router.get('/runs', (req: Request, res: Response): void => {
  try {
    const scenarioId = req.query.scenarioId as string | undefined
    const runs = service.listRuns(scenarioId)
    res.json({ success: true, data: runs })
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message })
  }
})

router.get('/runs/:id', (req: Request, res: Response): void => {
  try {
    const run = service.getRun(req.params.id)
    if (!run) {
      res.status(404).json({ success: false, error: 'Run not found' })
      return
    }
    res.json({ success: true, data: run })
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message })
  }
})

router.get('/runs/:id/report', (req: Request, res: Response): void => {
  try {
    const report = service.getReport(req.params.id)
    if (!report) {
      res.status(404).json({ success: false, error: 'Report not found' })
      return
    }
    res.json({ success: true, data: report })
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message })
  }
})

router.get('/history', (req: Request, res: Response): void => {
  try {
    const scenarioId = req.query.scenarioId as string | undefined
    const limit = parseInt(req.query.limit as string, 10) || 20
    const history = service.getHistory(scenarioId, limit)
    res.json({ success: true, data: history })
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message })
  }
})

router.get('/compare', (req: Request, res: Response): void => {
  try {
    const runId = req.query.runId as string
    const baselineId = req.query.baselineId as string
    if (!runId || !baselineId) {
      res.status(400).json({ success: false, error: 'runId and baselineId are required' })
      return
    }
    const comparison = service.compareWithBaseline(runId, baselineId)
    if (!comparison) {
      res.status(404).json({ success: false, error: 'Run or baseline not found' })
      return
    }
    res.json({ success: true, data: comparison })
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message })
  }
})

export default router
