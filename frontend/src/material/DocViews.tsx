// Shared pieces for the purchase and sale popups. Items show as a table on wide screens and as
// stacked cards on phones (a wide table inside a popup scrolls the whole popup sideways on a phone).
import { useEffect, useMemo, useState } from 'react'
import { Button, Group, Paper, SimpleGrid, Stack, Table, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { Download } from 'lucide-react'
import { ChallanViewer } from './ChallanViewer'
import { apiBlob } from '../lib/api'
import { calc, docTotals, inr, num, type Invoice, type Line } from './types'

export function ItemsTable({ items }: { items: Line[] }) {
  const t = docTotals(items)
  const narrow = useMediaQuery('(max-width: 40em)')
  if (narrow) return <Stack gap={6} style={{ minWidth: 0 }}>
    {items.map((l, i) => { const c = calc(l.qty, l.rate, l.gst); return <Paper withBorder p="xs" key={i}>
      <Group justify="space-between" wrap="nowrap" align="flex-start"><Text size="sm" fw={700} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{l.material}</Text><Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>{num(l.qty)} {l.uom}</Text></Group>
      <SimpleGrid cols={2} spacing={20} verticalSpacing={2} mt={4}>
        <KV k="Rate" v={inr(l.rate)} /><KV k="GST" v={`${l.gst}%`} /><KV k="Amount" v={inr(c.subtotal)} /><KV k="SGST" v={inr(c.sgst)} /><KV k="CGST" v={inr(c.cgst)} /><KV k="Total" v={inr(c.total)} bold />
      </SimpleGrid></Paper> })}
    <Paper withBorder p="xs" bg="gray.0"><Text size="sm" fw={700} mb={2}>Grand total</Text>
      <SimpleGrid cols={2} spacing={20} verticalSpacing={2}><KV k="Amount" v={inr(t.subtotal)} /><KV k="SGST" v={inr(t.sgst)} /><KV k="CGST" v={inr(t.cgst)} /><KV k="Total" v={inr(t.total)} bold orange /></SimpleGrid></Paper>
  </Stack>
  return <Paper withBorder style={{ minWidth: 0, maxWidth: '100%' }}><Table.ScrollContainer minWidth={560} type="native" style={{ maxWidth: '100%' }}><Table fz="xs"><Table.Thead><Table.Tr><Table.Th>Item</Table.Th><Table.Th ta="right">Qty</Table.Th><Table.Th ta="right">Rate</Table.Th><Table.Th ta="right">GST</Table.Th><Table.Th ta="right">Amount</Table.Th><Table.Th ta="right">SGST</Table.Th><Table.Th ta="right">CGST</Table.Th><Table.Th ta="right">Total</Table.Th></Table.Tr></Table.Thead>
    <Table.Tbody>{items.map((l, i) => { const c = calc(l.qty, l.rate, l.gst); return <Table.Tr key={i}><Table.Td fw={600}>{l.material}</Table.Td><Table.Td ta="right">{num(l.qty)} {l.uom}</Table.Td><Table.Td ta="right">{inr(l.rate)}</Table.Td><Table.Td ta="right">{l.gst}%</Table.Td><Table.Td ta="right">{inr(c.subtotal)}</Table.Td><Table.Td ta="right">{inr(c.sgst)}</Table.Td><Table.Td ta="right">{inr(c.cgst)}</Table.Td><Table.Td ta="right" fw={700}>{inr(c.total)}</Table.Td></Table.Tr> })}
      <Table.Tr bg="gray.0"><Table.Td colSpan={4} fw={700}>Grand total</Table.Td><Table.Td ta="right" fw={700}>{inr(t.subtotal)}</Table.Td><Table.Td ta="right" fw={700}>{inr(t.sgst)}</Table.Td><Table.Td ta="right" fw={700}>{inr(t.cgst)}</Table.Td><Table.Td ta="right" fw={700} c="orange.8">{inr(t.total)}</Table.Td></Table.Tr></Table.Tbody></Table></Table.ScrollContainer></Paper>
}
function KV({ k, v, bold, orange }: { k: string; v: string; bold?: boolean; orange?: boolean }) {
  return <Group justify="space-between" gap={4} wrap="nowrap"><Text size="xs" c="dimmed">{k}</Text><Text size="xs" fw={bold ? 700 : 500} c={orange ? 'orange.8' : undefined} style={{ whiteSpace: 'nowrap' }}>{v}</Text></Group>
}

// Shows an uploaded invoice (PDF drawn page by page, or an image) with open/download buttons.
export function InvoiceViewer({ invoice, alt }: { invoice: Invoice; alt: string }) {
  const [blob, setBlob] = useState<Blob | null>(null), [err, setErr] = useState(false)
  const isPdf = invoice.type === 'application/pdf' || /\.pdf$/i.test(invoice.name)
  useEffect(() => {
    let dead = false; setBlob(null); setErr(false)
    const get = invoice.file ? Promise.resolve<Blob>(invoice.file) : invoice.url.startsWith('/material') ? apiBlob(invoice.url) : fetch(invoice.url).then(r => r.blob())
    get.then(b => { if (!dead) setBlob(b) }).catch(() => { if (!dead) setErr(true) })
    return () => { dead = true }
  }, [invoice.url, invoice.file])
  const objUrl = useMemo(() => blob ? URL.createObjectURL(blob) : '', [blob])
  useEffect(() => () => { if (objUrl) URL.revokeObjectURL(objUrl) }, [objUrl])
  const openTab = () => { if (objUrl) window.open(objUrl, '_blank') }
  const download = () => { if (!objUrl) return; const a = document.createElement('a'); a.href = objUrl; a.download = invoice.name; document.body.appendChild(a); a.click(); a.remove() }
  return <div>
    {err ? <Text size="sm" c="red">Could not open this file.</Text> : !blob ? <Text size="sm" c="dimmed">Loading...</Text> : isPdf ? <ChallanViewer blob={blob} />
      : <div style={{ maxHeight: '70vh', overflow: 'auto', background: '#f1f3f5', padding: 6 }}><img src={objUrl} alt={alt} style={{ maxWidth: '100%', display: 'block', margin: '0 auto', background: '#fff' }} /></div>}
    <Group justify="flex-end" gap={6} mt={6}><Button size="compact-xs" variant="default" disabled={!blob} onClick={openTab}>Open in new tab</Button><Button size="compact-xs" variant="default" disabled={!blob} leftSection={<Download size={12} />} onClick={download}>Download</Button></Group>
  </div>
}
