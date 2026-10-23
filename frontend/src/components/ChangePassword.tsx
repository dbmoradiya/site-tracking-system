import { Alert, Button, Group, Modal, PasswordInput, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState, type FormEvent } from 'react'
import { post } from '../lib/api'

export function ChangePasswordModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const close = () => { setCurrent(''); setNext(''); setConfirm(''); setError(''); onClose() }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (next.length < 10) { setError('New password must be at least 10 characters'); return }
    if (next !== confirm) { setError('New password and confirmation do not match'); return }
    setSaving(true); setError('')
    try {
      await post('/auth/change-password', { currentPassword: current, newPassword: next })
      notifications.show({ color: 'green', message: 'Password changed' })
      close()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not change password') }
    finally { setSaving(false) }
  }
  return (
    <Modal opened={opened} onClose={close} title="Change password" centered>
      <form onSubmit={submit}>
        <Stack gap="sm">
          {error && <Alert color="red" role="alert">{error}</Alert>}
          <PasswordInput required label="Current password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.currentTarget.value)} />
          <PasswordInput required label="New password" description="At least 10 characters" autoComplete="new-password" minLength={10} maxLength={72} value={next} onChange={e => setNext(e.currentTarget.value)} />
          <PasswordInput required label="Confirm new password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={close}>Cancel</Button><Button type="submit" loading={saving}>Change password</Button></Group>
        </Stack>
      </form>
    </Modal>
  )
}
