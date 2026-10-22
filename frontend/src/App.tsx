import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { useAuth } from './lib/auth'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { NewProjectPage } from './pages/NewProjectPage'
import { NewSitePage } from './pages/NewSitePage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { SetupPage } from './pages/SetupPage'
import { SiteDetailPage } from './pages/SiteDetailPage'

export function App() {
  const { user } = useAuth()
  if (!user) return <Routes><Route path="*" element={<LoginPage />} /></Routes>
  return <AppShell><Routes>
    <Route path="/" element={<DashboardPage />} />
    <Route path="/projects" element={<ProjectsPage />} />
    <Route path="/projects/new" element={user.role === 'ADMIN' ? <NewProjectPage /> : <Navigate to="/projects" />} />
    <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
    <Route path="/projects/:projectId/sites/new" element={user.role === 'ADMIN' ? <NewSitePage /> : <Navigate to="/projects" />} />
    <Route path="/sites/:siteId" element={<SiteDetailPage />} />
    <Route path="/setup" element={user.role === 'ADMIN' ? <SetupPage /> : <Navigate to="/" />} />
    <Route path="*" element={<Navigate to="/" />} />
  </Routes></AppShell>
}
