import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/http'
import { roleLabel, useAuth } from '../store/auth'
import { Sharing } from '../components/Sharing'

const card = 'mb-4 rounded-3xl border border-line bg-white p-6'
const eyebrow = 'm-0 mb-3 text-xs font-bold tracking-widest text-mute uppercase'

export default function Profile() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [name, setName] = useState(user?.name ?? '')
  const [msg, setMsg] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [cur, setCur] = useState('')
  const [nw, setNw] = useState('')

  async function save(e: FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) return setMsg('Enter your name.')
    try { const u = await api<NonNullable<typeof user>>('/api/me', { method: 'PATCH', body: JSON.stringify({ name: name.trim() }) }); useAuth.setState({ user: u }); setMsg('Profile saved.') } catch (e) { setMsg((e as Error).message) }
  }
  async function changePw(e: FormEvent) {
    e.preventDefault()
    if (nw.length < 8) return setMsg('New password needs at least 8 characters.')
    try { await api('/api/me/password', { method: 'PUT', body: JSON.stringify({ current: cur, new: nw }) }); setCur(''); setNw(''); setMsg('Password changed.') } catch (x) { setMsg((x as Error).message) }
  }
  async function exportData() {
    try {
      const d = await api<unknown>('/api/export')
      const url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a'); a.href = url; a.download = 'mindcare-my-data.json'; a.click(); URL.revokeObjectURL(url); setMsg('Your data was downloaded.')
    } catch (e) { setMsg((e as Error).message) }
  }
  async function del() {
    setBusy(true)
    try { await api('/api/account', { method: 'DELETE' }); logout(); nav('/') } catch (e) { setMsg((e as Error).message); setBusy(false) }
  }

  return (
    <div>
      <h1 className="m-0 text-3xl font-extrabold">Profile and privacy</h1>
      <p className="mt-1 mb-6 text-mute">Your account, your data, and how it is used.</p>
      <p role="status" className="min-h-5 text-sm text-teal">{msg}</p>
      <section className={card}>
        <p className={eyebrow}>Profile</p>
        <form onSubmit={save} className="grid max-w-md gap-3">
          <label className="text-sm font-semibold">Name<input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 block min-h-11 w-full rounded-xl border border-line px-3" /></label>
          <label className="text-sm font-semibold">Email<input value={user?.email ?? ''} readOnly className="mt-1.5 block min-h-11 w-full rounded-xl border border-line bg-cream px-3" /></label>
          <p className="m-0 text-sm text-mute">Account type: {roleLabel(user?.role)}. Doctor and caregiver accounts require authorization and cannot be self-registered.</p>
          <button className="min-h-11 w-fit rounded-xl bg-forest px-5 font-semibold text-white" type="submit">Save changes</button>
        </form>
      </section>
      {user?.role === 'Patient' && <Sharing />}
      <section className={card}>
        <p className={eyebrow}>Change password</p>
        <form onSubmit={changePw} className="grid max-w-md gap-3">
          <label className="text-sm font-semibold">Current password<input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" className="mt-1.5 block min-h-11 w-full rounded-xl border border-line px-3" /></label>
          <label className="text-sm font-semibold">New password (8+ characters)<input type="password" value={nw} onChange={(e) => setNw(e.target.value)} autoComplete="new-password" className="mt-1.5 block min-h-11 w-full rounded-xl border border-line px-3" /></label>
          <button className="min-h-11 w-fit rounded-xl border border-forest px-5 font-semibold text-forest" type="submit">Change password</button>
        </form>
      </section>
      <section className={card}>
        <p className={eyebrow}>How your data is used</p>
        <ul className="m-0 space-y-1 pl-5 text-sm text-mute">
          <li>Mood, assessment, goal and chat data are stored in the backend database on the computer running this app, linked to your account only.</li>
          <li>AI companion messages are sent to the LLM provider configured on the backend to generate replies. Messages that mention self-harm are not sent to the LLM.</li>
          <li>Nothing is shared with doctors or caregivers unless you grant access above, and you can revoke it any time. This is a research prototype and no regulatory compliance is claimed.</li>
        </ul>
      </section>
      <section className={card}>
        <p className={eyebrow}>Your data</p>
        <button onClick={exportData} className="min-h-11 rounded-xl border border-forest px-5 font-semibold text-forest">Download my data (JSON)</button>
      </section>
      <section className={`${card} border-red-200`}>
        <p className={eyebrow}>Delete account</p>
        <p className="mt-0 text-sm text-mute">This permanently deletes your account and all your mood, assessment, goal and chat data. It cannot be undone. Type DELETE to confirm.</p>
        <div className="flex flex-wrap gap-2">
          <label htmlFor="cf" className="sr-only">Type DELETE</label>
          <input id="cf" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="min-h-11 rounded-xl border border-line px-3" placeholder="DELETE" />
          <button disabled={confirm !== 'DELETE' || busy} onClick={del} className="min-h-11 rounded-xl bg-red-700 px-5 font-semibold text-white disabled:opacity-40">Delete everything</button>
        </div>
      </section>
    </div>
  )
}
