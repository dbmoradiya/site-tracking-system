import { Alert, Badge, Button, Drawer, Group, Modal, NativeSelect, NumberInput, Paper, SimpleGrid, Stack, Table, Tabs, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { ArrowDownToLine, ArrowUpFromLine, Info, Package, Plus, Search, ShoppingCart } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CreatableSelect } from '../preview/CreatableSelect'
import { GST_RATES, UOMS, calc, fmtDate, inr, num, type Issue, type Purchase } from '../preview/materialMock'
import { addPurchase, findMaterial, findVendor, useMaterialStore } from '../preview/materialStore'

const today = () => new Date().toISOString().slice(0, 10)
const byDateDesc = <T extends { date: string; id: number }>(a: T, b: T) => b.date.localeCompare(a.date) || b.id - a.id

export function MaterialPage() {
  const [tab, setTab] = useState<string | null>('stock')
  const { purchases, issues } = useMaterialStore()
  const [detail, setDetail] = useState<string | null>(null)
  return <Stack gap="sm" className="page-compact">
    <Group justify="space-between" align="flex-end"><div><Text size="xs" fw={700} c="orange.8" tt="uppercase">Inventory</Text><Title order={2}>Material</Title></div>
      <Badge color="gray" variant="light">UI preview - sample data</Badge></Group>
    <Alert color="orange" variant="light" p="xs" icon={<Info size={16} aria-hidden="true" />}>Preview only. Everything here is sample data held in the browser and lost on reload. Stock, purchase and issue logic is not built yet.</Alert>
    <Tabs value={tab} onChange={setTab} keepMounted={false}>
      <Tabs.List><Tabs.Tab value="stock" leftSection={<Package size={14} aria-hidden="true" />}>Current stock</Tabs.Tab>
        <Tabs.Tab value="purchase" leftSection={<ShoppingCart size={14} aria-hidden="true" />}>Purchase</Tabs.Tab></Tabs.List>
      <Tabs.Panel value="stock" pt="sm"><StockTab purchases={purchases} issues={issues} onOpen={setDetail} /></Tabs.Panel>
      <Tabs.Panel value="purchase" pt="sm"><PurchaseTab purchases={purchases} /></Tabs.Panel>
    </Tabs>
    <Drawer opened={!!detail} onClose={() => setDetail(null)} position="right" size="min(960px, 100%)" title={<Text fw={700}>{detail} - stock detail</Text>}>
      {detail && <StockDetail material={detail} purchases={purchases} issues={issues} />}
    </Drawer>
  </Stack>
}

function stockRows(purchases: Purchase[], issues: Issue[]) {
  const map = new Map<string, { material: string; uom: string; bought: number; issued: number; lastPurchase: string }>()
  for (const p of purchases) {
    const r = map.get(p.material) ?? { material: p.material, uom: p.uom, bought: 0, issued: 0, lastPurchase: p.date }
    r.bought += p.qty; if (p.date > r.lastPurchase) r.lastPurchase = p.date; map.set(p.material, r)
  }
  for (const i of issues) { const r = map.get(i.material); if (r) r.issued += i.qty }
  return [...map.values()].map(r => ({ ...r, stock: r.bought - r.issued })).sort((a, b) => a.material.localeCompare(b.material))
}

function StockTab({ purchases, issues, onOpen }: { purchases: Purchase[]; issues: Issue[]; onOpen: (m: string) => void }) {
  const [q, setQ] = useState('')
  const rows = useMemo(() => stockRows(purchases, issues).filter(r => r.material.toLowerCase().includes(q.toLowerCase())), [purchases, issues, q])
  return <Stack gap="xs">
    <Group gap="xs"><TextInput aria-label="Search material types" style={{ flex: '1 1 220px' }} size="xs" leftSection={<Search size={14} />} value={q} onChange={e => setQ(e.currentTarget.value)} placeholder="Search material types" /><Text size="xs" c="dimmed">{rows.length} material types</Text></Group>
    <Paper withBorder><Table.ScrollContainer minWidth={640}><Table highlightOnHover>
      <Table.Thead><Table.Tr><Table.Th>Material type</Table.Th><Table.Th>UOM</Table.Th><Table.Th ta="right">Purchased</Table.Th><Table.Th ta="right">Issued</Table.Th><Table.Th ta="right">Current stock</Table.Th><Table.Th>Last purchase</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>{rows.map(r => <Table.Tr key={r.material} style={{ cursor: 'pointer' }} tabIndex={0} onClick={() => onOpen(r.material)} onKeyDown={e => e.key === 'Enter' && onOpen(r.material)} aria-label={`Open ${r.material} detail`}>
        <Table.Td fw={600}>{r.material}</Table.Td><Table.Td>{r.uom}</Table.Td><Table.Td ta="right">{num(r.bought)}</Table.Td><Table.Td ta="right">{num(r.issued)}</Table.Td>
        <Table.Td ta="right"><Badge color={r.stock <= r.bought * 0.1 ? 'red' : 'green'} variant="light" size="md">{num(r.stock)} {r.uom}</Badge></Table.Td><Table.Td>{fmtDate(r.lastPurchase)}</Table.Td>
      </Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></Paper>
    <Text size="xs" c="dimmed">Click a row to see purchase history (left) and issued history (right).</Text>
  </Stack>
}

function StockDetail({ material, purchases, issues: allIssues }: { material: string; purchases: Purchase[]; issues: Issue[] }) {
  const bought = purchases.filter(p => p.material === material).sort(byDateDesc)
  const issued = allIssues.filter(i => i.material === material).sort(byDateDesc)
  const uom = bought[0]?.uom ?? ''
  const tb = bought.reduce((s, p) => s + p.qty, 0), ti = issued.reduce((s, i) => s + i.qty, 0)
  return <Stack gap="sm">
    <SimpleGrid cols={3} spacing="xs">
      <Paper withBorder p="xs"><Text size="xs" c="dimmed">Purchased</Text><Text fw={700}>{num(tb)} {uom}</Text></Paper>
      <Paper withBorder p="xs"><Text size="xs" c="dimmed">Issued</Text><Text fw={700}>{num(ti)} {uom}</Text></Paper>
      <Paper withBorder p="xs"><Text size="xs" c="dimmed">Current stock</Text><Text fw={700} c="green.8">{num(tb - ti)} {uom}</Text></Paper>
    </SimpleGrid>
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm" style={{ alignItems: 'start' }}>
      <Paper withBorder><Group gap={6} p="xs" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}><ArrowDownToLine size={14} aria-hidden="true" /><Text fw={700} size="sm">Purchase history</Text></Group>
        <Table.ScrollContainer minWidth={380}><Table><Table.Thead><Table.Tr><Table.Th>Date</Table.Th><Table.Th>Vendor</Table.Th><Table.Th ta="right">Qty</Table.Th><Table.Th ta="right">Total</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{bought.map(p => <Table.Tr key={p.id}><Table.Td>{fmtDate(p.date)}</Table.Td><Table.Td>{p.vendor}</Table.Td><Table.Td ta="right">{num(p.qty)}</Table.Td><Table.Td ta="right">{inr(calc(p.qty, p.rate, p.gst).total)}</Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></Paper>
      <Paper withBorder><Group gap={6} p="xs" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}><ArrowUpFromLine size={14} aria-hidden="true" /><Text fw={700} size="sm">Issued history</Text></Group>
        {issued.length === 0 ? <Text size="sm" c="dimmed" p="sm">Nothing issued yet.</Text> :
          <Table.ScrollContainer minWidth={380}><Table><Table.Thead><Table.Tr><Table.Th>Date</Table.Th><Table.Th>Project / Site</Table.Th><Table.Th>Issued to</Table.Th><Table.Th ta="right">Qty</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>{issued.map(i => <Table.Tr key={i.id}><Table.Td>{fmtDate(i.date)}</Table.Td><Table.Td>{i.project}<Text size="xs" c="dimmed">{i.site}</Text></Table.Td><Table.Td>{i.issuedTo}</Table.Td><Table.Td ta="right">{num(i.qty)}</Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer>}
        <Text size="xs" c="dimmed" p="xs">Issue fields are placeholders. How material is issued is not decided yet.</Text></Paper>
    </SimpleGrid>
  </Stack>
}

function PurchaseTab({ purchases }: { purchases: Purchase[] }) {
  const [open, setOpen] = useState(false)
  const sorted = [...purchases].sort(byDateDesc)
  return <Stack gap="sm">
    <Group justify="space-between"><div><Text fw={700} size="sm">Purchases</Text><Text size="xs" c="dimmed">Latest first - {sorted.length} entries</Text></div>
      <Button leftSection={<Plus size={14} />} onClick={() => setOpen(true)}>Purchase</Button></Group>
    <Paper withBorder>
      <Table.ScrollContainer minWidth={820}><Table highlightOnHover><Table.Thead><Table.Tr><Table.Th>Date</Table.Th><Table.Th>Material type</Table.Th><Table.Th>Vendor</Table.Th><Table.Th ta="right">Qty</Table.Th><Table.Th ta="right">Rate</Table.Th><Table.Th ta="right">Amount</Table.Th><Table.Th ta="right">GST</Table.Th><Table.Th ta="right">Total</Table.Th></Table.Tr></Table.Thead>
        <Table.Tbody>{sorted.map(p => { const c = calc(p.qty, p.rate, p.gst); return <Table.Tr key={p.id}><Table.Td>{fmtDate(p.date)}</Table.Td><Table.Td fw={600}>{p.material}</Table.Td><Table.Td>{p.vendor}<Text size="xs" c="dimmed">{p.vendorMobile}</Text></Table.Td>
          <Table.Td ta="right">{num(p.qty)} {p.uom}</Table.Td><Table.Td ta="right">{inr(p.rate)}</Table.Td><Table.Td ta="right">{inr(c.subtotal)}</Table.Td><Table.Td ta="right">{inr(c.gstAmount)} <Text span size="xs" c="dimmed">({p.gst}%)</Text></Table.Td><Table.Td ta="right" fw={700}>{inr(c.total)}</Table.Td></Table.Tr> })}</Table.Tbody></Table></Table.ScrollContainer></Paper>
    <Modal opened={open} onClose={() => setOpen(false)} size="lg" title="Purchase material"><PurchaseForm onDone={() => setOpen(false)} /></Modal>
  </Stack>
}

function PurchaseForm({ onDone }: { onDone: () => void }) {
  const { materialTypes, vendors } = useMaterialStore()
  const [date, setDate] = useState(today()), [material, setMaterial] = useState(''), [uom, setUom] = useState(''), [vendor, setVendor] = useState(''), [mobile, setMobile] = useState('')
  const [qty, setQty] = useState<number | string>(''), [rate, setRate] = useState<number | string>(''), [gst, setGst] = useState('18')
  const existingMaterial = findMaterial(material), existingVendor = findVendor(vendor)
  const newMaterial = !!material.trim() && !existingMaterial, newVendor = !!vendor.trim() && !existingVendor
  const pickMaterial = (v: string) => { setMaterial(v); const m = findMaterial(v); if (m) setUom(m.uom) }
  const pickVendor = (v: string) => { setVendor(v); const m = findVendor(v); setMobile(m ? m.mobile : '') }
  const q = Number(qty) || 0, r = Number(rate) || 0
  const t = calc(q, r, Number(gst))
  const valid = material.trim() && uom && vendor.trim() && /^\d{10}$/.test(mobile) && q > 0 && r > 0
  const save = () => {
    addPurchase({ date, material: material.trim(), uom, vendor: vendor.trim(), vendorMobile: mobile, qty: q, rate: r, gst: Number(gst) })
    notifications.show({ color: 'green', title: 'Added to sample list', message: 'Preview only - not saved to any database.' })
    onDone()
  }
  return <Stack gap="sm">
    <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs">
      <TextInput size="xs" type="date" label="Purchase date" required value={date} onChange={e => setDate(e.currentTarget.value)} />
      <div />
      <CreatableSelect label="Material type" required placeholder="Search or add, e.g. Solar Panel" options={materialTypes.map(m => m.name)} value={material} onChange={pickMaterial} createLabel="Create material type" />
      <NativeSelect size="xs" label="Unit of measurement" required value={uom} onChange={e => setUom(e.currentTarget.value)} disabled={!!existingMaterial} data={[{ value: '', label: 'Select unit' }, ...UOMS.map(u => ({ value: u, label: u }))]}
        description={newMaterial ? 'New material type will be created' : existingMaterial ? 'Filled from material type' : undefined} />
      <CreatableSelect label="Vendor" required placeholder="Search or add vendor" options={vendors.map(v => v.name)} value={vendor} onChange={pickVendor} createLabel="Create vendor" />
      <TextInput size="xs" label="Vendor mobile" required value={mobile} inputMode="numeric" maxLength={10} disabled={!!existingVendor} onChange={e => setMobile(e.currentTarget.value.replace(/\D/g, ''))} placeholder="10-digit mobile"
        description={newVendor ? 'New vendor will be created' : existingVendor ? 'Filled from vendor' : undefined} error={mobile && mobile.length !== 10 ? 'Enter 10 digits' : undefined} />
      <NumberInput size="xs" label={`Quantity${uom ? ` (${uom})` : ''}`} required min={0} decimalScale={3} value={qty} onChange={setQty} placeholder="0" hideControls />
      <NumberInput size="xs" label={`Rate${uom ? ` per ${uom}` : ''} (excl. GST)`} required min={0} decimalScale={2} value={rate} onChange={setRate} placeholder="0.00" hideControls leftSection={'\u20B9'} />
      <NativeSelect size="xs" label="GST %" value={gst} onChange={e => setGst(e.currentTarget.value)} data={GST_RATES.map(g => ({ value: String(g), label: `${g}%` }))} />
    </SimpleGrid>
    <Paper withBorder p="xs" bg="gray.0"><Group justify="space-between" wrap="wrap">
      <div><Text size="xs" c="dimmed">Amount (qty x rate)</Text><Text fw={600}>{inr(t.subtotal)}</Text></div><div><Text size="xs" c="dimmed">GST ({gst}%)</Text><Text fw={600}>{inr(t.gstAmount)}</Text></div><div><Text size="xs" c="dimmed">Total amount</Text><Text fw={700} size="lg" c="orange.8">{inr(t.total)}</Text></div></Group></Paper>
    <Group justify="flex-end"><Button variant="default" onClick={onDone}>Cancel</Button><Button leftSection={<Plus size={14} />} disabled={!valid} onClick={save}>Save purchase</Button></Group>
  </Stack>
}
