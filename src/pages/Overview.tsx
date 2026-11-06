import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../services/http'
import { useAuth } from '../store/auth'

interface Summary { series: { date: string; v: number; sleep_h: number | null; stress: number | null }[]; moods: number; avg7: number | null; last: { score: number; category: string; created: string } | null; change: number | null }
const card = 'rounded-3xl border border-line bg-white p-6'

export default function Overview() {
  const name = useAuth((s) => s.user?.name.split(' ')[0])
  const [s, setS] = useState<Summary | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { api<Summary>('/api/summary').then(setS).catch((e) => setErr(e.message)) }, [])
  if (err) return <p role="alert" className="text-red-700">{err}</p>
  if (!s) return <p className="text-mute">Loading…</p>
  const sleep = s.series.filter((x) => x.sleep_h != null).map((x) => ({ d: x.date.slice(5), h: x.sleep_h }))
  return (
    <div>
      <h1 className="m-0 text-3xl font-extrabold">Welcome back, {name}!</h1>
      <p className="mt-1 mb-6 text-mute">Everything here comes from your own check-ins and questionnaires.</p>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-3xl bg-gradient-to-br from-forest to-teal p-6 text-white">
          <p className="m-0 text-xs font-bold tracking-widest uppercase opacity-80">Latest screening (PHQ-9)</p>
          {s.last ? <>
            <p className="my-2 text-4xl font-extrabold">{s.last.score} / 27</p>
            <p className="m-0 text-lg font-bold">{s.last.category}</p>
            <p className="mt-2 text-sm opacity-90">{s.last.created.slice(0, 10)}{s.change != null ? ` · ${s.change > 0 ? '+' : ''}${s.change} since the previous one` : ''}. A screening result, not a diagnosis.</p>
          </> : <>
            <p className="my-2 text-lg font-bold">Complete your first assessment to see your wellness insights.</p>
            <Link to="/dashboard/assess" className="inline-flex min-h-11 items-center rounded-xl bg-white px-5 font-semibold text-forest">Start assessment</Link>
          </>}
        </section>
        <section className={card}>
          <p className="m-0 text-xs font-bold tracking-widest text-mute uppercase">Average mood, last 7 days</p>
          {s.avg7 != null ? <p className="my-2 text-4xl font-extrabold">{s.avg7} <span className="text-lg text-mute">/ 5</span></p> : <p className="text-mute">No check-ins in the last 7 days.</p>}
          <Link to="/dashboard/mood" className="font-semibold text-teal">Record today’s mood</Link>
        </section>
        <section className={card}>
          <p className="m-0 text-xs font-bold tracking-widest text-mute uppercase">About these numbers</p>
          <p className="mb-0 text-sm text-mute">No trained prediction model is connected to this backend yet, so no risk percentage is shown. Results are your own entries and PHQ-9 scoring.</p>
        </section>
        <section className={`${card} lg:col-span-2`}>
          <p className="m-0 text-xs font-bold tracking-widest text-mute uppercase">Mood over time</p>
          {s.series.length < 2 ? <p className="text-mute">Save at least two mood check-ins to see a trend.</p> : <div className="h-48"><ResponsiveContainer><LineChart data={s.series.map((x) => ({ d: x.date.slice(5), mood: x.v }))}><CartesianGrid strokeDasharray="3 3" stroke="#E4DDCF" /><XAxis dataKey="d" /><YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} /><Tooltip /><Line dataKey="mood" stroke="#2A6F6B" strokeWidth={3} /></LineChart></ResponsiveContainer></div>}
        </section>
        <section className={card}>
          <p className="m-0 text-xs font-bold tracking-widest text-mute uppercase">Sleep (hours)</p>
          {sleep.length === 0 ? <p className="text-mute">Add sleep hours in a mood check-in.</p> : <div className="h-48"><ResponsiveContainer><BarChart data={sleep}><XAxis dataKey="d" /><YAxis /><Tooltip /><Bar dataKey="h" fill="#2A6F6B" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>}
        </section>
      </div>
    </div>
  )
}
