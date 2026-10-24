import { ArrowRight, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Alert, Button, PasswordInput, TextInput } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { BrandLockup } from '../components/BrandLockup'


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
      <BrandLockup />
    </section>
    <section className="login-panel">
      <BrandLockup className="brand-lockup--mobile" />
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
