import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'

const input = 'mt-1.5 block min-h-12 w-full rounded-xl border border-line bg-white px-3 text-base'
async function post(path: string, body: unknown) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const d = await r.json().catch(() => ({}))
  return { ok: r.ok, msg: typeof d.detail === 'string' ? d.detail : r.ok ? (d.message as string) : 'Please check your details.' }
}

export default function Forgot() {
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email')
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function ask(e: FormEvent) {
    e.preventDefault(); setErr('')
    if (!email.includes('@')) return setErr('Enter a valid email.')
    try { const r = await post('/api/auth/forgot', { email }); setMsg(r.msg); setStep('code') } catch { setErr('Cannot reach the backend. Is it running?') }
  }
  async function reset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr('')
    const f = new FormData(e.currentTarget), pw = String(f.get('pw'))
    if (pw.length < 8) return setErr('New password needs at least 8 characters.')
    try { const r = await post('/api/auth/reset', { email, code: String(f.get('code')).trim(), new_password: pw }); if (!r.ok) return setErr(r.msg); setStep('done') } catch { setErr('Cannot reach the backend. Is it running?') }
  }

  return (
    <div className="grid min-h-screen place-items-center p-5">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-7 shadow-sm">
        <Link to="/"><Logo className="mx-auto h-14" /></Link>
        <h1 className="mb-2 mt-4 text-2xl font-extrabold">Reset your password</h1>
        {step === 'email' && <form onSubmit={ask} noValidate>
          <label className="block text-sm font-semibold">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} autoComplete="email" /></label>
          <p role="alert" className="mb-2 mt-2 min-h-5 text-sm text-red-700">{err}</p>
          <button className="min-h-12 w-full rounded-xl bg-forest font-semibold text-white" type="submit">Send reset code</button>
        </form>}
        {step === 'code' && <form onSubmit={reset} noValidate>
          <p className="mt-0 rounded-2xl bg-amber/15 p-3 text-sm">{msg} <b>Development mode:</b> no email is sent. Look in the backend window for a line starting with [DEV].</p>
          <label className="mb-3 block text-sm font-semibold">Reset code<input name="code" className={input} autoComplete="one-time-code" /></label>
          <label className="block text-sm font-semibold">New password (8+ characters)<input name="pw" type="password" className={input} autoComplete="new-password" /></label>
          <p role="alert" className="mb-2 mt-2 min-h-5 text-sm text-red-700">{err}</p>
          <button className="min-h-12 w-full rounded-xl bg-forest font-semibold text-white" type="submit">Set new password</button>
        </form>}
        {step === 'done' && <p role="status" className="text-teal">Your password was changed. <Link to="/login" className="font-semibold underline">Log in</Link></p>}
        <p className="mb-0 mt-4 text-sm"><Link to="/login" className="font-semibold text-teal">Back to log in</Link></p>
      </div>
    </div>
  )
}
