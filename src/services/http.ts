import { useAuth } from '../store/auth'

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const t = useAuth.getState().token
  const r = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) } })
  if (r.status === 401) useAuth.getState().logout()
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : 'Request failed. Is the backend running?')
  return d as T
}
