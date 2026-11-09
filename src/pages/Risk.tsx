import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../services/http'

interface Risk { threshold: number; status: 'no_data' | 'below' | 'at_or_above'; latest: { score: number; category: string; date: string } | null; change: number | null; safety: boolean; history: { date: string; score: number }[] }
interface Alert { id: number; kind: string; title: string; detail: string; status: string; created: string }
const card = 'mb-4 rounded-3xl border border-line bg-white p-6'
const eyebrow = 'm-0 mb-2 text-xs font-bold tracking-widest text-mute uppercase'

export default function RiskPage() {
  const [r, setR] = useState<Risk | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [reminders, setReminders] = useState(true)
  const [th, setTh] = useState(10)
  const [msg, setMsg] = useState('')
  const load = useCallback(() => {
    api<Risk>('/api/risk').then((x) => { setR(x); setTh(x.threshold) }).catch((e) => setMsg(e.message))
    api<Alert[]>('/api/alerts').then(setAlerts).catch(() => {})
    api<{ reminders: boolean }>('/api/settings').then((s) => setReminders(s.reminders)).catch(() => {})
  }, [])
  useEffect(load, [load])

  async function saveTh() {
    if (!Number.isInteger(th) || th < 5 || th > 27) return setMsg('Threshold must be a whole number from 5 to 27.')
    try { await api('/api/settings', { method: 'PUT', body: JSON.stringify({ alert_threshold: th, reminders }) }); setMsg('Threshold saved.'); load() } catch (e) { setMsg((e as Error).message) }
  }
  const act = (id: number, a: 'acknowledge' | 'dismiss') => api(`/api/alerts/${id}/${a}`, { method: 'POST' }).then(load).catch((e) => setMsg(e.message))
  const open = alerts.filter((a) => a.status === 'open')
  const done = alerts.filter((a) => a.status !== 'open')

  return (
    <div>
      <h1 className="m-0 text-3xl font-extrabold">Risk monitoring</h1>
      <p className="mt-1 mb-6 text-mute">Assessment-based monitoring from your own PHQ-9 results. It is a screening signal, not a prediction and not a diagnosis. No trained ML model is used here.</p>
      <p role="status" className="min-h-5 text-sm text-teal">{msg}</p>
      <section className={card}>
        <p className={eyebrow}>Current status</p>
        {!r ? <p className="text-mute">Loading…</p> : r.status === 'no_data' ? <p className="m-0 text-mute">No assessments yet. <Link to="/dashboard/assess" className="font-semibold text-teal">Take the PHQ-9</Link> to start monitoring.</p> : <>
          <p className="my-1 text-3xl font-extrabold">{r.latest!.score} / 27 <span className="text-lg font-semibold text-mute">· {r.latest!.category}</span></p>
          <p className="m-0">{r.status === 'at_or_above' ? `Your latest score is at or above your alert threshold of ${r.threshold}. Consider talking to a doctor or counsellor, who can assess this properly.` : `Your latest score is below your alert threshold of ${r.threshold}.`}{r.change != null ? ` It changed by ${r.change > 0 ? '+' : ''}${r.change} since the previous assessment.` : ''} <span className="text-mute">({r.latest!.date})</span></p>
        </>}
      </section>
      {r && r.history.length >= 2 && (
        <section className={card}>
          <p className={eyebrow}>Assessment history</p>
          <div className="h-56"><ResponsiveContainer><LineChart data={r.history.map((h) => ({ d: h.date.slice(5), score: h.score }))}><CartesianGrid strokeDasharray="3 3" stroke="#E4DDCF" /><XAxis dataKey="d" /><YAxis domain={[0, 27]} /><Tooltip /><ReferenceLine y={r.threshold} stroke="#D9A23B" strokeDasharray="5 4" label="Your threshold" /><Line dataKey="score" stroke="#2A6F6B" strokeWidth={3} /></LineChart></ResponsiveContainer></div>
        </section>
      )}
      <section className={card}>
        <p className={eyebrow}>Alert threshold</p>
        <p className="mt-0 text-sm text-mute">You get an alert when a PHQ-9 score reaches this number. 10 is the common screening cut-off. You can change it (5 to 27).</p>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="th" className="sr-only">Threshold</label>
          <input id="th" type="number" min={5} max={27} value={th} onChange={(e) => setTh(+e.target.value)} className="min-h-11 w-24 rounded-xl border border-line px-3" />
          <button onClick={saveTh} className="min-h-11 rounded-xl bg-forest px-5 font-semibold text-white">Save threshold</button>
        </div>
      </section>
      <section className={card}>
        <p className={eyebrow}>Open alerts ({open.length})</p>
        {open.length === 0 ? <p className="m-0 text-mute">No open alerts.</p> : open.map((a) => (
          <div key={a.id} className={`mb-3 rounded-2xl p-4 ${a.kind === 'safety' ? 'border-2 border-amber bg-amber/15' : 'bg-cream'}`}>
            <b>{a.title}</b><p className="my-1 text-sm">{a.detail}</p><p className="m-0 text-xs text-mute">{a.created.slice(0, 10)}</p>
            <div className="mt-2 flex gap-2"><button onClick={() => act(a.id, 'acknowledge')} className="min-h-10 rounded-xl border border-forest px-3 text-sm font-semibold text-forest">Acknowledge</button><button onClick={() => act(a.id, 'dismiss')} className="min-h-10 rounded-xl border border-line px-3 text-sm text-mute">Dismiss</button></div>
          </div>
        ))}
      </section>
      {done.length > 0 && <section className={card}><p className={eyebrow}>Alert history</p>{done.map((a) => <p key={a.id} className="my-1 text-sm"><b>{a.title}</b> · {a.status} · {a.created.slice(0, 10)}</p>)}</section>}
    </div>
  )
}
