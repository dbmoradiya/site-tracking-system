import { Alert, Badge, Button, Collapse, Drawer, FileInput, Group, Modal, NativeSelect, NumberInput, Paper, SimpleGrid, Stack, Table, Tabs, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { ArrowDownToLine, ArrowUpFromLine, FileText, Filter, Info, Package, Pencil, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ExportMenu } from '../preview/ExportMenu'
import { CreatableSelect } from '../preview/CreatableSelect'
import { GST_RATES, UOMS, calc, fmtDate, inr, num, type Invoice, type Issue, type Purchase } from '../preview/materialMock'
import { addPurchase, deletePurchase, findMaterial, findVendor, nextPurchaseId, updatePurchase, useMaterialStore } from '../preview/materialStore'

const today = () => new Date().toISOString().slice(0, 10)
const byDateDesc = <T extends { date: string; id: number }>(a: T, b: T) => b.date.localeCompare(a.date) || b.id - a.id

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
      <Paper withBorder><Group gap={6} p="xs" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}><ArrowDownToLine size={14} aria-hidden="true" /><Text fw={700} size="sm">Purchase history</Text><div style={{ marginLeft: 'auto' }}><ExportMenu filename={`${material}-purchase-history`} table={{ sheet: 'Purchase history', headers: ['Purchase ID', 'Bill number', 'Date', 'Vendor', 'Vendor mobile', 'Qty', 'UOM', 'Rate', 'GST % (total)', 'Amount', 'SGST', 'CGST', 'Total'], rows: bought.map(p => { const c = calc(p.qty, p.rate, p.gst); return [p.purchaseId, p.billNumber, fmtDate(p.date), p.vendor, p.vendorMobile, p.qty, p.uom, p.rate, p.gst, c.subtotal, c.sgst, c.cgst, c.total] }) }} /></div></Group>
        <Table.ScrollContainer minWidth={460}><Table><Table.Thead><Table.Tr><Table.Th>Purchase ID</Table.Th><Table.Th>Date</Table.Th><Table.Th>Vendor</Table.Th><Table.Th ta="right">Qty</Table.Th><Table.Th ta="right">Total</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{bought.map(p => <Table.Tr key={p.id} style={{ cursor: 'pointer' }} tabIndex={0} aria-label={`Open purchase ${p.purchaseId}`} onClick={() => onOpenPurchase(p.id)} onKeyDown={e => e.key === 'Enter' && onOpenPurchase(p.id)}><Table.Td fw={600} c="orange.8">{p.purchaseId}</Table.Td><Table.Td>{fmtDate(p.date)}</Table.Td><Table.Td>{p.vendor}</Table.Td><Table.Td ta="right">{num(p.qty)}</Table.Td><Table.Td ta="right">{inr(calc(p.qty, p.rate, p.gst).total)}</Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></Paper>
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
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [vendorF, setVendorF] = useState(''), [materialF, setMaterialF] = useState('')
  const vendorNames = [...new Set(purchases.map(p => p.vendor))].sort(), materialNames = [...new Set(purchases.map(p => p.material))].sort()
  const sorted = [...purchases].filter(p => (!from || p.date >= from) && (!to || p.date <= to) && (!vendorF || p.vendor === vendorF) && (!materialF || p.material === materialF)).sort(byDateDesc)
  const active = [from, to, vendorF, materialF].filter(Boolean).length
  const [showFilters, setShowFilters] = useState(false)
  const chips = [from && `From ${fmtDate(from)}`, to && `To ${fmtDate(to)}`, vendorF && `Vendor: ${vendorF}`, materialF && `Material: ${materialF}`].filter(Boolean) as string[]
  const clear = () => { setFrom(''); setTo(''); setVendorF(''); setMaterialF('') }
  return <Stack gap="sm">
    <Group justify="space-between"><div><Text fw={700} size="sm">Purchases</Text><Text size="xs" c="dimmed">Latest first - {sorted.length} of {purchases.length} entries</Text></div>
      <Group gap="xs"><ExportMenu filename="purchases" note={active ? 'filtered rows only' : 'all'} table={{ sheet: 'Purchases', headers: ['Purchase ID', 'Bill number', 'Date', 'Material type', 'Vendor', 'Vendor mobile', 'Qty', 'UOM', 'Rate', 'GST % (total)', 'Amount', 'SGST', 'CGST', 'Total'], rows: sorted.map(p => { const c = calc(p.qty, p.rate, p.gst); return [p.purchaseId, p.billNumber, fmtDate(p.date), p.material, p.vendor, p.vendorMobile, p.qty, p.uom, p.rate, p.gst, c.subtotal, c.sgst, c.cgst, c.total] }) }} /><Button variant={active ? 'filled' : 'default'} leftSection={<Filter size={14} />} onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters}>Filters{active ? ` (${active})` : ''}</Button>
        <Button leftSection={<Plus size={14} />} onClick={() => setOpen(true)}>Purchase</Button></Group></Group>
    {!showFilters && active > 0 && <Group gap={6}>{chips.map(c => <Badge key={c} variant="light" color="orange" size="md" tt="none">{c}</Badge>)}<Button size="compact-xs" variant="subtle" onClick={clear}>Clear filters</Button></Group>}
    <Collapse expanded={showFilters}><Paper withBorder p="xs"><SimpleGrid cols={{ base: 2, md: 5 }} spacing="xs" style={{ alignItems: 'end' }}>
      <TextInput size="xs" type="date" label="Date from" value={from} onChange={e => setFrom(e.currentTarget.value)} />
      <TextInput size="xs" type="date" label="Date to" value={to} onChange={e => setTo(e.currentTarget.value)} />
      <NativeSelect size="xs" label="Vendor" value={vendorF} onChange={e => setVendorF(e.currentTarget.value)} data={[{ value: '', label: 'All vendors' }, ...vendorNames.map(v => ({ value: v, label: v }))]} />
      <NativeSelect size="xs" label="Material type" value={materialF} onChange={e => setMaterialF(e.currentTarget.value)} data={[{ value: '', label: 'All material types' }, ...materialNames.map(m => ({ value: m, label: m }))]} />
      <Button size="xs" variant="subtle" onClick={clear} disabled={!active}>Clear filters{active ? ` (${active})` : ''}</Button>
    </SimpleGrid></Paper></Collapse>
    <Paper withBorder>
      <Table.ScrollContainer minWidth={1100}><Table highlightOnHover><Table.Thead><Table.Tr><Table.Th>Purchase ID</Table.Th><Table.Th>Date</Table.Th><Table.Th>Material type</Table.Th><Table.Th>Bill no.</Table.Th><Table.Th>Vendor</Table.Th><Table.Th ta="right">Qty</Table.Th><Table.Th ta="right">Rate</Table.Th><Table.Th ta="right">Amount</Table.Th><Table.Th ta="right">SGST</Table.Th><Table.Th ta="right">CGST</Table.Th><Table.Th ta="right">Total</Table.Th></Table.Tr></Table.Thead>
        <Table.Tbody>{sorted.length === 0 && <Table.Tr><Table.Td colSpan={11}><Text size="sm" c="dimmed" ta="center" py="sm">No purchases match these filters.</Text></Table.Td></Table.Tr>}{sorted.map(p => { const c = calc(p.qty, p.rate, p.gst); return <Table.Tr key={p.id} style={{ cursor: 'pointer' }} tabIndex={0} aria-label={`Open purchase ${p.purchaseId}`} onClick={() => onOpen(p.id)} onKeyDown={e => e.key === 'Enter' && onOpen(p.id)}><Table.Td fw={600} c="orange.8">{p.purchaseId}</Table.Td><Table.Td>{fmtDate(p.date)}</Table.Td><Table.Td fw={600}>{p.material}</Table.Td><Table.Td>{p.billNumber || <Text span c="dimmed">-</Text>}{p.invoice && <FileText size={12} style={{ marginLeft: 4, verticalAlign: 'middle' }} aria-label="Has invoice" />}</Table.Td><Table.Td>{p.vendor}<Text size="xs" c="dimmed">{p.vendorMobile}</Text></Table.Td>
          <Table.Td ta="right">{num(p.qty)} {p.uom}</Table.Td><Table.Td ta="right">{inr(p.rate)}</Table.Td><Table.Td ta="right">{inr(c.subtotal)}</Table.Td><Table.Td ta="right">{inr(c.sgst)} <Text span size="xs" c="dimmed">({p.gst / 2}%)</Text></Table.Td><Table.Td ta="right">{inr(c.cgst)} <Text span size="xs" c="dimmed">({p.gst / 2}%)</Text></Table.Td><Table.Td ta="right" fw={700}>{inr(c.total)}</Table.Td></Table.Tr> })}</Table.Tbody></Table></Table.ScrollContainer></Paper>
    <Modal opened={open} onClose={() => setOpen(false)} size="lg" title="Purchase material"><PurchaseForm onDone={() => setOpen(false)} /></Modal>
  </Stack>
}


type FormProps = { onDone: () => void; existing?: Purchase }
function PurchaseForm({ onDone, existing }: FormProps) {
  const { materialTypes, vendors } = useMaterialStore()
  const [date, setDate] = useState(existing?.date ?? today()), [material, setMaterial] = useState(existing?.material ?? ''), [uom, setUom] = useState(existing?.uom ?? ''), [vendor, setVendor] = useState(existing?.vendor ?? ''), [mobile, setMobile] = useState(existing?.vendorMobile ?? '')
  const [qty, setQty] = useState<number | string>(existing?.qty ?? ''), [rate, setRate] = useState<number | string>(existing?.rate ?? ''), [gst, setGst] = useState(String(existing?.gst ?? 18))
  const [bill, setBill] = useState(existing?.billNumber ?? ''), [invoice, setInvoice] = useState<Invoice | undefined>(existing?.invoice), [fileError, setFileError] = useState('')
  const existingMaterial = findMaterial(material), existingVendor = findVendor(vendor)
  const newMaterial = !!material.trim() && !existingMaterial, newVendor = !!vendor.trim() && !existingVendor
  const pickMaterial = (v: string) => { setMaterial(v); const m = findMaterial(v); if (m) setUom(m.uom) }
  const pickVendor = (v: string) => { setVendor(v); const m = findVendor(v); setMobile(m ? m.mobile : '') }
  const q = Number(qty) || 0, r = Number(rate) || 0
  const t = calc(q, r, Number(gst))
  const valid = material.trim() && uom && vendor.trim() && /^\d{10}$/.test(mobile) && q > 0 && r > 0 && date
  const pickFile = (f: File | null) => {
    setFileError(''); if (!f) return
    if (!(f.type === 'application/pdf' || f.type.startsWith('image/'))) { setFileError('Only PDF or image files'); return }
    if (f.size > 5 * 1024 * 1024) { setFileError('Max 5 MB in this preview'); return }
    setInvoice({ name: f.name, type: f.type, url: URL.createObjectURL(f) })
  }
  const save = () => {
    const data = { date, material: material.trim(), uom, vendor: vendor.trim(), vendorMobile: mobile, qty: q, rate: r, gst: Number(gst), billNumber: bill.trim(), invoice }
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
      <CreatableSelect label="Material type" required placeholder="Search or add, e.g. Solar Panel" options={materialTypes.map(m => m.name)} value={material} onChange={pickMaterial} createLabel="Create material type" />
      <NativeSelect size="xs" label="Unit of measurement" required value={uom} onChange={e => setUom(e.currentTarget.value)} disabled={!!existingMaterial} data={[{ value: '', label: 'Select unit' }, ...UOMS.map(u => ({ value: u, label: u }))]}
        description={newMaterial ? 'New material type will be created' : existingMaterial ? 'Filled from material type' : undefined} />
      <CreatableSelect label="Vendor" required placeholder="Search or add vendor" options={vendors.map(v => v.name)} value={vendor} onChange={pickVendor} createLabel="Create vendor" />
      <TextInput size="xs" label="Vendor mobile" required value={mobile} inputMode="numeric" maxLength={10} disabled={!!existingVendor} onChange={e => setMobile(e.currentTarget.value.replace(/\D/g, ''))} placeholder="10-digit mobile"
        description={newVendor ? 'New vendor will be created' : existingVendor ? 'Filled from vendor' : undefined} error={mobile && mobile.length !== 10 ? 'Enter 10 digits' : undefined} />
      <NumberInput size="xs" label={`Quantity${uom ? ` (${uom})` : ''}`} required min={0} decimalScale={3} value={qty} onChange={setQty} placeholder="0" hideControls />
      <NumberInput size="xs" label={`Rate${uom ? ` per ${uom}` : ''} (excl. GST)`} required min={0} decimalScale={2} value={rate} onChange={setRate} placeholder="0.00" hideControls leftSection={'\u20B9'} />
      <NativeSelect size="xs" label="GST % (split equally into SGST and CGST)" value={gst} onChange={e => setGst(e.currentTarget.value)} data={GST_RATES.map(g => ({ value: String(g), label: `${g}%` }))} />
      <div>
        <FileInput size="xs" label="Invoice (PDF or image)" placeholder={invoice ? 'Choose another file to replace' : 'Upload invoice'} accept="application/pdf,image/*" value={null} onChange={pickFile} clearable={false} error={fileError || undefined} />
        {invoice && <Group gap={6} mt={4}><FileText size={14} aria-hidden="true" /><Text size="xs" lineClamp={1} style={{ flex: 1 }}>{invoice.name}</Text><Button size="compact-xs" variant="subtle" color="red" onClick={() => setInvoice(undefined)}>Remove</Button></Group>}
      </div>
    </SimpleGrid>
    <Paper withBorder p="xs" bg="gray.0"><Group justify="space-between" wrap="wrap">
      <div><Text size="xs" c="dimmed">Amount (qty x rate)</Text><Text fw={600}>{inr(t.subtotal)}</Text></div><div><Text size="xs" c="dimmed">SGST ({Number(gst) / 2}%)</Text><Text fw={600}>{inr(t.sgst)}</Text></div><div><Text size="xs" c="dimmed">CGST ({Number(gst) / 2}%)</Text><Text fw={600}>{inr(t.cgst)}</Text></div><div><Text size="xs" c="dimmed">Total (amount + SGST + CGST)</Text><Text fw={700} size="lg" c="orange.8">{inr(t.total)}</Text></div></Group></Paper>
    <Group justify="flex-end"><Button variant="default" onClick={onDone}>Cancel</Button><Button leftSection={existing ? <Pencil size={14} /> : <Plus size={14} />} disabled={!valid} onClick={save}>{existing ? 'Save changes' : 'Save purchase'}</Button></Group>
  </Stack>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Text size="xs" c="dimmed">{label}</Text><Text size="sm" fw={600} component="div">{children}</Text></div> }

// Same dialog is opened from the Purchase tab and from the stock-detail purchase history.
function PurchaseDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { purchases } = useMaterialStore()
  const p = purchases.find(x => x.id === id)
  const [editing, setEditing] = useState(false), [confirm, setConfirm] = useState(false), [viewing, setViewing] = useState(false)
  const close = () => { setEditing(false); setConfirm(false); setViewing(false); onClose() }
  const c = p ? calc(p.qty, p.rate, p.gst) : null
  return <>
    <Modal opened={!!p} onClose={close} closeOnEscape={!viewing && !confirm} size="lg" title={p ? <Text fw={700}>{editing ? `Edit purchase ${p.purchaseId}` : `Purchase ${p.purchaseId}`}</Text> : ''}>
      {p && c && (editing ? <PurchaseForm existing={p} onDone={() => setEditing(false)} /> : <Stack gap="sm">
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <Field label="Purchase ID">{p.purchaseId}</Field><Field label="Purchase date">{fmtDate(p.date)}</Field>
          <Field label="Material type">{p.material}</Field><Field label="Bill number">{p.billNumber || '-'}</Field>
          <Field label="Vendor">{p.vendor}</Field><Field label="Vendor mobile">{p.vendorMobile}</Field>
          <Field label="Quantity">{num(p.qty)} {p.uom}</Field><Field label={`Rate per ${p.uom} (excl. GST)`}>{inr(p.rate)}</Field>
        </SimpleGrid>
        <Paper withBorder p="xs" bg="gray.0"><SimpleGrid cols={{ base: 2, xs: 4 }} spacing="xs">
          <Field label="Amount">{inr(c.subtotal)}</Field><Field label={`SGST (${p.gst / 2}%)`}>{inr(c.sgst)}</Field><Field label={`CGST (${p.gst / 2}%)`}>{inr(c.cgst)}</Field><div><Text size="xs" c="dimmed">Total</Text><Text fw={700} c="orange.8">{inr(c.total)}</Text></div></SimpleGrid></Paper>
        <Group justify="space-between" align="center"><div><Text size="xs" c="dimmed">Invoice</Text><Text size="sm" fw={600}>{p.invoice ? p.invoice.name : 'No invoice uploaded'}</Text></div>
          <Button variant="default" leftSection={<FileText size={14} />} disabled={!p.invoice} onClick={() => setViewing(true)}>View invoice</Button></Group>
        <Group justify="space-between" mt="xs"><Button color="red" variant="light" leftSection={<Trash2 size={14} />} onClick={() => setConfirm(true)}>Delete</Button>
          <Group><Button variant="default" onClick={close}>Close</Button><Button leftSection={<Pencil size={14} />} onClick={() => setEditing(true)}>Edit</Button></Group></Group>
      </Stack>)}
    </Modal>
    <Modal opened={viewing && !!p?.invoice} onClose={() => setViewing(false)} size="xl" title={p?.invoice?.name ?? 'Invoice'} zIndex={400}>
      {p?.invoice && (p.invoice.type === 'application/pdf'
        ? <div><iframe title="Invoice PDF" src={p.invoice.url} style={{ width: '100%', height: '70vh', border: '1px solid var(--mantine-color-gray-3)' }} /><Text size="xs" c="dimmed" mt={4}>If the PDF does not show on your device, <a href={p.invoice.url} target="_blank" rel="noreferrer">open it in a new tab</a>.</Text></div>
        : <img src={p.invoice.url} alt={`Invoice ${p.billNumber || p.purchaseId}`} style={{ maxWidth: '100%', maxHeight: '70vh', display: 'block', margin: '0 auto' }} />)}
    </Modal>
    <Modal opened={confirm && !!p} onClose={() => setConfirm(false)} title="Delete this purchase?" zIndex={400} size="sm">
      {p && <Stack gap="sm"><Text size="sm">Delete purchase <b>{p.purchaseId}</b> ({p.material}, {num(p.qty)} {p.uom} from {p.vendor})? Current stock will reduce by this quantity. This cannot be undone in this preview.</Text>
        <Group justify="flex-end"><Button variant="default" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button color="red" leftSection={<Trash2 size={14} />} onClick={() => { deletePurchase(p.id); notifications.show({ color: 'red', title: `${p.purchaseId} deleted`, message: 'Preview only - sample data.' }); close() }}>Delete purchase</Button></Group></Stack>}
    </Modal>
  </>
}
