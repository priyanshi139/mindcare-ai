import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '../services/http'

interface Goal { id: number; title: string; target: number; progress: number }
const SUGGESTIONS = ['Walk for 20 minutes', 'Go to bed at a regular time', 'Write in my journal', 'Call a friend or family member']

export default function Goals() {
  const [goals, setGoals] = useState<Goal[] | null>(null)
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState(7)
  const [err, setErr] = useState('')
  const load = useCallback(() => { api<Goal[]>('/api/goals').then(setGoals).catch((e) => setErr(e.message)) }, [])
  useEffect(load, [load])
  const run = (p: Promise<unknown>) => p.then(load).catch((e) => setErr(e.message))
  function add(e: FormEvent) {
    e.preventDefault(); setErr('')
    if (title.trim().length < 3) return setErr('Describe your goal in at least 3 characters.')
    run(api('/api/goals', { method: 'POST', body: JSON.stringify({ title: title.trim(), target }) })).then(() => setTitle(''))
  }
  const done = goals?.filter((g) => g.progress >= g.target).length ?? 0
  return (
    <div>
      <h1 className="m-0 text-3xl font-extrabold">Wellness goals</h1>
      <p className="mt-1 mb-6 text-mute">Small, optional steps. Tap “+1 day” each day you do it. These are suggestions, not medical advice.</p>
      <section className="mb-4 rounded-3xl border border-line bg-white p-6">
        <form onSubmit={add} className="flex flex-wrap gap-2">
          <label htmlFor="gt" className="sr-only">New goal</label>
          <input id="gt" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Add a goal, e.g. Walk for 20 minutes" className="min-h-12 min-w-56 flex-1 rounded-xl border border-line px-3" />
          <label htmlFor="gd" className="sr-only">Days</label>
          <select id="gd" value={target} onChange={(e) => setTarget(+e.target.value)} className="min-h-12 rounded-xl border border-line px-3">{[3, 5, 7, 14, 21, 30].map((n) => <option key={n} value={n}>{n} days</option>)}</select>
          <button className="min-h-12 rounded-xl bg-forest px-5 font-semibold text-white" type="submit">Add goal</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">{SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => setTitle(s)} className="min-h-10 rounded-full border border-line px-3 text-sm hover:bg-mint">{s}</button>)}</div>
        <p role="alert" className="mb-0 mt-2 min-h-5 text-sm text-red-700">{err}</p>
      </section>
      <section className="rounded-3xl border border-line bg-white p-6">
        <p className="m-0 mb-2 text-xs font-bold tracking-widest text-mute uppercase">Your goals {goals ? `· ${done} of ${goals.length} complete` : ''}</p>
        {goals === null ? <p className="text-mute">Loading…</p> : goals.length === 0 ? <p className="text-mute">No goals yet. Add one above to get started.</p> : goals.map((g) => (
          <div key={g.id} className="flex flex-wrap items-center gap-3 border-b border-line py-3 last:border-0">
            <div className="min-w-48 flex-1">
              <b className={g.progress >= g.target ? 'line-through opacity-60' : ''}>{g.title}</b>
              <div className="mt-1.5 h-2.5 rounded-full bg-line" role="progressbar" aria-valuenow={g.progress} aria-valuemin={0} aria-valuemax={g.target}><div className="h-2.5 rounded-full bg-teal" style={{ width: `${(g.progress / g.target) * 100}%` }} /></div>
              <span className="text-sm text-mute">{g.progress >= g.target ? 'Completed' : `${g.progress} of ${g.target} days`}</span>
            </div>
            <button disabled={g.progress >= g.target} onClick={() => run(api(`/api/goals/${g.id}/progress`, { method: 'POST' }))} className="min-h-10 rounded-xl border border-forest px-3 font-semibold text-forest disabled:opacity-40">+1 day</button>
            <button onClick={() => { if (window.confirm('Delete this goal?')) run(api(`/api/goals/${g.id}`, { method: 'DELETE' })) }} className="min-h-10 rounded-xl border border-line px-3 text-mute">Delete</button>
          </div>
        ))}
      </section>
    </div>
  )
}
