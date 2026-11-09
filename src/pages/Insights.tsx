import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/http'

interface Item { category: string; title: string; text: string; link: string | null }
const HYGIENE = ['Keep a similar bedtime and wake time, even on weekends.', 'Avoid screens and bright light in the last hour before bed.', 'Keep caffeine for the morning and the room cool and dark.', 'If you cannot sleep after about 20 minutes, get up and do something calm until you feel sleepy.']
const ACTIVITY = ['A 10 minute walk counts. Start there.', 'Stretch for 5 minutes after waking up.', 'Walk while talking to a friend on the phone.']
const card = 'mb-4 rounded-3xl border border-line bg-white p-6'
const eyebrow = 'm-0 mb-2 text-xs font-bold tracking-widest text-mute uppercase'

export default function Insights() {
  const [d, setD] = useState<{ items: Item[]; prompts: string[] } | null>(null)
  const [err, setErr] = useState('')
  const [pi, setPi] = useState(0)
  useEffect(() => { api<{ items: Item[]; prompts: string[] }>('/api/insights').then(setD).catch((e) => setErr(e.message)) }, [])
  return (
    <div>
      <h1 className="m-0 text-3xl font-extrabold">Wellness insights</h1>
      <p className="mt-1 mb-6 text-mute">Simple rule-based suggestions from your own check-ins, assessments and goals. They are not medical advice or treatment.</p>
      {err && <p role="alert" className="text-red-700">{err}</p>}
      <section className={card}>
        <p className={eyebrow}>For you right now (rule-based)</p>
        {!d ? <p className="text-mute">Loading…</p> : d.items.length === 0 ? <p className="m-0 text-mute">Nothing to flag. Keep going with your check-ins.</p> : d.items.map((i, k) => (
          <div key={k} className="border-b border-line py-3 last:border-0">
            <span className="rounded-full bg-lav px-2.5 py-0.5 text-xs font-semibold">{i.category}</span>
            <p className="my-1 font-semibold">{i.title}</p><p className="m-0 text-sm text-mute">{i.text}</p>
            {i.link && <Link to={i.link} className="text-sm font-semibold text-teal">Open</Link>}
          </div>
        ))}
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <section className={card}>
          <p className={eyebrow}>Journaling prompt</p>
          <p className="mt-0 text-lg font-semibold">{d ? d.prompts[pi % d.prompts.length] : '…'}</p>
          <button onClick={() => setPi(pi + 1)} className="min-h-11 rounded-xl border border-forest px-4 font-semibold text-forest">Another prompt</button>
          <Link to="/dashboard/mood" className="ml-3 text-sm font-semibold text-teal">Write it in a check-in</Link>
        </section>
        <section className={card}><p className={eyebrow}>Breathing</p><p className="mt-0 text-sm text-mute">Slow breathing (in 4, hold 4, out 6) can calm a racing mind. There is a guided version in the AI companion.</p><Link to="/dashboard/companion" className="font-semibold text-teal">Open the guided exercise</Link></section>
        <section className={card}><p className={eyebrow}>Sleep hygiene</p><ul className="m-0 space-y-1 pl-5 text-sm text-mute">{HYGIENE.map((h) => <li key={h}>{h}</li>)}</ul></section>
        <section className={card}><p className={eyebrow}>Activity ideas</p><ul className="m-0 space-y-1 pl-5 text-sm text-mute">{ACTIVITY.map((h) => <li key={h}>{h}</li>)}</ul></section>
      </div>
    </div>
  )
}
