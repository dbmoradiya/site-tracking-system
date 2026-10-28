// Shared pieces for the purchase and sale popups. Items show as a table on wide screens and as
// stacked cards on phones (a wide table inside a popup scrolls the whole popup sideways on a phone).
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Badge, Button, Group, Paper, SimpleGrid, Stack, Table, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { Download } from 'lucide-react'
import { ChallanViewer } from './ChallanViewer'
import { apiBlob } from '../lib/api'
import { calc, docTotals, inr, num, type Invoice, type Line } from './types'

type Block = { head?: Line; lines: Line[] }
/** Groups consecutive lines that came from one group, so a group shows as a heading, its materials and a subtotal. */
const blocksOf = (items: Line[]): Block[] => {
  const out: Block[] = []
  for (const l of items) { const last = out[out.length - 1]; if (l.groupLine && last?.head && last.head.groupLine === l.groupLine) last.lines.push(l); else out.push({ head: l.groupLine ? l : undefined, lines: [l] }) }
  return out
}
const groupHead = (b: Block) => { const h = b.head!; return `${h.groupName} x ${num(h.groupQty ?? 0)}  (1 ${h.groupName} = ${b.lines.map(l => `${num(l.groupPer ?? 0)} ${l.uom} ${l.material}`).join(' + ')})` }
const subOf = (b: Block) => docTotals(b.lines)
export function ItemsTable({ items }: { items: Line[] }) {
  const t = docTotals(items)
  const narrow = useMediaQuery('(max-width: 40em)')
  if (narrow) return <Stack gap={6} style={{ minWidth: 0 }}>
    {blocksOf(items).map((b, bi) => <Stack gap={6} key={bi} data-group={b.head ? b.head.groupName : undefined} style={b.head ? { borderLeft: '3px solid var(--mantine-color-blue-5)', paddingLeft: 6 } : undefined}>
      {b.head && <Group gap={6} wrap="nowrap" align="flex-start"><Badge size="xs" variant="light" tt="none" style={{ flexShrink: 0, overflow: "visible" }}>Group</Badge><Text size="sm" fw={700} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{groupHead(b)}</Text></Group>}
      {b.lines.map((l, i) => { const c = calc(l.qty, l.rate, l.gst); return <Paper withBorder p="xs" key={i}>
      <Group justify="space-between" wrap="nowrap" align="flex-start"><Text size="sm" fw={700} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{l.material}</Text><Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>{num(l.qty)} {l.uom}</Text></Group>
      <SimpleGrid cols={2} spacing={20} verticalSpacing={2} mt={4}>
        <KV k="Rate" v={inr(l.rate)} /><KV k="GST" v={`${l.gst}%`} /><KV k="Amount" v={inr(c.subtotal)} /><KV k="SGST" v={inr(c.sgst)} /><KV k="CGST" v={inr(c.cgst)} /><KV k="Total" v={inr(c.total)} bold />
      </SimpleGrid></Paper> })}
      {b.head && <Paper withBorder p="xs" bg="blue.0"><Group justify="space-between"><Text size="xs" fw={700}>{b.head.groupName} subtotal</Text><Text size="xs" fw={700}>{inr(subOf(b).total)}</Text></Group></Paper>}
    </Stack>)}
    <Paper withBorder p="xs" bg="gray.0"><Text size="sm" fw={700} mb={2}>Grand total</Text>
      <SimpleGrid cols={2} spacing={20} verticalSpacing={2}><KV k="Amount" v={inr(t.subtotal)} /><KV k="SGST" v={inr(t.sgst)} /><KV k="CGST" v={inr(t.cgst)} /><KV k="Total" v={inr(t.total)} bold orange /></SimpleGrid></Paper>
  </Stack>
  return <Paper withBorder style={{ minWidth: 0, maxWidth: '100%' }}><Table.ScrollContainer minWidth={560} type="native" style={{ maxWidth: '100%' }}><Table fz="xs"><Table.Thead><Table.Tr><Table.Th>Item</Table.Th><Table.Th ta="right">Qty</Table.Th><Table.Th ta="right">Rate</Table.Th><Table.Th ta="right">GST</Table.Th><Table.Th ta="right">Amount</Table.Th><Table.Th ta="right">SGST</Table.Th><Table.Th ta="right">CGST</Table.Th><Table.Th ta="right">Total</Table.Th></Table.Tr></Table.Thead>
    <Table.Tbody>{blocksOf(items).map((b, bi) => <Fragment key={bi}>
      {b.head && <Table.Tr bg="blue.0" data-group-head={b.head.groupName}><Table.Td colSpan={8} fw={700}><Badge size="xs" variant="light" tt="none" mr={6}>Group</Badge>{groupHead(b)}</Table.Td></Table.Tr>}
      {b.lines.map((l, i) => { const c = calc(l.qty, l.rate, l.gst); return <Table.Tr key={i}><Table.Td fw={600} pl={l.groupLine ? 24 : undefined}>{l.material}</Table.Td><Table.Td ta="right">{num(l.qty)} {l.uom}</Table.Td><Table.Td ta="right">{inr(l.rate)}</Table.Td><Table.Td ta="right">{l.gst}%</Table.Td><Table.Td ta="right">{inr(c.subtotal)}</Table.Td><Table.Td ta="right">{inr(c.sgst)}</Table.Td><Table.Td ta="right">{inr(c.cgst)}</Table.Td><Table.Td ta="right" fw={700}>{inr(c.total)}</Table.Td></Table.Tr> })}
      {b.head && (() => { const g = subOf(b); return <Table.Tr bg="blue.0"><Table.Td colSpan={4} fs="italic" fw={600}>{b.head.groupName} subtotal</Table.Td><Table.Td ta="right" fw={600}>{inr(g.subtotal)}</Table.Td><Table.Td ta="right" fw={600}>{inr(g.sgst)}</Table.Td><Table.Td ta="right" fw={600}>{inr(g.cgst)}</Table.Td><Table.Td ta="right" fw={600}>{inr(g.total)}</Table.Td></Table.Tr> })()}
    </Fragment>)}
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
