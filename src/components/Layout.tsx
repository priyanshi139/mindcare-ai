import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../services/http'
import { LayoutDashboard, Search, Smile, LogOut, ClipboardList, MessageCircleHeart, BarChart3, Target, UserCog, ShieldAlert, Bell, Lightbulb, Upload, FileText, Stethoscope } from 'lucide-react'
import { Logo } from './Logo'
import { roleLabel, useAuth } from '../store/auth'

const links = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/patients', label: 'Shared with me', icon: Stethoscope, roles: ['Doctor', 'Caregiver'] },
  { to: '/dashboard/risk', label: 'Risk monitoring', icon: ShieldAlert },
  { to: '/dashboard/analytics', label: 'Behavioral analytics', icon: BarChart3 },
  { to: '/dashboard/explain', label: 'Explainable AI', icon: Search },
  { to: '/dashboard/assess', label: 'Assessment', icon: ClipboardList },
  { to: '/dashboard/mood', label: 'Mood tracking', icon: Smile },
  { to: '/dashboard/insights', label: 'Wellness insights', icon: Lightbulb },
  { to: '/dashboard/goals', label: 'Wellness goals', icon: Target },
  { to: '/dashboard/companion', label: 'AI companion', icon: MessageCircleHeart },
  { to: '/dashboard/upload', label: 'Data upload', icon: Upload },
  { to: '/dashboard/records', label: 'Health records', icon: FileText },
  { to: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { to: '/dashboard/profile', label: 'Profile and privacy', icon: UserCog },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [unread, setUnread] = useState(0)
  useEffect(() => { api<{ unread: number }>('/api/notifications').then((d) => setUnread(d.unread)).catch(() => {}) }, [loc.pathname])
  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_1fr]">
      <aside className="border-b border-line bg-white p-3 md:sticky md:top-0 md:h-screen md:border-r md:border-b-0 md:p-5">
        <Logo variant="icon" className="mb-3 hidden h-16 md:block" />
        <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Dashboard">
          {links.filter((l) => !l.roles || l.roles.includes(user?.role ?? '')).map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-[15px] font-medium ${isActive ? 'bg-mint font-bold text-forest' : 'text-mute hover:bg-cream'}`}>
              <Icon size={18} aria-hidden /> {label}{to.endsWith('notifications') && unread > 0 && <span className="ml-auto rounded-full bg-amber px-2 text-xs font-bold text-white">{unread}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 hidden border-t border-line pt-4 text-sm md:block">
          <p className="m-0 font-semibold">{user?.name}</p>
          <p className="m-0 mb-3 text-mute">{roleLabel(user?.role)}</p>
          <button onClick={() => { logout(); nav('/') }} className="flex min-h-11 items-center gap-2 rounded-xl border border-forest px-4 font-semibold text-forest"><LogOut size={16} /> Log out</button>
        </div>
      </aside>
      <main className="min-w-0 p-5 md:p-8"><Outlet /></main>
    </div>
  )
}
