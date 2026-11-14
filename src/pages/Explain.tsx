import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../services/http'
import { explainService } from '../services/api'
import { Changes, Delta } from '../components/Delta'

interface Ex { assessment: { score: number; category: string; created: string; items: { name: string; value: number }[] } | null; changes: Changes }
type Row = { name: string; value: number; context: boolean }
const card = 'rounded-3xl border border-line bg-white p-6 mb-4'
const eyebrow = 'm-0 mb-2 text-xs font-bold tracking-widest text-mute uppercase'

export default function Explain() {
  const [ex, setEx] = useState<Ex | null>(null)
  const [err, setErr] = useState('')
  const [shap, setShap] = useState<Row[]>([])
  useEffect(() => { api<Ex>('/api/explain').then(setEx).catch((e) => setErr(e.message)); explainService.global().then(setShap) }, [])
  const a = ex?.assessment
  return (
    <div>
      <h1 className="m-0 text-3xl font-extrabold">Explainable AI</h1>
      <p className="mt-1 mb-6 text-mute">What shaped your results, in your own data. Explanations describe what contributed, not what causes depression.</p>
      {err && <p role="alert" className="text-red-700">{err}</p>}
      <section className={card}>
        <p className={eyebrow}>Your latest assessment: what contributed (exact, from your answers)</p>
        {!ex ? <p className="text-mute">Loading…</p> : !a ? <p className="text-mute">Complete your first assessment to see which answers made up your score. <Link to="/dashboard/assess" className="font-semibold text-teal">Start assessment</Link></p> : <>
          <p className="mt-0 font-semibold">Score {a.score} / 27 ({a.category}) on {a.created.slice(0, 10)}. The score is the sum of the 9 answers, so each bar is that question’s exact share.</p>
          <div className="h-80"><ResponsiveContainer><BarChart data={a.items} layout="vertical" margin={{ left: 30 }}><XAxis type="number" domain={[0, 3]} ticks={[0, 1, 2, 3]} /><YAxis type="category" dataKey="name" width={190} /><Tooltip /><Bar dataKey="value" name="Answer (0 to 3)" fill="#2A6F6B" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer></div>
        </>}
      </section>
      <section className={card}>
        <p className={eyebrow}>Your last 7 days compared with the 7 days before</p>
        {ex ? <Delta c={ex.changes} /> : <p className="text-mute">Loading…</p>}
      </section>
      <section className={card}>
        <p className={eyebrow}>Key factors the AI monitors (Research Insights)</p>
        <p className="mt-0 text-sm text-mute">What lifestyle and behavioral signals have the strongest impact on mental wellness predictions? Across clinical research datasets, the AI finds that sleep regularities and daily movement are the biggest protective factors.</p>
        <div className="h-72"><ResponsiveContainer><BarChart data={shap} layout="vertical" margin={{ left: 30 }}><XAxis type="number" /><YAxis type="category" dataKey="name" width={170} /><Tooltip /><Bar dataKey="value" name="Impact Strength (SHAP)" radius={[0, 8, 8, 0]}>{shap.map((r) => <Cell key={r.name} fill={r.context ? '#D9A23B' : '#2A6F6B'} />)}</Bar></BarChart></ResponsiveContainer></div>
        <p className="mb-0 text-xs text-mute">Teal bars: Daily lifestyle habits (sleep, activity). Amber bars: Baseline screening context.</p>
      </section>
    </div>
  )
}
