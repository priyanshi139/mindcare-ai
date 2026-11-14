import { FormEvent, useCallback, useEffect, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../services/http'
import { Changes, Delta } from '../components/Delta'

interface PRow { id: number; name: string; last: { score: number; category: string; created: string } | null; avg7: number | null }
interface Detail { name: string; can_note: boolean; assessments: { date: string; score: number; category: string }[]; mood: { date: string; v: number; sleep_h: number | null; stress: number | null }[]; changes: Changes; open_alerts: number; notes: { id: number; note: string; created: string }[] }
const card = 'mb-4 rounded-3xl border border-line bg-white p-6'
const eyebrow = 'm-0 mb-2 text-xs font-bold tracking-widest text-mute uppercase'

export default function Patients() {
  const [list, setList] = useState<PRow[] | null>(null)
  const [sel, setSel] = useState<number | null>(null)
  const [d, setD] = useState<Detail | null>(null)
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => { api<PRow[]>('/api/clinic/patients').then(setList).catch((e) => setErr(e.message)) }, [])
  const open = useCallback((id: number) => { setSel(id); setD(null); setErr(''); api<Detail>(`/api/clinic/patients/${id}`).then(setD).catch((e) => setErr(e.message)) }, [])
  async function addNote(e: FormEvent) {
    e.preventDefault()
    if (note.trim().length < 3) return setErr('Write a note of at least 3 characters.')
    try { await api(`/api/clinic/patients/${sel}/notes`, { method: 'POST', body: JSON.stringify({ note }) }); setNote(''); setErr(''); open(sel!) } catch (x) { setErr((x as Error).message) }
  }

  return (
    <div>
      <h1 className="m-0 text-3xl font-extrabold">Shared with me</h1>
      <p className="mt-1 mb-4 text-mute">Only members who gave you access are listed. You see scores and mood, sleep and stress numbers, never journal text or chats. Screening data, not a diagnosis.</p>
      {err && <p role="alert" className="text-red-700">{err}</p>}
      {sel === null ? (
        <section className={card}>
          {list === null ? <p className="text-mute">Loading…</p> : list.length === 0 ? <p className="m-0 text-mute">No one has shared data with you yet. A member can give you access from Profile and privacy by entering your email.</p> : list.map((p) => (
            <button key={p.id} onClick={() => open(p.id)} className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-line py-2 text-left last:border-0">
              <b>{p.name}</b><span className="text-sm text-mute">{p.last ? `Latest PHQ-9 ${p.last.score}/27 (${p.last.category})` : 'No assessment yet'}{p.avg7 != null ? ` · mood ${p.avg7}/5 this week` : ''}</span>
            </button>
          ))}
        </section>
      ) : (
        <div>
          <button onClick={() => { setSel(null); setD(null) }} className="mb-4 min-h-11 rounded-xl border border-forest px-4 font-semibold text-forest">Back to the list</button>
          {!d ? <p className="text-mute">Loading…</p> : <>
            <h2 className="mt-0 text-2xl font-extrabold">{d.name}</h2>
            <section className={card}><p className={eyebrow}>PHQ-9 history · {d.open_alerts} open alert{d.open_alerts === 1 ? '' : 's'}</p>
              {d.assessments.length < 2 ? <p className="m-0 text-mute">{d.assessments.length === 0 ? 'No assessments yet.' : `One assessment: ${d.assessments[0].score}/27 (${d.assessments[0].category}) on ${d.assessments[0].date}.`}</p> : <div className="h-52"><ResponsiveContainer><LineChart data={d.assessments}><CartesianGrid strokeDasharray="3 3" stroke="#E4DDCF" /><XAxis dataKey="date" tickFormatter={(x: string) => x.slice(5)} /><YAxis domain={[0, 27]} /><Tooltip /><Line dataKey="score" stroke="#2A6F6B" strokeWidth={3} /></LineChart></ResponsiveContainer></div>}
            </section>
            <section className={card}><p className={eyebrow}>Last 7 days vs the 7 days before</p><Delta c={d.changes} /></section>
            <section className={card}><p className={eyebrow}>Mood, last entries (1 to 5)</p>
              {d.mood.length < 2 ? <p className="m-0 text-mute">Not enough mood entries to chart.</p> : <div className="h-48"><ResponsiveContainer><LineChart data={d.mood}><CartesianGrid strokeDasharray="3 3" stroke="#E4DDCF" /><XAxis dataKey="date" tickFormatter={(x: string) => x.slice(5)} /><YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} /><Tooltip /><Line dataKey="v" name="mood" stroke="#2A6F6B" strokeWidth={3} /><Line dataKey="stress" stroke="#D9A23B" strokeWidth={2} connectNulls /></LineChart></ResponsiveContainer></div>}
            </section>
            <section className={card}><p className={eyebrow}>Your clinical notes (only you can see these)</p>
              {d.can_note ? <form onSubmit={addNote} className="mb-3 flex flex-wrap gap-2"><label htmlFor="cn" className="sr-only">Note</label><input id="cn" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" className="min-h-11 min-w-56 flex-1 rounded-xl border border-line px-3" /><button className="min-h-11 rounded-xl bg-forest px-5 font-semibold text-white" type="submit">Save note</button></form> : <p className="mt-0 text-sm text-mute">Caregiver accounts are view-only. Only doctors can write notes.</p>}
              {d.notes.length === 0 ? <p className="m-0 text-mute">No notes yet.</p> : d.notes.map((n) => <p key={n.id} className="my-1 text-sm"><b>{n.created}</b> · {n.note}</p>)}
            </section>
          </>}
        </div>
      )}
    </div>
  )
}
