import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/http'

interface N { id: number; title: string; body: string; read: number; created: string }

export default function Notifications() {
  const [d, setD] = useState<{ unread: number; items: N[] } | null>(null)
  const [rem, setRem] = useState(true)
  const [th, setTh] = useState(10)
  const [err, setErr] = useState('')
  const load = useCallback(() => {
    api<{ unread: number; items: N[] }>('/api/notifications').then(setD).catch((e) => setErr(e.message))
    api<{ reminders: boolean; alert_threshold: number }>('/api/settings').then((s) => { setRem(s.reminders); setTh(s.alert_threshold) }).catch(() => {})
  }, [])
  useEffect(load, [load])
  const run = (p: Promise<unknown>) => p.then(load).catch((e) => setErr(e.message))
  const toggle = (v: boolean) => { setRem(v); run(api('/api/settings', { method: 'PUT', body: JSON.stringify({ alert_threshold: th, reminders: v }) })) }

  return (
    <div>
      <h1 className="m-0 text-3xl font-extrabold">Notifications</h1>
      <p className="mt-1 mb-6 text-mute">Created by real events: saved assessments, completed goals, and mood check-in reminders.</p>
      {err && <p role="alert" className="text-red-700">{err}</p>}
      <section className="mb-4 rounded-3xl border border-line bg-white p-6">
        <label className="flex min-h-11 items-center gap-3 font-semibold"><input type="checkbox" checked={rem} onChange={(e) => toggle(e.target.checked)} className="h-5 w-5" /> Remind me to log my mood if I have not for 2 days</label>
      </section>
      <section className="rounded-3xl border border-line bg-white p-6">
        <div className="mb-2 flex items-center justify-between"><p className="m-0 text-xs font-bold tracking-widest text-mute uppercase">Inbox {d ? `· ${d.unread} unread` : ''}</p>
          <button onClick={() => run(api('/api/notifications/read-all', { method: 'POST' }))} disabled={!d?.unread} className="min-h-10 rounded-xl border border-forest px-3 text-sm font-semibold text-forest disabled:opacity-40">Mark all as read</button></div>
        {d === null ? <p className="text-mute">Loading…</p> : d.items.length === 0 ? <p className="text-mute">You are all caught up.</p> : d.items.map((n) => (
          <div key={n.id} className="flex items-start gap-3 border-b border-line py-3 last:border-0">
            <span aria-hidden className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${n.read ? 'bg-line' : 'bg-amber'}`} />
            <div className="flex-1"><b className={n.read ? 'font-semibold text-mute' : ''}>{n.title}</b><p className="my-0.5 text-sm text-mute">{n.body}</p><span className="text-xs text-mute">{n.created.slice(0, 10)}</span></div>
            {!n.read && <button onClick={() => run(api(`/api/notifications/${n.id}/read`, { method: 'POST' }))} className="min-h-10 rounded-xl border border-forest px-3 text-sm font-semibold text-forest">Mark read</button>}
            <button onClick={() => run(api(`/api/notifications/${n.id}`, { method: 'DELETE' }))} className="min-h-10 rounded-xl border border-line px-3 text-sm text-mute">Delete</button>
          </div>
        ))}
      </section>
    </div>
  )
}
