import { ChangeEvent, useCallback, useEffect, useState } from 'react'
import { api } from '../services/http'

type Row = Record<string, string>
interface Result { imported: number; skipped_count: number; skipped: { row: number; reason: string }[] }
interface Hist { filename: string; source: string; imported: number; skipped: number; created: string }
const SAMPLE = 'date,mood,sleep_hours,stress,note\n2026-10-01,3,7,2,ok day\n2026-10-02,2,5.5,4,tired'
const SOURCES = [['Apple Health', 'Needs an iOS app with HealthKit access'], ['Fitbit', 'Needs a Fitbit developer app and OAuth credentials'], ['Google Health Connect', 'Needs an Android app with Health Connect permissions'], ['Smartwatch', 'Depends on the vendor; most offer a CSV export']]
const card = 'mb-4 rounded-3xl border border-line bg-white p-6'
const eyebrow = 'm-0 mb-2 text-xs font-bold tracking-widest text-mute uppercase'

function splitCsv(line: string) {
  const out: string[] = []; let cur = '', q = false
  for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = '' } else cur += ch }
  out.push(cur); return out.map((s) => s.trim())
}
function parse(name: string, text: string): Row[] {
  if (name.toLowerCase().endsWith('.json')) {
    const j = JSON.parse(text); if (!Array.isArray(j) || j.some((x) => typeof x !== 'object' || x === null)) throw new Error('JSON must be an array of objects.')
    return j.map((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), String(v ?? '')])))
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim()); if (lines.length < 2) throw new Error('The file needs a header row and at least one data row.')
  const head = splitCsv(lines[0]).map((h) => h.toLowerCase())
  return lines.slice(1).map((l) => Object.fromEntries(splitCsv(l).map((v, i) => [head[i], v])))
}

export default function Upload() {
  const [file, setFile] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState('')
  const [res, setRes] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [hist, setHist] = useState<Hist[]>([])
  const load = useCallback(() => { api<Hist[]>('/api/imports').then(setHist).catch(() => {}) }, [])
  useEffect(load, [load])

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; setRes(null); setErr(''); setRows([]); setFile('')
    if (!f) return
    if (!/\.(csv|json)$/i.test(f.name)) return setErr('Only .csv and .json files are supported.')
    if (f.size > 1_000_000) return setErr('File is larger than 1 MB.')
    f.text().then((t) => {
      try {
        const r = parse(f.name, t)
        if (r.length === 0) return setErr('The file has no data rows.')
        if (r.length > 500) return setErr('At most 500 rows can be imported at once.')
        if (!('date' in r[0]) || !('mood' in r[0])) return setErr('Required columns are missing. The file needs at least: date, mood.')
        setRows(r); setFile(f.name)
      } catch (x) { setErr((x as Error).message || 'Could not read this file.') }
    })
  }
  async function doImport() {
    setBusy(true); setErr('')
    try { setRes(await api<Result>('/api/import', { method: 'POST', body: JSON.stringify({ filename: file, source: file.toLowerCase().endsWith('.json') ? 'json' : 'csv', rows }) })); setRows([]); load() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div>
      <h1 className="m-0 text-3xl font-extrabold">Data upload</h1>
      <p className="mt-1 mb-6 text-mute">Import past mood entries from a CSV or JSON file. Entries are stored in your account and appear in your dashboard and analytics.</p>
      <section className={card}>
        <p className={eyebrow}>Supported format</p>
        <p className="mt-0 text-sm text-mute">Required columns: <b>date</b> (YYYY-MM-DD) and <b>mood</b> (1 to 5). Optional: <b>sleep_hours</b> (0 to 24), <b>stress</b> (1 to 5), <b>note</b>. Up to 500 rows, 1 MB. Rows with problems are skipped and explained, and duplicates are ignored.</p>
        <pre className="m-0 overflow-x-auto rounded-xl bg-cream p-3 text-xs">{SAMPLE}</pre>
      </section>
      <section className={card}>
        <label htmlFor="uf" className="inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-forest px-5 font-semibold text-white">Choose file</label>
        <input id="uf" type="file" accept=".csv,.json" onChange={pick} className="sr-only" />
        {file && <span className="ml-3 text-sm">{file}</span>}
        <p role="alert" className="mb-0 mt-3 min-h-5 text-sm text-red-700">{err}</p>
        {rows.length > 0 && <>
          <p className="mb-2 mt-3 font-semibold">Preview: {rows.length} rows found (first 5 shown)</p>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['date', 'mood', 'sleep_hours', 'stress', 'note'].map((h) => <th key={h} className="p-1.5 text-mute">{h}</th>)}</tr></thead>
            <tbody>{rows.slice(0, 5).map((r, i) => <tr key={i} className="border-t border-line">{['date', 'mood', 'sleep_hours', 'stress', 'note'].map((h) => <td key={h} className="p-1.5">{r[h] ?? ''}</td>)}</tr>)}</tbody></table></div>
          <button disabled={busy} onClick={doImport} className="mt-3 min-h-11 rounded-xl bg-forest px-5 font-semibold text-white disabled:opacity-50">{busy ? 'Importing…' : `Import ${rows.length} rows`}</button>
        </>}
        {res && <div role="status" className="mt-3 rounded-2xl bg-mint p-4 text-sm"><b>{res.imported} imported, {res.skipped_count} skipped.</b>{res.skipped.map((s) => <p key={s.row} className="my-0.5">Row {s.row}: {s.reason}</p>)}</div>}
      </section>
      <section className={card}>
        <p className={eyebrow}>Import history</p>
        {hist.length === 0 ? <p className="m-0 text-mute">No imports yet.</p> : hist.map((h, i) => <p key={i} className="my-1 text-sm">{h.created.slice(0, 10)} · <b>{h.filename}</b> ({h.source.toUpperCase()}) · {h.imported} imported, {h.skipped} skipped</p>)}
      </section>
      <section className={card}>
        <p className={eyebrow}>Wearable sources (integration-ready, not connected)</p>
        <p className="mt-0 text-sm text-mute">No wearable is connected to this app. Each source below needs credentials or a mobile app that this prototype does not have. Until then, export your data from the device app as CSV and import it above.</p>
        {SOURCES.map(([n, why]) => <div key={n} className="flex items-center justify-between gap-3 border-t border-line py-2.5"><span><b>{n}</b><br /><span className="text-sm text-mute">{why}</span></span><span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-mute">Not connected</span></div>)}
      </section>
    </div>
  )
}
