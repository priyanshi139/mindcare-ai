import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Overview from './pages/Overview'
import Explain from './pages/Explain'
import Mood from './pages/Mood'
import Assess from './pages/Assess'
import Companion from './pages/Companion'
import Analytics from './pages/Analytics'
import Goals from './pages/Goals'
import Profile from './pages/Profile'
import RiskPage from './pages/Risk'
import Notifications from './pages/Notifications'
import Insights from './pages/Insights'
import Upload from './pages/Upload'
import Records from './pages/Records'
import Patients from './pages/Patients'
import Onboarding from './pages/Onboarding'
import Forgot from './pages/Forgot'
import { useAuth } from './store/auth'

function Protected() {
  const session = useAuth((s) => s.session)
  return session ? <Layout /> : <Navigate to="/login" replace />
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const session = useAuth((s) => s.session)
  return session ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Auth mode="login" />} />
      <Route path="/signup" element={<Auth mode="signup" />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
      <Route path="/dashboard" element={<Protected />}>
        <Route index element={<Overview />} />
        <Route path="explain" element={<Explain />} />
        <Route path="mood" element={<Mood />} />
        <Route path="assess" element={<Assess />} />
        <Route path="companion" element={<Companion />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="goals" element={<Goals />} />
        <Route path="profile" element={<Profile />} />
        <Route path="risk" element={<RiskPage />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="insights" element={<Insights />} />
        <Route path="upload" element={<Upload />} />
        <Route path="records" element={<Records />} />
        <Route path="patients" element={<Patients />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
