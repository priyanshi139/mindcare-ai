import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/http'

interface Mood { v: number; sleep_h: number | null; stress: number | null; created: string }
interface Goal { id: number; title: string; target: number; progress: number }
interface Past { score: number; category: string; created: string }
const MOODS = ['Low', 'Down', 'Okay', 'Good', 'Great']
const card = 'rounded-3xl border border-line bg-white p-6'
const eyebrow = 'm-0 mb-2 text-xs font-bold tracking-widest text-mute uppercase'

function Monitoring() {
  const [r, setR] = useState<{ status: string; threshold: number; latest: { score: number } | null } | null>(null)
  const [n, setN] = useState<{ title: string; read: number }[] | null>(null)
  const [open, setOpen] = useState(0)
  useEffect(() => { api<typeof r>('/api/risk').then(setR).catch(() => {}); api<{ items: { title: string; read: number }[] }>('/api/notifications').then((d) => setN(d.items)).catch(() => setN([])); api<{ status: string }[]>('/api/alerts').then((a) => setOpen(a.filter((x) => x.status === 'open').length)).catch(() => {}) }, [])
  return (
    <section className={`${card} lg:col-span-3`}>
      <p className={eyebrow}>Monitoring and notifications</p>
      <p className="my-1">{!r || r.status === 'no_data' ? 'No assessments yet, so nothing is being monitored.' : r.status === 'at_or_above' ? `Latest PHQ-9 score ${r.latest!.score} is at or above your threshold of ${r.threshold}.` : `Latest PHQ-9 score ${r.latest!.score} is below your threshold of ${r.threshold}.`} <b>{open} open alert{open === 1 ? '' : 's'}.</b> <Link to="/dashboard/risk" className="font-semibold text-teal">Risk monitoring</Link></p>
      {n && n.slice(0, 3).map((x, i) => <p key={i} className={`my-0.5 text-sm ${x.read ? 'text-mute' : 'font-semibold'}`}>{x.title}</p>)}
      <Link to="/dashboard/notifications" className="text-sm font-semibold text-teal">All notifications</Link>
    </section>
  )
}

export function Extras() {
  const [mood, setMood] = useState<Mood[] | null>(null)
  const [goals, setGoals] = useState<Goal[] | null>(null)
  const [past, setPast] = useState<Past[] | null>(null)
  useEffect(() => { api<Mood[]>('/api/mood').then(setMood).catch(() => setMood([])); api<Goal[]>('/api/goals').then(setGoals).catch(() => setGoals([])); api<Past[]>('/api/assessment').then(setPast).catch(() => setPast([])) }, [])
  const m = mood?.[0]
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <section className={card}>
        <p className={eyebrow}>Latest mood check-in</p>
        {mood === null ? <p className="text-mute">Loading…</p> : !m ? <p className="text-mute">No check-ins yet. <Link to="/dashboard/mood" className="font-semibold text-teal">Record your mood</Link></p> : <>
          <p className="my-1 text-2xl font-extrabold">{MOODS[m.v - 1]}</p>
          <p className="m-0 text-sm text-mute">{m.created.slice(0, 10)}{m.sleep_h != null ? ` · ${m.sleep_h} h sleep` : ''}{m.stress != null ? ` · stress ${m.stress}/5` : ''}</p>
        </>}
      </section>
      <section className={card}>
        <p className={eyebrow}>Wellness goals</p>
        {goals === null ? <p className="text-mute">Loading…</p> : goals.length === 0 ? <p className="text-mute">No goals yet. <Link to="/dashboard/goals" className="font-semibold text-teal">Add a goal</Link></p> : <>
          {goals.slice(0, 3).map((g) => <p key={g.id} className="my-1 text-sm">{g.title}: <b>{g.progress}/{g.target}</b> days</p>)}
          <Link to="/dashboard/goals" className="text-sm font-semibold text-teal">Manage goals</Link>
        </>}
      </section>
      <section className={card}>
        <p className={eyebrow}>Recent assessments</p>
        {past === null ? <p className="text-mute">Loading…</p> : past.length === 0 ? <p className="text-mute">None yet. <Link to="/dashboard/assess" className="font-semibold text-teal">Take the PHQ-9</Link></p> : past.slice(0, 3).map((p, i) => <p key={i} className="my-1 text-sm">{p.created.slice(0, 10)}: <b>{p.score}/27 · {p.category}</b></p>)}
      </section>
      <Monitoring />
      <section className={`${card} lg:col-span-3`}>
        <p className={eyebrow}>Quick actions</p>
        <div className="flex flex-wrap gap-2">
          {[['/dashboard/mood', 'Record mood'], ['/dashboard/assess', 'Take assessment'], ['/dashboard/companion', 'Talk to companion'], ['/dashboard/analytics', 'View analytics'], ['/dashboard/explain', 'See explanations']].map(([to, l]) => <Link key={to} to={to} className="inline-flex min-h-11 items-center rounded-xl border border-forest px-4 font-semibold text-forest">{l}</Link>)}
        </div>
      </section>
    </div>
  )
}
