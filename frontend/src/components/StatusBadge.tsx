import { humanStatus } from '../lib/api'

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status status--${status.toLowerCase()}`}>{humanStatus(status)}</span>
}
