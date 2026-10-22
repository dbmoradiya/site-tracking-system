import { ArrowRight, CheckCircle2, HardHat, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const demoAccounts = [
  { key: 'admin', label: 'Admin' },
  { key: 'coordinator', label: 'Coordinator' },
  { key: 'supervisor', label: 'Supervisor' },
  { key: 'design', label: 'Design Engineer' },
  { key: 'procurement', label: 'Procurement Manager' },
]

export function LoginPage() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@sitetrack.local')
  const [password, setPassword] = useState('SiteTrack123!')
  const [error, setError] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    try { await login(email, password); navigate('/', { replace: true }) } catch (err) { setError(err instanceof Error ? err.message : 'Sign in failed') }
  }
  return <main className="login-page">
    <section className="login-hero">
      <div className="brand brand--light"><span className="brand__mark">ST</span><span>SiteTrack</span></div>
      <div className="login-hero__content">
        <span className="eyebrow"><HardHat aria-hidden="true" /> Built for field execution</span>
        <h1>Every Site.<br />Every Stage.<br /><em>Clearly delivered.</em></h1>
        <p>Plan work, capture evidence and approve progress without losing the audit trail.</p>
        <ul>
          <li><CheckCircle2 /> Stage dependencies stay visible</li>
          <li><CheckCircle2 /> Evidence is required before review</li>
          <li><CheckCircle2 /> Reassignment never erases history</li>
        </ul>
      </div>
      <span className="login-hero__footer">English-only product interface</span>
    </section>
    <section className="login-panel">
      <form className="login-card" onSubmit={submit}>
        <span className="login-card__icon"><ShieldCheck aria-hidden="true" /></span>
        <p className="eyebrow">Secure workspace</p>
        <h2>Welcome back</h2>
        <p className="muted">Sign in to continue to your Sites.</p>
        {error && <div className="alert alert--error" role="alert">{error}</div>}
        <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        <button className="button button--primary button--wide" disabled={loading}>{loading ? 'Signing in…' : <>Sign in <ArrowRight /></>}</button>
        <div className="demo-accounts">
          <strong>Demo accounts</strong>
          {demoAccounts.map(account => <button type="button" key={account.key} onClick={() => setEmail(`${account.key}@sitetrack.local`)}>{account.label}<small>{account.key}@sitetrack.local</small></button>)}
        </div>
      </form>
    </section>
  </main>
}
