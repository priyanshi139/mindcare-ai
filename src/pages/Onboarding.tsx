import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { api } from '../services/http'
import { useAuth } from '../store/auth'

const FOCUS = ['Mood', 'Sleep', 'Stress', 'Goals']
const GOALS = ['Go to bed at a regular time', 'Walk for 20 minutes', 'Write in my journal', 'Call a friend or family member']
const STEPS = ['Welcome', 'Your focus', 'Reminders and a first goal']

export default function Onboarding() {
  const nav = useNavigate()
  const name = useAuth((s) => s.user?.name.split(' ')[0])
  const [step, setStep] = useState(0)
  const [consent, setConsent] = useState(false)
  const [focus, setFocus] = useState<string[]>([])
  const [rem, setRem] = useState(true)
  const [goal, setGoal] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  function next() {
    if (step === 0 && !consent) return setErr('Please tick the box to continue.')
    setErr(''); setStep(step + 1)
  }
  async function finish() {
    setBusy(true); setErr('')
    try {
      await api('/api/onboarding', { method: 'PUT', body: JSON.stringify({ consent, focus }) })
      const s = await api<{ alert_threshold: number }>('/api/settings')
      await api('/api/settings', { method: 'PUT', body: JSON.stringify({ alert_threshold: s.alert_threshold, reminders: rem }) })
      if (goal) await api('/api/goals', { method: 'POST', body: JSON.stringify({ title: goal, target: 7 }) })
      nav('/dashboard')
    } catch (e) { setErr((e as Error).message); setBusy(false) }
  }

  return (
    <div className="grid min-h-screen place-items-center p-5">
      <div className="w-full max-w-lg rounded-3xl border border-line bg-white p-7 shadow-sm">
        <Logo className="mx-auto h-14" />
        <div className="mt-4 h-2 rounded-full bg-line" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={3}><div className="h-2 rounded-full bg-teal" style={{ width: `${((step + 1) / 3) * 100}%` }} /></div>
        <p className="mb-1 mt-3 text-xs font-bold tracking-widest text-mute uppercase">Step {step + 1} of 3 · {STEPS[step]}</p>
        {step === 0 && <>
          <h1 className="mb-2 mt-1 text-2xl font-extrabold">Welcome, {name}</h1>
          <p className="mt-0 text-mute">MindCare AI helps you notice patterns in your mood, sleep and stress, and take a PHQ-9 screening questionnaire. It is a research prototype. It does not diagnose, prescribe, or replace a doctor or counsellor. If you are in danger, contact Tele-MANAS 14416 or emergency services 112.</p>
          <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5" /> I understand this, and I agree that my entries are stored in my account. Companion messages are sent to an AI provider to generate replies.</label>
        </>}
        {step === 1 && <>
          <h1 className="mb-2 mt-1 text-2xl font-extrabold">What would you like help with?</h1>
          <p className="mt-0 text-mute">Optional. Pick any. Your suggestions will start with these.</p>
          <div className="flex flex-wrap gap-2">{FOCUS.map((f) => <button key={f} type="button" aria-pressed={focus.includes(f)} onClick={() => setFocus(focus.includes(f) ? focus.filter((x) => x !== f) : [...focus, f])} className={`min-h-11 rounded-full border-2 px-5 font-semibold ${focus.includes(f) ? 'border-teal bg-mint' : 'border-line'}`}>{f}</button>)}</div>
        </>}
        {step === 2 && <>
          <h1 className="mb-2 mt-1 text-2xl font-extrabold">Almost done</h1>
          <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={rem} onChange={(e) => setRem(e.target.checked)} className="h-5 w-5" /> Remind me to log my mood if I forget for 2 days</label>
          <p className="mb-2 mt-4 font-semibold">Start with one small goal (optional)</p>
          <div className="flex flex-wrap gap-2">{GOALS.map((g) => <button key={g} type="button" aria-pressed={goal === g} onClick={() => setGoal(goal === g ? '' : g)} className={`min-h-10 rounded-full border-2 px-4 text-sm ${goal === g ? 'border-teal bg-mint' : 'border-line'}`}>{g}</button>)}</div>
        </>}
        <p role="alert" className="mb-0 mt-3 min-h-5 text-sm text-red-700">{err}</p>
        <div className="mt-3 flex gap-2">
          {step > 0 && <button onClick={() => setStep(step - 1)} className="min-h-11 rounded-xl border border-forest px-5 font-semibold text-forest">Back</button>}
          {step < 2 ? <button onClick={next} className="ml-auto min-h-11 rounded-xl bg-forest px-6 font-semibold text-white">Next</button> : <button disabled={busy} onClick={finish} className="ml-auto min-h-11 rounded-xl bg-forest px-6 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Go to my dashboard'}</button>}
        </div>
      </div>
    </div>
  )
}
