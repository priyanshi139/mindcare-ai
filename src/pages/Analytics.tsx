import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../services/http'
import { Changes, Delta } from '../components/Delta'

type View = 'daily' | 'weekly' | 'monthly'
interface Pt { label: string; mood: number | null; sleep: number | null; stress: number | null; n: number }
const card = 'mb-4 rounded-3xl border border-line bg-white p-6'
const VIEWS: [View, string, string][] = [['daily', 'Daily', 'last 30 days'], ['weekly', 'Weekly', 'last 8 weeks'], ['monthly', 'Monthly', 'last 12 months']]

export default function Analytics() {
  const [view, setView] = useState<View>('weekly')
  const [d, setD] = useState<{ points: Pt[]; changes: Changes } | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { setD(null); api<{ points: Pt[]; changes: Changes }>(`/api/analytics?view=${view}`).then(setD).catch((e) => setErr(e.message)) }, [view])
  const meta = VIEWS.find((v) => v[0] === view)!
  const data = d?.points.map((p) => ({ ...p, l: view === 'monthly' ? p.label : p.label.slice(5) })) ?? []
  return (
    <div>
      <h1 className="m-0 text-3xl font-extrabold">Behavioral analytics</h1>
      <p className="mt-1 mb-4 text-mute">Built only from your own mood check-ins, compared with your own earlier days.</p>
      <div className="mb-4 flex gap-2" role="group" aria-label="Time range">
        {VIEWS.map(([v, l]) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={`min-h-11 rounded-xl border-2 px-5 font-semibold ${view === v ? 'border-teal bg-mint' : 'border-line bg-white'}`}>{l}</button>)}
      </div>
      {err && <p role="alert" className="text-red-700">{err}</p>}
      {!d ? <p className="text-mute">Loading…</p> : <>
        <section className={card}><p className="m-0 mb-3 text-xs font-bold tracking-widest text-mute uppercase">This week vs last week</p><Delta c={d.changes} /></section>
        {data.length < 2 ? (
          <section className={card}><p className="m-0 text-mute">The {meta[1].toLowerCase()} view ({meta[2]}) needs check-ins on at least two different {view === 'daily' ? 'days' : view === 'weekly' ? 'weeks' : 'months'}. <Link to="/dashboard/mood" className="font-semibold text-teal">Add a check-in</Link> (with sleep and stress), or <Link to="/dashboard/upload" className="font-semibold text-teal">import past entries</Link>.</p></section>
        ) : <>
          <section className={card}>
            <p className="m-0 mb-2 text-xs font-bold tracking-widest text-mute uppercase">{meta[1]} average: mood and stress (1 to 5) · {meta[2]}</p>
            <div className="h-56"><ResponsiveContainer><LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#E4DDCF" /><XAxis dataKey="l" /><YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} /><Tooltip /><Legend /><Line dataKey="mood" stroke="#2A6F6B" strokeWidth={3} connectNulls /><Line dataKey="stress" stroke="#D9A23B" strokeWidth={3} connectNulls /></LineChart></ResponsiveContainer></div>
          </section>
          <section className={card}>
            <p className="m-0 mb-2 text-xs font-bold tracking-widest text-mute uppercase">{meta[1]} average sleep (hours)</p>
            <div className="h-48"><ResponsiveContainer><LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#E4DDCF" /><XAxis dataKey="l" /><YAxis /><Tooltip /><Line dataKey="sleep" stroke="#1F4D3F" strokeWidth={3} connectNulls /></LineChart></ResponsiveContainer></div>
          </section>
        </>}
      </>}
    </div>
  )
}
