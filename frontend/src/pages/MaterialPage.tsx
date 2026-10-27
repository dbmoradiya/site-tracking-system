import { Accordion, Alert, Badge, Button, Collapse, Drawer, FileInput, Group, Modal, NativeSelect, NumberInput, Paper, ScrollArea, SimpleGrid, Stack, Table, Tabs, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, FileText, Filter, History, Info, Package, Pencil, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { CreatableSelect } from '../preview/CreatableSelect'
import { ExportMenu } from '../preview/ExportMenu'
import { GST_RATES, UOMS, calc, docTotals, fmtDate, inr, num, type Invoice, type Issue, type Line, type Purchase, type PurchaseVersion, type Snapshot } from '../preview/materialMock'
import { addPurchase, deletePurchase, findMaterial, findVendor, nextPurchaseId, updatePurchase, useMaterialStore } from '../preview/materialStore'

const today = () => new Date().toISOString().slice(0, 10)
const byDateDesc = <T extends { date: string; id: number }>(a: T, b: T) => b.date.localeCompare(a.date) || b.id - a.id
const itemsLabel = (p: { items: Line[] }) => p.items.length === 1 ? p.items[0].material : `${p.items[0].material} +${p.items.length - 1} more`

export function MaterialPage() {
  const [tab, setTab] = useState<string | null>('stock')
  const { purchases, issues } = useMaterialStore()
  const [detail, setDetail] = useState<string | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  // Clicking a purchase anywhere (stock history or Purchase tab) opens the same dialog on the Purchase tab.
  const openPurchase = (id: number) => { setDetail(null); setTab('purchase'); setOpenId(id) }
  return <Stack gap="sm" className="page-compact">
    <Group justify="space-between" align="flex-end"><div><Text size="xs" fw={700} c="orange.8" tt="uppercase">Inventory</Text><Title order={2}>Material</Title></div>
      <Badge color="gray" variant="light">UI preview - sample data</Badge></Group>
    <Alert color="orange" variant="light" p="xs" icon={<Info size={16} aria-hidden="true" />}>Preview only. Everything here is sample data held in the browser and lost on reload. Stock, purchase and issue logic is not built yet.</Alert>
    <Tabs value={tab} onChange={setTab} keepMounted={false}>
      <Tabs.List><Tabs.Tab value="stock" leftSection={<Package size={14} aria-hidden="true" />}>Current stock</Tabs.Tab>
        <Tabs.Tab value="purchase" leftSection={<ShoppingCart size={14} aria-hidden="true" />}>Purchase</Tabs.Tab></Tabs.List>
      <Tabs.Panel value="stock" pt="sm"><StockTab purchases={purchases} issues={issues} onOpen={setDetail} /></Tabs.Panel>
      <Tabs.Panel value="purchase" pt="sm"><PurchaseTab purchases={purchases} onOpen={openPurchase} /></Tabs.Panel>
    </Tabs>
    <Drawer opened={!!detail} onClose={() => setDetail(null)} position="right" size="min(960px, 100%)" title={<Text fw={700}>{detail} - stock detail</Text>}>
      {detail && <StockDetail material={detail} purchases={purchases} issues={issues} onOpenPurchase={openPurchase} />}
    </Drawer>
    <PurchaseDialog id={openId} onClose={() => setOpenId(null)} />
  </Stack>
}

function stockRows(purchases: Purchase[], issues: Issue[]) {
  const map = new Map<string, { material: string; uom: string; bought: number; issued: number; lastPurchase: string }>()
  for (const p of purchases) for (const l of p.items) {
    const r = map.get(l.material) ?? { material: l.material, uom: l.uom, bought: 0, issued: 0, lastPurchase: p.date }
    r.bought += l.qty; if (p.date > r.lastPurchase) r.lastPurchase = p.date; map.set(l.material, r)
  }
  for (const i of issues) { const r = map.get(i.material); if (r) r.issued += i.qty }
  return [...map.values()].map(r => ({ ...r, stock: r.bought - r.issued })).sort((a, b) => a.material.localeCompare(b.material))
}

function StockTab({ purchases, issues, onOpen }: { purchases: Purchase[]; issues: Issue[]; onOpen: (m: string) => void }) {
  const [q, setQ] = useState('')
  const rows = useMemo(() => stockRows(purchases, issues).filter(r => r.material.toLowerCase().includes(q.toLowerCase())), [purchases, issues, q])
  return <Stack gap="xs">
    <Group gap="xs"><TextInput aria-label="Search material types" style={{ flex: '1 1 220px' }} size="xs" leftSection={<Search size={14} />} value={q} onChange={e => setQ(e.currentTarget.value)} placeholder="Search material types" /><Text size="xs" c="dimmed">{rows.length} material types</Text>
      <ExportMenu filename="current-stock" note={q ? 'as filtered by search' : 'all'} table={{ sheet: 'Current stock', headers: ['Material type', 'UOM', 'Purchased', 'Issued', 'Current stock', 'Last purchase'], rows: rows.map(r => [r.material, r.uom, r.bought, r.issued, r.stock, fmtDate(r.lastPurchase)]) }} /></Group>
    <Paper withBorder><Table.ScrollContainer minWidth={640}><Table highlightOnHover>
      <Table.Thead><Table.Tr><Table.Th>Material type</Table.Th><Table.Th>UOM</Table.Th><Table.Th ta="right">Purchased</Table.Th><Table.Th ta="right">Issued</Table.Th><Table.Th ta="right">Current stock</Table.Th><Table.Th>Last purchase</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>{rows.map(r => <Table.Tr key={r.material} style={{ cursor: 'pointer' }} tabIndex={0} onClick={() => onOpen(r.material)} onKeyDown={e => e.key === 'Enter' && onOpen(r.material)} aria-label={`Open ${r.material} detail`}>
        <Table.Td fw={600}>{r.material}</Table.Td><Table.Td>{r.uom}</Table.Td><Table.Td ta="right">{num(r.bought)}</Table.Td><Table.Td ta="right">{num(r.issued)}</Table.Td>
        <Table.Td ta="right"><Badge color="gray" variant="light" size="md">{num(r.stock)} {r.uom}</Badge></Table.Td><Table.Td>{fmtDate(r.lastPurchase)}</Table.Td>
      </Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></Paper>
    <Text size="xs" c="dimmed">Click a row to see purchase history (left) and issued history (right). Sample data.</Text>
  </Stack>
}

function StockDetail({ material, purchases, issues: allIssues, onOpenPurchase }: { material: string; purchases: Purchase[]; issues: Issue[]; onOpenPurchase: (id: number) => void }) {
  // One row per purchase that contains this material; qty and total are for this material's line only.
  const bought = purchases.filter(p => p.items.some(l => l.material === material)).sort(byDateDesc).map(p => ({ p, lines: p.items.filter(l => l.material === material) }))
  const issued = allIssues.filter(i => i.material === material).sort(byDateDesc)
  const uom = bought[0]?.lines[0].uom ?? ''
  const lineQty = (ls: Line[]) => ls.reduce((s, l) => s + l.qty, 0), lineTotal = (ls: Line[]) => ls.reduce((s, l) => s + calc(l.qty, l.rate, l.gst).total, 0)
  const tb = bought.reduce((s, b) => s + lineQty(b.lines), 0), ti = issued.reduce((s, i) => s + i.qty, 0)
  return <Stack gap="sm">
    <SimpleGrid cols={3} spacing="xs">
      <Paper withBorder p="xs"><Text size="xs" c="dimmed">Purchased</Text><Text fw={700}>{num(tb)} {uom}</Text></Paper>
      <Paper withBorder p="xs"><Text size="xs" c="dimmed">Issued</Text><Text fw={700}>{num(ti)} {uom}</Text></Paper>
      <Paper withBorder p="xs"><Text size="xs" c="dimmed">Current stock</Text><Text fw={700} c="green.8">{num(tb - ti)} {uom}</Text></Paper>
    </SimpleGrid>
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm" style={{ alignItems: 'start' }}>
      <Paper withBorder><Group gap={6} p="xs" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}><ArrowDownToLine size={14} aria-hidden="true" /><Text fw={700} size="sm">Purchase history</Text><div style={{ marginLeft: 'auto' }}><ExportMenu filename={`${material}-purchase-history`} table={{ sheet: 'Purchase history', headers: ['Purchase ID', 'Bill number', 'Date', 'Vendor', 'Vendor mobile', 'Qty', 'UOM', 'Rate', 'GST % (total)', 'Amount', 'SGST', 'CGST', 'Total'], rows: bought.flatMap(({ p, lines }) => lines.map(l => { const c = calc(l.qty, l.rate, l.gst); return [p.purchaseId, p.billNumber, fmtDate(p.date), p.vendor, p.vendorMobile, l.qty, l.uom, l.rate, l.gst, c.subtotal, c.sgst, c.cgst, c.total] })) }} /></div></Group>
        <Table.ScrollContainer minWidth={460}><Table><Table.Thead><Table.Tr><Table.Th>Purchase ID</Table.Th><Table.Th>Date</Table.Th><Table.Th>Vendor</Table.Th><Table.Th ta="right">Qty</Table.Th><Table.Th ta="right">Total</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{bought.map(({ p, lines }) => <Table.Tr key={p.id} style={{ cursor: 'pointer' }} tabIndex={0} aria-label={`Open purchase ${p.purchaseId}`} onClick={() => onOpenPurchase(p.id)} onKeyDown={e => e.key === 'Enter' && onOpenPurchase(p.id)}><Table.Td fw={600} c="orange.8">{p.purchaseId}{p.items.length > 1 && <Text size="xs" c="dimmed" fw={400}>{p.items.length} items in purchase</Text>}</Table.Td><Table.Td>{fmtDate(p.date)}</Table.Td><Table.Td>{p.vendor}</Table.Td><Table.Td ta="right">{num(lineQty(lines))}</Table.Td><Table.Td ta="right">{inr(lineTotal(lines))}</Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer>
        <Text size="xs" c="dimmed" p="xs">Qty and total are for this material only, not the whole purchase.</Text></Paper>
      <Paper withBorder><Group gap={6} p="xs" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}><ArrowUpFromLine size={14} aria-hidden="true" /><Text fw={700} size="sm">Issued history</Text><div style={{ marginLeft: 'auto' }}><ExportMenu filename={`${material}-issued-history`} table={{ sheet: 'Issued history', headers: ['Date', 'Project', 'Site', 'Issued to', 'Qty', 'UOM'], rows: issued.map(i => [fmtDate(i.date), i.project, i.site, i.issuedTo, i.qty, uom]) }} /></div></Group>
        {issued.length === 0 ? <Text size="sm" c="dimmed" p="sm">Nothing issued yet.</Text> :
          <Table.ScrollContainer minWidth={380}><Table><Table.Thead><Table.Tr><Table.Th>Date</Table.Th><Table.Th>Project / Site</Table.Th><Table.Th>Issued to</Table.Th><Table.Th ta="right">Qty</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>{issued.map(i => <Table.Tr key={i.id}><Table.Td>{fmtDate(i.date)}</Table.Td><Table.Td>{i.project}<Text size="xs" c="dimmed">{i.site}</Text></Table.Td><Table.Td>{i.issuedTo}</Table.Td><Table.Td ta="right">{num(i.qty)}</Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer>}
        <Text size="xs" c="dimmed" p="xs">Issue fields are placeholders. How material is issued (or sold) is not decided yet.</Text></Paper>
    </SimpleGrid>
  </Stack>
}

function PurchaseTab({ purchases, onOpen }: { purchases: Purchase[]; onOpen: (id: number) => void }) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [vendorF, setVendorF] = useState(''), [materialF, setMaterialF] = useState(''), [idF, setIdF] = useState(''), [billF, setBillF] = useState('')
  const vendorNames = [...new Set(purchases.map(p => p.vendor))].sort(), materialNames = [...new Set(purchases.flatMap(p => p.items.map(l => l.material)))].sort()
  // Material filter keeps every purchase that contains that material (whole purchase shown).
  const sorted = [...purchases].filter(p => (!from || p.date >= from) && (!to || p.date <= to) && (!vendorF || p.vendor === vendorF) && (!materialF || p.items.some(l => l.material === materialF)) && (!idF.trim() || p.purchaseId.toLowerCase().includes(idF.trim().toLowerCase())) && (!billF.trim() || (p.billNumber || '').toLowerCase().includes(billF.trim().toLowerCase()))).sort(byDateDesc)
  const active = [from, to, vendorF, materialF, idF.trim(), billF.trim()].filter(Boolean).length
  const [showFilters, setShowFilters] = useState(false)
  const chips = [from && `From ${fmtDate(from)}`, to && `To ${fmtDate(to)}`, vendorF && `Vendor: ${vendorF}`, materialF && `Material: ${materialF}`, idF.trim() && `Purchase ID: ${idF.trim()}`, billF.trim() && `Bill no.: ${billF.trim()}`].filter(Boolean) as string[]
  const clear = () => { setFrom(''); setTo(''); setVendorF(''); setMaterialF(''); setIdF(''); setBillF('') }
  const lineRows = sorted.flatMap(p => p.items.map(l => { const c = calc(l.qty, l.rate, l.gst); return [p.purchaseId, p.billNumber, fmtDate(p.date), p.vendor, p.vendorMobile, l.material, l.qty, l.uom, l.rate, l.gst, c.subtotal, c.sgst, c.cgst, c.total] }))
  return <Stack gap="sm">
    <Group justify="space-between"><div><Text fw={700} size="sm">Purchases</Text><Text size="xs" c="dimmed">Latest first - {sorted.length} of {purchases.length} purchases</Text></div>
      <Group gap="xs"><ExportMenu filename="purchases" note={`${sorted.length} purchases, one row per item line${active ? ', filtered only' : ''}`} table={{ sheet: 'Purchases', headers: ['Purchase ID', 'Bill number', 'Date', 'Vendor', 'Vendor mobile', 'Material type', 'Qty', 'UOM', 'Rate', 'GST % (total)', 'Amount', 'SGST', 'CGST', 'Line total'], rows: lineRows }} /><Button variant={active ? 'filled' : 'default'} leftSection={<Filter size={14} />} onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters}>Filters{active ? ` (${active})` : ''}</Button>
        <Button leftSection={<Plus size={14} />} onClick={() => setOpen(true)}>Purchase</Button></Group></Group>
    {!showFilters && active > 0 && <Group gap={6}>{chips.map(c => <Badge key={c} variant="light" color="orange" size="md" tt="none">{c}</Badge>)}<Button size="compact-xs" variant="subtle" onClick={clear}>Clear filters</Button></Group>}
    <Collapse expanded={showFilters}><Paper withBorder p="xs"><SimpleGrid cols={{ base: 2, md: 4 }} spacing="xs" style={{ alignItems: 'end' }}>
      <TextInput size="xs" label="Purchase ID" placeholder="e.g. SE261022" value={idF} onChange={e => setIdF(e.currentTarget.value)} />
      <TextInput size="xs" label="Bill number" placeholder="e.g. JS/2410" value={billF} onChange={e => setBillF(e.currentTarget.value)} />
      <TextInput size="xs" type="date" label="Date from" value={from} onChange={e => setFrom(e.currentTarget.value)} />
      <TextInput size="xs" type="date" label="Date to" value={to} onChange={e => setTo(e.currentTarget.value)} />
      <NativeSelect size="xs" label="Vendor" value={vendorF} onChange={e => setVendorF(e.currentTarget.value)} data={[{ value: '', label: 'All vendors' }, ...vendorNames.map(v => ({ value: v, label: v }))]} />
      <NativeSelect size="xs" label="Material type (any item)" value={materialF} onChange={e => setMaterialF(e.currentTarget.value)} data={[{ value: '', label: 'All material types' }, ...materialNames.map(m => ({ value: m, label: m }))]} />
      <Button size="xs" variant="subtle" onClick={clear} disabled={!active}>Clear filters{active ? ` (${active})` : ''}</Button>
    </SimpleGrid></Paper></Collapse>
    <Paper withBorder>
      <Table.ScrollContainer minWidth={1000}><Table highlightOnHover><Table.Thead><Table.Tr><Table.Th>Purchase ID</Table.Th><Table.Th>Date</Table.Th><Table.Th>Items</Table.Th><Table.Th>Bill no.</Table.Th><Table.Th>Vendor</Table.Th><Table.Th ta="right">Amount</Table.Th><Table.Th ta="right">SGST</Table.Th><Table.Th ta="right">CGST</Table.Th><Table.Th ta="right">Total</Table.Th></Table.Tr></Table.Thead>
        <Table.Tbody>{sorted.length === 0 && <Table.Tr><Table.Td colSpan={9}><Text size="sm" c="dimmed" ta="center" py="sm">No purchases match these filters.</Text></Table.Td></Table.Tr>}{sorted.map(p => { const t = docTotals(p.items); return <Table.Tr key={p.id} style={{ cursor: 'pointer' }} tabIndex={0} aria-label={`Open purchase ${p.purchaseId}`} onClick={() => onOpen(p.id)} onKeyDown={e => e.key === 'Enter' && onOpen(p.id)}>
          <Table.Td fw={600} c="orange.8">{p.purchaseId}</Table.Td><Table.Td>{fmtDate(p.date)}</Table.Td>
          <Table.Td><Text size="sm" fw={600}>{itemsLabel(p)}</Text><Text size="xs" c="dimmed">{p.items.length} {p.items.length === 1 ? 'item' : 'items'}</Text></Table.Td>
          <Table.Td>{p.billNumber || <Text span c="dimmed">-</Text>}{p.invoice && <FileText size={12} style={{ marginLeft: 4, verticalAlign: 'middle' }} aria-label="Has invoice" />}</Table.Td>
          <Table.Td>{p.vendor}<Text size="xs" c="dimmed">{p.vendorMobile}</Text></Table.Td>
          <Table.Td ta="right">{inr(t.subtotal)}</Table.Td><Table.Td ta="right">{inr(t.sgst)}</Table.Td><Table.Td ta="right">{inr(t.cgst)}</Table.Td><Table.Td ta="right" fw={700}>{inr(t.total)}</Table.Td></Table.Tr> })}</Table.Tbody></Table></Table.ScrollContainer></Paper>
    <Modal opened={open} onClose={() => setOpen(false)} size="xl" title="Purchase material" scrollAreaComponent={ScrollArea.Autosize}><PurchaseForm onDone={() => setOpen(false)} /></Modal>
  </Stack>
}

type Row = { key: number; material: string; uom: string; qty: number | string; rate: number | string; gst: string }
let rowKey = 0
const blankRow = (): Row => ({ key: ++rowKey, material: '', uom: '', qty: '', rate: '', gst: '18' })

function PurchaseForm({ onDone, existing }: { onDone: () => void; existing?: Purchase }) {
  const { materialTypes, vendors } = useMaterialStore()
  const [date, setDate] = useState(existing?.date ?? today()), [vendor, setVendor] = useState(existing?.vendor ?? ''), [mobile, setMobile] = useState(existing?.vendorMobile ?? '')
  const [rows, setRows] = useState<Row[]>(() => existing ? existing.items.map(l => ({ key: ++rowKey, material: l.material, uom: l.uom, qty: l.qty, rate: l.rate, gst: String(l.gst) })) : [blankRow()])
  const [bill, setBill] = useState(existing?.billNumber ?? ''), [invoice, setInvoice] = useState<Invoice | undefined>(existing?.invoice), [fileError, setFileError] = useState('')
  const existingVendor = findVendor(vendor), newVendor = !!vendor.trim() && !existingVendor
  const pickVendor = (v: string) => { setVendor(v); const m = findVendor(v); setMobile(m ? m.mobile : '') }
  const patch = (key: number, d: Partial<Row>) => setRows(rs => rs.map(r => r.key === key ? { ...r, ...d } : r))
  const pickMaterial = (key: number, v: string) => { const m = findMaterial(v); patch(key, { material: v, ...(m ? { uom: m.uom } : {}) }) }
  const items = rows.map(r => ({ r, c: calc(Number(r.qty) || 0, Number(r.rate) || 0, Number(r.gst)) }))
  const grand = docTotals(rows.map(r => ({ material: r.material, uom: r.uom, qty: Number(r.qty) || 0, rate: Number(r.rate) || 0, gst: Number(r.gst) })))
  const rowOk = (r: Row) => r.material.trim() && r.uom && Number(r.qty) > 0 && Number(r.rate) > 0
  const valid = date && vendor.trim() && /^\d{10}$/.test(mobile) && rows.length > 0 && rows.every(rowOk)
  const pickFile = (f: File | null) => {
    setFileError(''); if (!f) return
    if (!(f.type === 'application/pdf' || f.type.startsWith('image/'))) { setFileError('Only PDF or image files'); return }
    if (f.size > 5 * 1024 * 1024) { setFileError('Max 5 MB in this preview'); return }
    setInvoice({ name: f.name, type: f.type, url: URL.createObjectURL(f) })
  }
  const save = () => {
    const data: Snapshot = { date, vendor: vendor.trim(), vendorMobile: mobile, billNumber: bill.trim(), invoice, items: rows.map(r => ({ material: r.material.trim(), uom: r.uom, qty: Number(r.qty), rate: Number(r.rate), gst: Number(r.gst) })) }
    if (existing) { updatePurchase(existing.id, data); notifications.show({ color: 'green', title: `${existing.purchaseId} updated`, message: 'Preview only - not saved to any database.' }) }
    else { addPurchase(data); notifications.show({ color: 'green', title: 'Added to sample list', message: 'Preview only - not saved to any database.' }) }
    onDone()
  }
  return <Stack gap="sm">
    <Paper withBorder p="xs" bg="gray.0"><Text size="xs" c="dimmed">Purchase ID</Text><Text fw={700}>{existing ? existing.purchaseId : `${nextPurchaseId(date)} (generated on save)`}</Text>
      {existing && <Text size="xs" c="dimmed">The ID does not change when a purchase is edited.</Text>}</Paper>
    <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs">
      <TextInput size="xs" type="date" label="Purchase date" required value={date} onChange={e => setDate(e.currentTarget.value)} />
      <TextInput size="xs" label="Bill number" value={bill} onChange={e => setBill(e.currentTarget.value)} placeholder="Vendor bill / invoice no." />
      <CreatableSelect label="Vendor" required placeholder="Search or add vendor" options={vendors.map(v => v.name)} value={vendor} onChange={pickVendor} createLabel="Create vendor" />
      <TextInput size="xs" label="Vendor mobile" required value={mobile} inputMode="numeric" maxLength={10} disabled={!!existingVendor} onChange={e => setMobile(e.currentTarget.value.replace(/\D/g, ''))} placeholder="10-digit mobile"
        description={newVendor ? 'New vendor will be created' : existingVendor ? 'Filled from vendor' : undefined} error={mobile && mobile.length !== 10 ? 'Enter 10 digits' : undefined} />
    </SimpleGrid>
    <div>
      <Group justify="space-between" mb={4}><Text fw={700} size="sm">Items ({rows.length})</Text><Button size="compact-sm" variant="light" leftSection={<Plus size={14} />} onClick={() => setRows(rs => [...rs, blankRow()])}>Add item</Button></Group>
      <Stack gap="xs">{items.map(({ r, c }, i) => {
        const em = findMaterial(r.material), nm = !!r.material.trim() && !em
        return <Paper withBorder p="xs" key={r.key} aria-label={`Item ${i + 1}`}>
          <SimpleGrid cols={{ base: 2, sm: 6 }} spacing="xs" style={{ alignItems: 'start' }}>
            <div style={{ gridColumn: 'span 2' }}><CreatableSelect label={`Item ${i + 1} - material type`} required placeholder="Search or add, e.g. Solar Panel" options={materialTypes.map(m => m.name)} value={r.material} onChange={v => pickMaterial(r.key, v)} createLabel="Create material type" /></div>
            <NativeSelect size="xs" label="Unit" required value={r.uom} onChange={e => patch(r.key, { uom: e.currentTarget.value })} disabled={!!em} data={[{ value: '', label: 'Select' }, ...UOMS.map(u => ({ value: u, label: u }))]} description={nm ? 'New type' : em ? 'From type' : undefined} />
            <NumberInput size="xs" label="Quantity" required min={0} decimalScale={3} value={r.qty} onChange={v => patch(r.key, { qty: v })} placeholder="0" hideControls />
            <NumberInput size="xs" label="Rate (excl. GST)" required min={0} decimalScale={2} value={r.rate} onChange={v => patch(r.key, { rate: v })} placeholder="0.00" hideControls leftSection={'\u20B9'} />
            <NativeSelect size="xs" label="GST %" value={r.gst} onChange={e => patch(r.key, { gst: e.currentTarget.value })} data={GST_RATES.map(g => ({ value: String(g), label: `${g}%` }))} />
          </SimpleGrid>
          <Group justify="space-between" mt={6}><Text size="xs" c="dimmed">Amount {inr(c.subtotal)} + SGST {inr(c.sgst)} ({Number(r.gst) / 2}%) + CGST {inr(c.cgst)} ({Number(r.gst) / 2}%) = <b>{inr(c.total)}</b></Text>
            <Button size="compact-xs" variant="subtle" color="red" leftSection={<Trash2 size={12} />} disabled={rows.length === 1} onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))} aria-label={`Remove item ${i + 1}`}>Remove</Button></Group>
        </Paper> })}</Stack>
    </div>
    <div>
      <FileInput size="xs" label="Invoice (PDF or image) - one per purchase" placeholder={invoice ? 'Choose another file to replace' : 'Upload invoice'} accept="application/pdf,image/*" value={null} onChange={pickFile} clearable={false} error={fileError || undefined} />
      {invoice && <Group gap={6} mt={4}><FileText size={14} aria-hidden="true" /><Text size="xs" lineClamp={1} style={{ flex: 1 }}>{invoice.name}</Text><Button size="compact-xs" variant="subtle" color="red" onClick={() => setInvoice(undefined)}>Remove</Button></Group>}
    </div>
    <Paper withBorder p="xs" bg="gray.0"><Group justify="space-between" wrap="wrap">
      <div><Text size="xs" c="dimmed">Amount (all items)</Text><Text fw={600}>{inr(grand.subtotal)}</Text></div><div><Text size="xs" c="dimmed">SGST</Text><Text fw={600}>{inr(grand.sgst)}</Text></div><div><Text size="xs" c="dimmed">CGST</Text><Text fw={600}>{inr(grand.cgst)}</Text></div><div><Text size="xs" c="dimmed">Grand total (amount + SGST + CGST)</Text><Text fw={700} size="lg" c="orange.8">{inr(grand.total)}</Text></div></Group></Paper>
    <Group justify="flex-end" style={{ position: 'sticky', bottom: 0, background: 'var(--mantine-color-body)', padding: '8px 0', borderTop: '1px solid var(--mantine-color-gray-3)', zIndex: 2 }}><Button variant="default" onClick={onDone}>Cancel</Button><Button leftSection={existing ? <Pencil size={14} /> : <Plus size={14} />} disabled={!valid} onClick={save}>{existing ? 'Save changes' : 'Save purchase'}</Button></Group>
  </Stack>
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div><Text size="xs" c="dimmed">{label}</Text><Text size="sm" fw={600} component="div">{children}</Text></div> }

function ItemsTable({ items }: { items: Line[] }) {
  const t = docTotals(items)
  return <Paper withBorder><Table.ScrollContainer minWidth={560}><Table fz="xs"><Table.Thead><Table.Tr><Table.Th>Item</Table.Th><Table.Th ta="right">Qty</Table.Th><Table.Th ta="right">Rate</Table.Th><Table.Th ta="right">GST</Table.Th><Table.Th ta="right">Amount</Table.Th><Table.Th ta="right">SGST</Table.Th><Table.Th ta="right">CGST</Table.Th><Table.Th ta="right">Total</Table.Th></Table.Tr></Table.Thead>
    <Table.Tbody>{items.map((l, i) => { const c = calc(l.qty, l.rate, l.gst); return <Table.Tr key={i}><Table.Td fw={600}>{l.material}</Table.Td><Table.Td ta="right">{num(l.qty)} {l.uom}</Table.Td><Table.Td ta="right">{inr(l.rate)}</Table.Td><Table.Td ta="right">{l.gst}%</Table.Td><Table.Td ta="right">{inr(c.subtotal)}</Table.Td><Table.Td ta="right">{inr(c.sgst)}</Table.Td><Table.Td ta="right">{inr(c.cgst)}</Table.Td><Table.Td ta="right" fw={700}>{inr(c.total)}</Table.Td></Table.Tr> })}
      <Table.Tr bg="gray.0"><Table.Td colSpan={4} fw={700}>Grand total</Table.Td><Table.Td ta="right" fw={700}>{inr(t.subtotal)}</Table.Td><Table.Td ta="right" fw={700}>{inr(t.sgst)}</Table.Td><Table.Td ta="right" fw={700}>{inr(t.cgst)}</Table.Td><Table.Td ta="right" fw={700} c="orange.8">{inr(t.total)}</Table.Td></Table.Tr></Table.Tbody></Table></Table.ScrollContainer></Paper>
}

// Same dialog is opened from the Purchase tab and from the stock-detail purchase history.
function PurchaseDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { purchases } = useMaterialStore()
  const p = purchases.find(x => x.id === id)
  const [editing, setEditing] = useState(false), [confirm, setConfirm] = useState(false), [viewing, setViewing] = useState(false), [showHistory, setShowHistory] = useState(false)
  const close = () => { setEditing(false); setConfirm(false); setViewing(false); setShowHistory(false); onClose() }
  return <>
    <Modal opened={!!p} onClose={close} closeOnEscape={!viewing && !confirm} size="xl" scrollAreaComponent={ScrollArea.Autosize} title={p ? <Text fw={700}>{editing ? `Edit purchase ${p.purchaseId}` : `Purchase ${p.purchaseId}`}</Text> : ''}>
      {p && (editing ? <PurchaseForm existing={p} onDone={() => setEditing(false)} /> : <Stack gap="sm">
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <Field label="Purchase ID">{p.purchaseId}</Field><Field label="Purchase date">{fmtDate(p.date)}</Field>
          <Field label="Vendor">{p.vendor}</Field><Field label="Vendor mobile">{p.vendorMobile}</Field>
          <Field label="Bill number">{p.billNumber || '-'}</Field>
        </SimpleGrid>
        <div><Text size="xs" c="dimmed" mb={4}>Items ({p.items.length})</Text><ItemsTable items={p.items} /></div>
        <Group justify="space-between" align="center"><div><Text size="xs" c="dimmed">Invoice</Text><Text size="sm" fw={600}>{p.invoice ? p.invoice.name : 'No invoice uploaded'}</Text></div>
          <Button variant="default" leftSection={<FileText size={14} />} disabled={!p.invoice} onClick={() => setViewing(true)}>View invoice</Button></Group>
        <Group justify="space-between" mt="xs"><Button color="red" variant="light" leftSection={<Trash2 size={14} />} onClick={() => setConfirm(true)}>Delete</Button>
          <Group><Button variant="default" onClick={close}>Close</Button><Button leftSection={<Pencil size={14} />} onClick={() => setEditing(true)}>Edit</Button></Group></Group>
        <div style={{ borderTop: '1px solid var(--mantine-color-gray-3)', paddingTop: 8 }}>
          <Button variant="subtle" size="compact-sm" leftSection={<History size={14} />} rightSection={<ChevronDown size={14} style={{ transform: showHistory ? 'rotate(180deg)' : undefined }} />} onClick={() => setShowHistory(v => !v)} aria-expanded={showHistory}>
            Edit history ({p.versions.length} earlier {p.versions.length === 1 ? 'version' : 'versions'})</Button>
          <Collapse expanded={showHistory}><VersionHistory p={p} /></Collapse>
        </div>
      </Stack>)}
    </Modal>
    <Modal opened={viewing && !!p?.invoice} onClose={() => setViewing(false)} size="xl" title={p?.invoice?.name ?? 'Invoice'} zIndex={400}>
      {p?.invoice && (p.invoice.type === 'application/pdf'
        ? <div><iframe title="Invoice PDF" src={p.invoice.url} style={{ width: '100%', height: '70vh', border: '1px solid var(--mantine-color-gray-3)' }} /><Text size="xs" c="dimmed" mt={4}>If the PDF does not show on your device, <a href={p.invoice.url} target="_blank" rel="noreferrer">open it in a new tab</a>.</Text></div>
        : <img src={p.invoice.url} alt={`Invoice ${p.billNumber || p.purchaseId}`} style={{ maxWidth: '100%', maxHeight: '70vh', display: 'block', margin: '0 auto' }} />)}
    </Modal>
    <Modal opened={confirm && !!p} onClose={() => setConfirm(false)} title="Delete this purchase?" zIndex={400} size="sm">
      {p && <Stack gap="sm"><Text size="sm">Delete purchase <b>{p.purchaseId}</b> ({itemsLabel(p)}, {p.items.length} {p.items.length === 1 ? 'item' : 'items'} from {p.vendor})? Current stock will reduce by the quantity of every item in it. This cannot be undone in this preview.</Text>
        <Group justify="flex-end"><Button variant="default" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button color="red" leftSection={<Trash2 size={14} />} onClick={() => { deletePurchase(p.id); notifications.show({ color: 'red', title: `${p.purchaseId} deleted`, message: 'Preview only - sample data.' }); close() }}>Delete purchase</Button></Group></Stack>}
    </Modal>
  </>
}

const fmtStamp = (iso: string) => { const [d, t] = iso.split('T'); return `${fmtDate(d)} ${t.slice(0, 8)}` }
const lineSig = (l: Line) => `${l.qty} ${l.uom} @ ${inr(l.rate)} GST ${l.gst}%`
// Plain-text changes between an older version and the next newer one. Items are matched by material type.
function changesBetween(older: Snapshot, newer: Snapshot) {
  const out: string[] = []
  const head: [string, string, string][] = [['Date', older.date, newer.date], ['Vendor', older.vendor, newer.vendor], ['Vendor mobile', older.vendorMobile, newer.vendorMobile], ['Bill number', older.billNumber, newer.billNumber]]
  for (const [l, a, b] of head) if (a !== b) out.push(`${l}: ${a || '-'} \u2192 ${b || '-'}`)
  if (older.invoice?.url !== newer.invoice?.url) out.push(`Invoice: ${older.invoice?.name ?? 'none'} \u2192 ${newer.invoice?.name ?? 'none'}`)
  for (const o of older.items) { const n = newer.items.find(x => x.material === o.material); if (!n) out.push(`Item removed: ${o.material} (${lineSig(o)})`); else if (lineSig(o) !== lineSig(n)) out.push(`${o.material}: ${lineSig(o)} \u2192 ${lineSig(n)}`) }
  for (const n of newer.items) if (!older.items.some(x => x.material === n.material)) out.push(`Item added: ${n.material} (${lineSig(n)})`)
  return out
}

// Edit history of ONE purchase document (what was recorded and when). Not the material's purchase transactions list.
function VersionHistory({ p }: { p: Purchase }) {
  const list: PurchaseVersion[] = p.versions // newest first
  return <Stack gap="xs" mt="xs">
    <Text size="xs" c="dimmed">Current version has been active since {fmtStamp(p.activeFrom)}. Earlier versions, newest first:</Text>
    {list.length === 0 ? <Text size="sm">This purchase has not been edited.</Text> :
      <Accordion variant="separated" chevronPosition="left">{list.map((v, i) => {
        const newer: Snapshot = i === 0 ? p : list[i - 1]
        const ch = changesBetween(v, newer)
        return <Accordion.Item key={v.version} value={String(v.version)}>
          <Accordion.Control><Text size="sm" fw={600}>Version {v.version}</Text><Text size="xs" c="dimmed">Active {fmtStamp(v.activeFrom)} to {fmtStamp(v.activeTo)}</Text></Accordion.Control>
          <Accordion.Panel><Stack gap={6}>
            <SimpleGrid cols={2} spacing="xs"><Field label="Date">{fmtDate(v.date)}</Field><Field label="Bill number">{v.billNumber || '-'}</Field><Field label="Vendor">{v.vendor}</Field><Field label="Invoice">{v.invoice ? v.invoice.name : 'None'}</Field></SimpleGrid>
            <ItemsTable items={v.items} />
            <div><Text size="xs" c="dimmed">Replaced by the next version with these changes</Text>{ch.map(x => <Text key={x} size="xs">{x}</Text>)}</div>
          </Stack></Accordion.Panel></Accordion.Item> })}</Accordion>}
    <Text size="xs" c="dimmed">Not decided yet: who made each edit, and whether history is kept or removed when a purchase is deleted.</Text>
  </Stack>
}
