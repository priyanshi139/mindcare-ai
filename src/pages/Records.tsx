import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/http'

interface Res { resourceType: string; id: string; effectiveDateTime?: string; valueInteger?: number; interpretation?: { text: string }[]; name?: { text: string }[] }
interface Bundle { entry: { resource: Res }[] }
const card = 'mb-4 rounded-3xl border border-line bg-white p-6'
const eyebrow = 'm-0 mb-2 text-xs font-bold tracking-widest text-mute uppercase'

export default function Records() {
  const [b, setB] = useState<Bundle | null>(null)
  const [ok, setOk] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { api<Bundle>('/api/fhir').then(setB).catch((e) => setErr(e.message)) }, [])
  const obs = b?.entry.map((e) => e.resource).filter((r) => r.resourceType === 'Observation') ?? []
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(b, null, 2)], { type: 'application/fhir+json' }))
    const a = document.createElement('a'); a.href = url; a.download = 'mindcare-phq9-fhir-bundle.json'; a.click(); URL.revokeObjectURL(url)
  }
  return (
    <div>
      <h1 className="m-0 text-3xl font-extrabold">Health records</h1>
      <p className="mt-1 mb-6 text-mute">A prototype that turns your own PHQ-9 results into standard FHIR format. It is not connected to any hospital or EHR, and nothing is sent anywhere.</p>
      {err && <p role="alert" className="text-red-700">{err}</p>}
      <section className={card}>
        <p className={eyebrow}>Your PHQ-9 results as FHIR Observations</p>
        {!b ? <p className="text-mute">Loading…</p> : obs.length === 0 ? <p className="m-0 text-mute">No assessments yet. <Link to="/dashboard/assess" className="font-semibold text-teal">Take the PHQ-9</Link> to create your first record.</p> : obs.map((o) => (
          <p key={o.id} className="my-1.5 text-sm"><b>{o.effectiveDateTime?.slice(0, 10)}</b> · PHQ-9 total score <b>{o.valueInteger}</b> ({o.interpretation?.[0]?.text}) · <span className="text-mute">LOINC 44261-6</span></p>
        ))}
      </section>
      <section className={card}>
        <p className={eyebrow}>Export with consent</p>
        <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-1 h-5 w-5" /> I understand this file contains my name and PHQ-9 results, and I choose to download it. I will decide myself whether to share it with a clinician.</label>
        <button disabled={!ok || !b} onClick={download} className="mt-2 min-h-11 rounded-xl bg-forest px-5 font-semibold text-white disabled:opacity-40">Download FHIR bundle (JSON)</button>
        <p className="mb-0 mt-3 text-sm text-mute">The bundle is marked as prototype and not for clinical use. A clinician must review any result. No diagnosis is made by this app.</p>
      </section>
      <section className={card}>
        <p className={eyebrow}>What is real and what is not</p>
        <p className="m-0 text-sm text-mute">Real: the bundle is generated from your stored results using the FHIR R4 Patient and Observation structure. Not implemented: connection to hospital systems, importing outside records, and clinician approval workflows.</p>
      </section>
    </div>
  )
}
