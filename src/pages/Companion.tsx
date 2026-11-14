import { useEffect, useRef, useState } from 'react'
import { api } from '../services/http'

interface Msg { role: 'user' | 'assistant'; content: string; kind: string }
const STARTERS = [
  ['Mood check-in', 'Can we do a quick mood check-in? I want to talk about how I feel today.'],
  ['Breathing', 'Can you guide me through a calming breathing exercise?'],
  ['Journal prompt', 'Can you give me a journaling prompt for tonight?'],
  ['Sleep', 'I have been sleeping badly. Can you help me think about my sleep routine?'],
  ['Stress', 'I feel stressed and overwhelmed.'],
]
const PHASES: [string, number][] = [['Breathe in', 4], ['Hold', 4], ['Breathe out', 6]]

function Breathing() {
  const [on, setOn] = useState(false)
  const [i, setI] = useState(0)
  const [n, setN] = useState(PHASES[0][1])
  useEffect(() => {
    if (!on) return
    const t = setInterval(() => setN((c) => {
      if (c > 1) return c - 1
      const next = (i + 1) % PHASES.length; setI(next); return PHASES[next][1]
    }), 1000)
    return () => clearInterval(t)
  }, [on, i])
  const start = () => { setI(0); setN(PHASES[0][1]); setOn(true) }
  return (
    <section className="rounded-3xl bg-lav p-6 text-center">
      <p className="m-0 text-xs font-bold tracking-widest uppercase">Guided breathing</p>
      <div className="mx-auto my-4 grid h-28 w-28 place-items-center rounded-full bg-white transition-transform duration-1000" style={{ transform: on && i === 0 ? 'scale(1.25)' : on && i === 2 ? 'scale(0.85)' : 'scale(1)' }}>
        <span className="text-2xl font-extrabold" aria-live="polite">{on ? n : '4·4·6'}</span>
      </div>
      <p className="m-0 mb-3 min-h-6 font-semibold" role="status">{on ? PHASES[i][0] : 'In 4, hold 4, out 6'}</p>
      <button onClick={on ? () => setOn(false) : start} className="min-h-11 rounded-xl bg-forest px-5 font-semibold text-white">{on ? 'Stop' : 'Start'}</button>
    </section>
  )
}

export default function Companion() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [cfg, setCfg] = useState(true)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { api<{ configured: boolean; messages: Msg[] }>('/api/chat').then((d) => { setMsgs(d.messages); setCfg(d.configured) }).catch((e) => setErr(e.message)) }, [])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs, busy])

  async function send(text: string) {
    text = text.trim()
    if (!text || busy) return
    setErr(''); setBusy(true); setInput('')
    setMsgs((m) => [...m, { role: 'user', content: text, kind: 'chat' }])
    try {
      const r = await api<{ reply: string; kind: string }>('/api/chat', { method: 'POST', body: JSON.stringify({ message: text }) })
      setMsgs((m) => [...m, { role: 'assistant', content: r.reply, kind: r.kind }])
    } catch (e) {
      setErr((e as Error).message); setMsgs((m) => m.slice(0, -1)); setInput(text)
    } finally { setBusy(false) }
  }
  async function clear() {
    if (!window.confirm('Clear this whole conversation? This cannot be undone.')) return
    await api('/api/chat', { method: 'DELETE' }); setMsgs([]); setErr('')
  }

  return (
    <div>
      <h1 className="m-0 text-3xl font-extrabold">AI companion</h1>
      <p className="mt-1 mb-4 text-mute">A listen-first space. Saathi is an AI, not a therapist, and cannot diagnose or provide emergency care.</p>
      {!cfg && <p role="status" className="mb-4 rounded-2xl border border-amber bg-amber/15 p-3 text-sm">AI replies are not configured on the backend yet. Set <b>LLM_API_KEY</b> (and optionally LLM_MODEL) where the backend starts, then restart it. Safety messages still work without it.</p>}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="flex h-[32rem] flex-col rounded-3xl border border-line bg-white p-4 lg:col-span-2">
          <div className="flex-1 space-y-2 overflow-y-auto p-1" role="log" aria-live="polite">
            {msgs.length === 0 && !busy && <p className="text-mute">No messages yet. Say hello, or pick a starter below.</p>}
            {msgs.map((m, k) => (
              <div key={k} className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${m.role === 'user' ? 'ml-auto bg-forest text-white' : m.kind === 'safety' ? 'border-2 border-amber bg-amber/15' : 'bg-lav'}`}>
                {m.kind === 'safety' && <b className="block text-sm">Support information</b>}{m.content}
              </div>
            ))}
            {busy && <div className="max-w-[60%] rounded-2xl bg-lav px-4 py-2.5 text-mute">Saathi is typing…</div>}
            <div ref={end} />
          </div>
          {err && <p role="alert" className="my-2 text-sm text-red-700">{err}</p>}
          <div className="my-2 flex flex-wrap gap-2">{STARTERS.map(([l, t]) => <button key={l} onClick={() => send(t)} disabled={busy} className="min-h-10 rounded-full border border-line px-3 text-sm hover:bg-mint disabled:opacity-50">{l}</button>)}</div>
          <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="flex gap-2">
            <label htmlFor="msg" className="sr-only">Message</label>
            <input id="msg" value={input} maxLength={1000} onChange={(e) => setInput(e.target.value)} placeholder="Type how you feel…" autoComplete="off" className="min-h-12 flex-1 rounded-xl border border-line px-3" />
            <button type="submit" disabled={busy || !input.trim()} className="min-h-12 rounded-xl bg-forest px-5 font-semibold text-white disabled:opacity-50">Send</button>
          </form>
        </section>
        <div className="space-y-4">
          <Breathing />
          <section className="rounded-3xl border border-line bg-white p-5 text-sm">
            <p className="m-0 mb-2 text-xs font-bold tracking-widest text-mute uppercase">Good to know</p>
            <p className="mt-0 text-mute">Your messages are stored in your account and sent to the AI provider configured on the backend. If you are in danger, contact Tele-MANAS 14416 or 112.</p>
            <button onClick={clear} className="min-h-11 rounded-xl border border-forest px-4 font-semibold text-forest">Clear conversation</button>
          </section>
        </div>
      </div>
    </div>
  )
}
