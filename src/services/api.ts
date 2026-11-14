import { riskHistory, sleepWeek, shapGlobal } from '../data/mock'

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(BASE + path)
    if (!r.ok) throw new Error(String(r.status))
    return (await r.json()) as T
  } catch {
    return fallback
  }
}

export const riskService = { history: () => get<number[]>('/api/risk/history', riskHistory) }
export const analyticsService = { sleep: () => get('/api/analytics/sleep', sleepWeek) }
export const explainService = { global: () => get('/api/explain/global', shapGlobal) }
