import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '../services/http'

interface Grant { id: number; name: string; email: string; role: string; status: string }
const card = 'mb-4 rounded-3xl border border-line bg-white p-6'
const eyebrow = 'm-0 mb-3 text-xs font-bold tracking-widest text-mute uppercase'

export function Sharing() {
  const [d, setD] = useState<{ grants: Grant[]; views: { name: string; created: string }[] } | null>(null)
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const load = useCallback(() => { api<{ grants: Grant[]; views: { name: string; created: string }[] }>('/api/sharing').then(setD).catch((e) => setMsg(e.message)) }, [])
  useEffect(load, [load])

  async function grant(e: FormEvent) {
    e.preventDefault(); setMsg('')
    if (!email.includes('@')) return setMsg('Enter the email of the clinician or caregiver.')
    try { await api('/api/sharing', { method: 'POST', body: JSON.stringify({ email }) }); setEmail(''); setMsg('Access granted.'); load() } catch (x) { setMsg((x as Error).message) }
  }
  const revoke = (id: number) => api(`/api/sharing/${id}`, { method: 'DELETE' }).then(() => { setMsg('Access revoked.'); load() }).catch((x) => setMsg(x.message))

  return (
    <section className={card}>
      <p className={eyebrow}>Share with a doctor or caregiver</p>
      <p className="mt-0 text-sm text-mute">They will see your PHQ-9 scores and your mood, sleep and stress numbers. They will <b>never</b> see your journal text or companion chats. Only accounts authorized by the system administrator can receive access. You can revoke it at any time.</p>
      <form onSubmit={grant} className="flex flex-wrap gap-2">
        <label htmlFor="se" className="sr-only">Email</label>
        <input id="se" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="doctor@example.com" className="min-h-11 min-w-56 flex-1 rounded-xl border border-line px-3" />
        <button className="min-h-11 rounded-xl bg-forest px-5 font-semibold text-white" type="submit">Grant access</button>
      </form>
      <p role="status" className="min-h-5 text-sm text-teal">{msg}</p>
      {d && d.grants.length > 0 && d.grants.map((g) => (
        <div key={g.id} className="flex items-center justify-between gap-3 border-t border-line py-2.5">
          <span><b>{g.name}</b> ({g.role})<br /><span className="text-sm text-mute">{g.email} · {g.status}</span></span>
          {g.status === 'active' && <button onClick={() => revoke(g.id)} className="min-h-10 rounded-xl border border-forest px-3 text-sm font-semibold text-forest">Revoke</button>}
        </div>
      ))}
      {d && d.views.length > 0 && <><p className="mb-1 mt-3 text-sm font-semibold">Recent views of your data</p>{d.views.slice(0, 5).map((v, i) => <p key={i} className="my-0.5 text-sm text-mute">{v.name} · {v.created.slice(0, 16).replace('T', ' ')}</p>)}</>}
    </section>
  )
}
