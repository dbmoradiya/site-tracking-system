import { ArrowRight, CheckCircle2, HardHat, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Alert, Button, PasswordInput, TextInput } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'


export function LoginPage() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    try { await login(mobile, password); navigate('/', { replace: true }) } catch (err) { setError(err instanceof Error ? err.message : 'Sign in failed') }
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
        {error && <Alert color="red" role="alert">{error}</Alert>}
        <TextInput label="Mobile number" type="tel" inputMode="tel" placeholder="e.g. 98765 43210" value={mobile} onChange={e => setMobile(e.currentTarget.value)} autoComplete="username" required />
        <PasswordInput label="Password" value={password} onChange={e => setPassword(e.currentTarget.value)} autoComplete="current-password" required />
        <Button type="submit" fullWidth loading={loading} rightSection={<ArrowRight size={16} />}>Sign in</Button>
      </form>
    </section>
  </main>
}
