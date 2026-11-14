import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'Patient' | 'Caregiver' | 'Doctor'
// 'Patient' is the internal role value; the interface shows 'Member'.
export const roleLabel = (r?: string) => (r === 'Patient' ? 'Member' : r ?? '')
interface User { id: number; name: string; email: string; role: Role }
interface AuthState {
  token: string | null
  user: User | null
  session: boolean
  signup: (name: string, email: string, pw: string, role: Role) => Promise<string | null>
  login: (email: string, pw: string) => Promise<string | null>
  logout: () => void
}

const NET = 'Cannot reach the backend. Start it with: uvicorn main:app --port 8000 (inside the backend folder).'
async function call(path: string, body: unknown) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const d = await r.json().catch(() => ({}))
  return { ok: r.ok, status: r.status, d, msg: typeof d.detail === 'string' ? d.detail : 'Please check your details.' }
}

// Sessions use a JWT issued by the backend (stored in localStorage for development).
// For production, use httpOnly cookies and HTTPS.
export const useAuth = create<AuthState>()(
  persist(
    (set) => {
      const ok = (d: { token: string; user: User }) => set({ token: d.token, user: d.user, session: true })
      return {
        token: null, user: null, session: false,
        signup: async (name, email, password, role) => {
          try { const r = await call('/api/auth/signup', { name, email, password, role }); if (!r.ok) return r.msg; ok(r.d); return null } catch { return NET }
        },
        login: async (email, password) => {
          try { const r = await call('/api/auth/login', { email, password }); if (!r.ok) return r.msg; ok(r.d); return null } catch { return NET }
        },
        logout: () => set({ token: null, user: null, session: false }),
      }
    },
    { name: 'mindcare-auth' },
  ),
)
