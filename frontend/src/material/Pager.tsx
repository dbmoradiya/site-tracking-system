import { Group, NativeSelect, Pagination, Text } from '@mantine/core'
import { useEffect, useState } from 'react'

// UI-only pagination over an in-memory list. Real build: server-side pages, with filters/sorting applied to all records before paging.
export function usePaged<T>(items: T[], initialSize = 5) {
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(initialSize)
  const pages = Math.max(1, Math.ceil(items.length / size))
  useEffect(() => { setPage(1) }, [items.length, size])
  const cur = Math.min(page, pages)
  return { rows: items.slice((cur - 1) * size, cur * size), page: cur, setPage, size, setSize, pages, total: items.length }
}

export function Pager({ p, label = 'rows' }: { p: ReturnType<typeof usePaged<any>>; label?: string }) {
  if (p.total === 0) return null
  const from = (p.page - 1) * p.size + 1, to = Math.min(p.total, p.page * p.size)
  return <Group justify="space-between" p="xs" gap="xs" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
    <Group gap="xs"><Text size="xs" c="dimmed">Showing {from}-{to} of {p.total} {label}</Text>
      <NativeSelect size="xs" aria-label="Rows per page" value={String(p.size)} onChange={e => p.setSize(Number(e.currentTarget.value))} data={['5', '10', '25', '50'].map(v => ({ value: v, label: `${v} / page` }))} /></Group>
    {p.pages > 1 && <Pagination size="sm" total={p.pages} value={p.page} onChange={p.setPage} withEdges />}
  </Group>
}
