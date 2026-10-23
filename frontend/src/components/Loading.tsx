import { Center, Group, Loader, Text } from '@mantine/core'

export function Loading({ label = 'Loading' }: { label?: string }) {
  return <Center py="xl" role="status"><Group gap="xs"><Loader size="sm" /><Text size="sm" c="dimmed">{label}…</Text></Group></Center>
}
