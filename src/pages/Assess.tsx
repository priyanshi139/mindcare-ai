import { useEffect, useState } from 'react'
import { api } from '../services/http'

const Q = ['Little interest or pleasure in doing things', 'Feeling down, depressed, or hopeless', 'Trouble falling or staying asleep, or sleeping too much', 'Feeling tired or having little energy', 'Poor appetite or overeating', 'Feeling bad about yourself, or that you are a failure or have let yourself or your family down', 'Trouble concentrating on things, such as reading or watching television', 'Moving or speaking so slowly that others could notice, or being so fidgety or restless that you move around a lot more than usual', 'Thoughts that you would be better off dead, or of hurting yourself in some way']
const OPT = ['Not at all', 'Several days', 'More than half the days', 'Nearly every day']
interface Res { score: number; category: string; screen_positive: boolean; item9: boolean }
interface Past { score: number; category: string; created: string }

export default function Assess() {
  const [a, setA] = useState<(number | null)[]>(Array(9).fill(null))
  const [res, setRes] = useState<Res | null>(null)
  const [past, setPast] = useState<Past[]>([])
  const [err, setErr] = useState('')
  const load = () => { api<Past[]>('/api/assessment').then(setPast).catch(() => {}) }
  useEffect(load, [])

  async function submit() {
    if (a.some((x) => x === null)) return setErr('Please answer all 9 questions.')
    setErr('')
    try { setRes(await api<Res>('/api/assessment', { method: 'POST', body: JSON.stringify({ answers: a }) })); load(); window.scrollTo(0, 0) } catch (e) { setErr((e as Error).message) }
  }

  return (
    <div>
      <h1 className="m-0 text-3xl font-extrabold">Screening questionnaire (PHQ-9)</h1>
      <p className="mt-1 mb-6 text-mute">Over the last 2 weeks, how often have you been bothered by the following problems? This is a screening tool, not a diagnosis.</p>
      {res && (
        <section className="mb-4 rounded-3xl bg-gradient-to-br from-forest to-teal p-6 text-white" role="status">
          <p className="m-0 text-xs font-bold tracking-widest uppercase opacity-80">Your result</p>
          <p className="my-2 text-4xl font-extrabold">{res.score} / 27 · {res.category}</p>
          <p className="m-0 text-sm opacity-95">{res.screen_positive ? 'A score of 10 or more is a common screening cut-off. It suggests talking to a doctor or counsellor, who can assess this properly.' : 'This score is below the common screening cut-off of 10. If you are worried about how you feel, talking to someone you trust or a professional is always okay.'}</p>
          {res.item9 && <p className="mt-3 rounded-2xl bg-white p-3 text-sm font-semibold text-ink">You mentioned thoughts of being better off dead or hurting yourself. You deserve support right now. In India, call Tele-MANAS 14416 (free, 24x7) or emergency services at 112, or reach someone you trust.</p>}
        </section>
      )}
      <section className="rounded-3xl border border-line bg-white p-6">
        {Q.map((t, i) => (
          <fieldset key={i} className="m-0 mb-5 border-0 p-0">
            <legend className="mb-2 font-semibold">{i + 1}. {t}</legend>
            <div className="grid gap-2 sm:grid-cols-4">
              {OPT.map((o, v) => <label key={o} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 text-sm ${a[i] === v ? 'border-teal bg-mint' : 'border-line'}`}><input type="radio" name={`q${i}`} checked={a[i] === v} onChange={() => setA(a.map((x, j) => (j === i ? v : x)))} /> {o}</label>)}
            </div>
          </fieldset>
        ))}
        <p role="alert" className="min-h-5 text-sm text-red-700">{err}</p>
        <button onClick={submit} className="min-h-12 rounded-xl bg-forest px-6 font-semibold text-white">Submit and see result</button>
      </section>
      <section className="mt-4 rounded-3xl border border-line bg-white p-6">
        <p className="m-0 mb-2 text-xs font-bold tracking-widest text-mute uppercase">Your history</p>
        {past.length === 0 ? <p className="text-mute">No assessments yet.</p> : past.slice(0, 8).map((p, i) => <div key={i} className="flex justify-between border-b border-line py-2 last:border-0"><span>{p.created.slice(0, 10)}</span><b>{p.score} / 27 · {p.category}</b></div>)}
      </section>
    </div>
  )
}
