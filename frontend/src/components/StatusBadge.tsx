import { Badge } from '@mantine/core'
import { humanStatus } from '../lib/api'

const colors: Record<string, string> = {
  NOT_STARTED: 'gray', READY: 'blue', IN_PROGRESS: 'orange', REVIEW_PENDING: 'violet', CHANGES_REQUESTED: 'red',
  APPROVED: 'teal', COMPLETED: 'green', BLOCKED: 'gray',
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant="light" color={colors[status] ?? 'gray'} className={`status status--${status.toLowerCase()}`}>{humanStatus(status)}</Badge>
}
