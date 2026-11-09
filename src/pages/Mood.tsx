import { useCallback, useEffect, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../services/http'

interface Entry { id: number; v: number; sleep_h: number | null; stress: number | null; note: string; created: string }
const moods = ['Low', 'Down', 'Okay', 'Good', 'Great']

export default function Mood() {
  const [list, setList] = useState<Entry[] | null>(null)
  const [v, setV] = useState(0)
  const [sleep, setSleep] = useState('')
  const [stress, setStress] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const load = useCallback(() => { api<Entry[]>('/api/mood').then(setList).catch((e) => setMsg(e.message)) }, [])
  useEffect(load, [load])

  async function save() {
    if (!v) return setMsg('Pick a mood first.')
    if (sleep && (+sleep < 0 || +sleep > 24)) return setMsg('Sleep must be between 0 and 24 hours.')
    try {
      await api(editId ? `/api/mood/${editId}` : '/api/mood', { method: editId ? 'PATCH' : 'POST', body: JSON.stringify({ v, sleep_h: sleep ? +sleep : null, stress: stress ? +stress : null, note }) })
      setV(0); setSleep(''); setStress(''); setNote(''); setMsg(editId ? 'Entry updated.' : 'Check-in saved. Your dashboard has been updated.'); setEditId(null); load()
    } catch (e) { setMsg((e as Error).message) }
  }
  function edit(e: Entry) { setEditId(e.id); setV(e.v); setSleep(e.sleep_h != null ? String(e.sleep_h) : ''); setStress(e.stress != null ? String(e.stress) : ''); setNote(e.note); setMsg('Editing an entry.'); window.scrollTo(0, 0) }
  function cancel() { setEditId(null); setV(0); setSleep(''); setStress(''); setNote(''); setMsg('') }
  async function del(id: number) { await api(`/api/mood/${id}`, { method: 'DELETE' }); load() }

  const chart = [...(list ?? [])].reverse().map((e) => ({ d: e.created.slice(5, 10), mood: e.v }))
  return (
    <div>
      <h1 className="m-0 text-3xl font-extrabold">Mood tracking</h1>
      <p className="mt-1 mb-6 text-mute">Your entries are stored in your own account and feed your dashboard.</p>
      <section className="rounded-3xl border border-line bg-white p-6">
        <div className="grid grid-cols-5 gap-2" role="group" aria-label="Mood">
          {moods.map((m, i) => <button key={m} type="button" aria-pressed={v === i + 1} onClick={() => setV(i + 1)} className={`min-h-16 rounded-2xl border-2 font-semibold ${v === i + 1 ? 'border-teal bg-mint' : 'border-line bg-white'}`}>{m}</button>)}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">Sleep last night (hours, optional)<input type="number" min="0" max="24" step="0.5" value={sleep} onChange={(e) => setSleep(e.target.value)} className="mt-1.5 block min-h-11 w-full rounded-xl border border-line px-3" /></label>
          <label className="text-sm font-semibold">Stress (1 low to 5 high, optional)<select value={stress} onChange={(e) => setStress(e.target.value)} className="mt-1.5 block min-h-11 w-full rounded-xl border border-line px-3"><option value="">Skip</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></label>
        </div>
        <label className="mt-3 block text-sm font-semibold" htmlFor="note">Journal (optional)</label>
        <textarea id="note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1.5 w-full rounded-xl border border-line p-3" />
        <div className="mt-3 flex flex-wrap items-center gap-3"><button onClick={save} className="min-h-11 rounded-xl bg-forest px-5 font-semibold text-white">{editId ? 'Update entry' : 'Save check-in'}</button>{editId && <button onClick={cancel} className="min-h-11 rounded-xl border border-line px-4 text-mute">Cancel</button>}<span role="status" className="text-sm text-mute">{msg}</span></div>
      </section>
      <section className="mt-4 rounded-3xl border border-line bg-white p-6">
        <p className="m-0 mb-2 text-xs font-bold tracking-widest text-mute uppercase">Mood trend</p>
        {chart.length < 2 ? <p className="text-mute">Save at least two check-ins to see a trend.</p> : <div className="h-48"><ResponsiveContainer><LineChart data={chart}><CartesianGrid strokeDasharray="3 3" stroke="#E4DDCF" /><XAxis dataKey="d" /><YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} /><Tooltip /><Line dataKey="mood" stroke="#2A6F6B" strokeWidth={3} /></LineChart></ResponsiveContainer></div>}
      </section>
      <section className="mt-4 rounded-3xl border border-line bg-white p-6">
        <p className="m-0 mb-2 text-xs font-bold tracking-widest text-mute uppercase">History</p>
        {list === null ? <p className="text-mute">Loading…</p> : list.length === 0 ? <p className="text-mute">No check-ins yet.</p> : list.slice(0, 10).map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0">
            <span>{e.created.slice(0, 10)} · {moods[e.v - 1]}{e.sleep_h != null ? ` · ${e.sleep_h} h sleep` : ''}{e.stress != null ? ` · stress ${e.stress}` : ''}<span className="block text-sm text-mute">{e.note}</span></span>
            <span className="flex gap-2"><button onClick={() => edit(e)} className="min-h-10 rounded-xl border border-forest px-3 text-sm font-semibold text-forest">Edit</button><button onClick={() => del(e.id)} className="min-h-10 rounded-xl border border-line px-3 text-sm text-mute" aria-label="Delete entry">Delete</button></span>
          </div>
        ))}
      </section>
    </div>
  )
}
