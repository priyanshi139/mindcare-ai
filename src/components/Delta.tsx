export interface Ch { recent: number | null; previous: number | null; delta: number | null }
export interface Changes { mood: Ch; sleep: Ch; stress: Ch; entries: { recent: number; previous: number } }
const LABEL = { mood: 'Mood (1 to 5)', sleep: 'Sleep (hours)', stress: 'Stress (1 to 5)' } as const

export function Delta({ c }: { c: Changes }) {
  if (c.entries.recent === 0) return <p className="text-mute">No mood check-ins in the last 7 days. Add one in Mood tracking to see changes.</p>
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {(['mood', 'sleep', 'stress'] as const).map((k) => (
        <div key={k} className="rounded-2xl bg-cream p-4">
          <p className="m-0 text-sm text-mute">{LABEL[k]}</p>
          <p className="my-1 text-2xl font-extrabold">{c[k].recent ?? 'n/a'}</p>
          <p className="m-0 text-sm text-mute">{c[k].delta == null ? 'Need entries from the week before to compare.' : `${c[k].delta! > 0 ? '+' : ''}${c[k].delta} vs previous 7 days (${c[k].previous})`}</p>
        </div>
      ))}
    </div>
  )
}
