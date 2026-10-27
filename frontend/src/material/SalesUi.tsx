// Sales (debit / credit) screens: admin Sales tab, sale dialog, history, and read-only linked sales on project and site pages.
import { Accordion, Badge, Button, Collapse, Group, Modal, MultiSelect, NativeSelect, NumberInput, Paper, ScrollArea, Select, SimpleGrid, Stack, Table, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { ChevronDown, Download, FileText, Filter, History, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CreatableSelect } from './CreatableSelect'
import { ExportMenu } from './ExportMenu'
import { Pager, usePaged } from './Pager'
import { ChallanViewer } from './ChallanViewer'
import { ItemsTable } from './DocViews'
import { api, apiBlob } from '../lib/api'
import { GST_RATES, calc, docTotals, fmtDate, inr, num, type Line, type Purchase } from './types'
import { addSale, deleteSale, findMaterial, findVendor, rememberSites, siteById, updateSale, useMaterialStore, type Vendor } from './materialStore'
import { siteLabel, type Sale, type SaleSnap, type SaleType, type SaleVersion } from './sales'

const today = () => new Date().toISOString().slice(0, 10)
const byDateDesc = (a: Sale, b: Sale) => b.date.localeCompare(a.date) || b.id - a.id
const GST_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/ // format mismatch only warns (user decision)
const label = (s: Sale) => s.items.length === 1 ? s.items[0].material : `${s.items[0].material} +${s.items.length - 1} more`
const sitesText = (ids: number[]) => ids.map(i => { const s = siteById(i); return s ? siteLabel(s) : `Site ${i}` })
const sitesShort = (ids: number[]) => { const t = sitesText(ids); return t.length <= 1 ? t[0] ?? '-' : `${t[0]} +${t.length - 1} more` }
const Field = ({ label: l, children }: { label: string; children: ReactNode }) => <div style={{ minWidth: 0 }}><Text size="xs" c="dimmed">{l}</Text><Text size="sm" fw={600} component="div" style={{ overflowWrap: "anywhere" }}>{children}</Text></div>

export const TypeBadge = ({ type }: { type: SaleType }) => <Badge color={type === 'DEBIT' ? 'red' : 'green'} variant="light" size="md" tt="none" style={{ flexShrink: 0, whiteSpace: 'nowrap', overflow: 'visible' }}>{type === 'DEBIT' ? 'Debit - Out' : 'Credit - In'}</Badge>

// Stock effect of sales: debit takes stock out, credit brings it in .
export function stockOf(material: string, purchases: Purchase[], sales: Sale[], skipSaleId?: number) {
  let q = 0
  for (const p of purchases) for (const l of p.items) if (l.material === material) q += l.qty
  for (const s of sales) if (s.id !== skipSaleId) for (const l of s.items) if (l.material === material) q += s.type === 'DEBIT' ? -l.qty : l.qty
  return q
}

// ---------- Sales tab ----------
export function SalesTab({ onOpen }: { onOpen: (id: number) => void }) {
  const { sales, vendors, materialTypes, sites } = useMaterialStore()
  const [formOpen, setFormOpen] = useState(false), [showFilters, setShowFilters] = useState(false)
  const [f, setF] = useState({ id: '', from: '', to: '', type: '', vendor: '', material: '', site: '', project: '' })
  const set = (d: Partial<typeof f>) => setF(x => ({ ...x, ...d }))
  const projects = [...new Map(sites.map(s => [s.projectId, s.projectName])).entries()]
  const sorted = useMemo(() => [...sales].filter(s =>
    (!f.id.trim() || s.saleId.toLowerCase().includes(f.id.trim().toLowerCase())) && (!f.from || s.date >= f.from) && (!f.to || s.date <= f.to) && (!f.type || s.type === f.type) && (!f.vendor || s.vendor === f.vendor)
    && (!f.material || s.items.some(l => l.material === f.material)) && (!f.site || s.siteIds.includes(Number(f.site)))
    && (!f.project || s.siteIds.some(i => siteById(i)?.projectId === Number(f.project)))).sort(byDateDesc), [sales, f])
  const active = Object.values(f).filter(v => v.trim()).length
  const pg = usePaged(sorted)
  const chips = [f.id.trim() && `Sale ID: ${f.id.trim()}`, f.type && (f.type === 'DEBIT' ? 'Debit - Out' : 'Credit - In'), f.from && `From ${fmtDate(f.from)}`, f.to && `To ${fmtDate(f.to)}`, f.vendor && `Vendor: ${f.vendor}`, f.material && `Material: ${f.material}`,
    f.site && `Site: ${siteById(Number(f.site))?.name}`, f.project && `Project: ${projects.find(p => String(p[0]) === f.project)?.[1]}`].filter(Boolean) as string[]
  const clear = () => setF({ id: '', from: '', to: '', type: '', vendor: '', material: '', site: '', project: '' })
  const lineRows = sorted.flatMap(s => s.items.map(l => { const c = calc(l.qty, l.rate, l.gst); return [s.saleId, s.type === 'DEBIT' ? 'Debit - Out' : 'Credit - In', fmtDate(s.date), s.vendor, sitesText(s.siteIds).join('; '), l.material, l.qty, l.uom, l.rate, l.gst, c.subtotal, c.sgst, c.cgst, c.total] }))
  return <Stack gap="xs">
    <Group justify="space-between" align="flex-end"><div><Text fw={700}>Sales</Text><Text size="xs" c="dimmed">Latest first - {sorted.length} of {sales.length} sales</Text></div>
      <Group gap="xs"><ExportMenu filename="sales" note={`${sorted.length} sales, one row per item line${active ? ', filtered only' : ''}`} table={{ sheet: 'Sales', headers: ['Sale ID', 'Type', 'Date', 'Vendor', 'Sites', 'Material type', 'Qty', 'UOM', 'Rate', 'GST % (total)', 'Amount', 'SGST', 'CGST', 'Line total'], rows: lineRows }} />
        <Button size="xs" variant={active ? 'filled' : 'default'} leftSection={<Filter size={14} />} onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters}>Filters{active ? ` (${active})` : ''}</Button>
        <Button size="xs" leftSection={<Plus size={14} />} onClick={() => setFormOpen(true)}>Sale</Button></Group></Group>
    {!showFilters && active > 0 && <Group gap={6}>{chips.map(c => <Badge key={c} variant="light" color="orange" size="md" tt="none">{c}</Badge>)}<Button size="compact-xs" variant="subtle" onClick={clear}>Clear filters</Button></Group>}
    <Collapse expanded={showFilters}><Paper withBorder p="xs"><SimpleGrid cols={{ base: 2, md: 4 }} spacing="xs" style={{ alignItems: 'end' }}>
      <TextInput size="xs" label="Sale ID" placeholder="e.g. SES2610" value={f.id} onChange={e => set({ id: e.currentTarget.value })} />
      <NativeSelect size="xs" label="Type" value={f.type} onChange={e => set({ type: e.currentTarget.value })} data={[{ value: '', label: 'Debit and credit' }, { value: 'DEBIT', label: 'Debit - Out' }, { value: 'CREDIT', label: 'Credit - In' }]} />
      <TextInput size="xs" type="date" label="Date from" value={f.from} onChange={e => set({ from: e.currentTarget.value })} />
      <TextInput size="xs" type="date" label="Date to" value={f.to} onChange={e => set({ to: e.currentTarget.value })} />
      <NativeSelect size="xs" label="Vendor" value={f.vendor} onChange={e => set({ vendor: e.currentTarget.value })} data={[{ value: '', label: 'All vendors' }, ...vendors.map(v => ({ value: v.name, label: v.name }))]} />
      <NativeSelect size="xs" label="Material type (any item)" value={f.material} onChange={e => set({ material: e.currentTarget.value })} data={[{ value: '', label: 'All material types' }, ...materialTypes.map(m => ({ value: m.name, label: m.name }))]} />
      <NativeSelect size="xs" label="Site" value={f.site} onChange={e => set({ site: e.currentTarget.value })} data={[{ value: '', label: 'All sites' }, ...sites.map(s => ({ value: String(s.id), label: siteLabel(s) }))]} />
      <NativeSelect size="xs" label="Project" value={f.project} onChange={e => set({ project: e.currentTarget.value })} data={[{ value: '', label: 'All projects' }, ...projects.map(([id, n]) => ({ value: String(id), label: n }))]} />
    </SimpleGrid><Group justify="flex-end" mt={6}><Button size="xs" variant="subtle" onClick={clear} disabled={!active}>Clear filters{active ? ` (${active})` : ''}</Button></Group></Paper></Collapse>
    <Paper withBorder><Table.ScrollContainer minWidth={1020} type="native"><Table highlightOnHover fz="xs" horizontalSpacing={8}><Table.Thead><Table.Tr><Table.Th miw={118}>Sale ID</Table.Th><Table.Th miw={110}>Type</Table.Th><Table.Th miw={84}>Date</Table.Th><Table.Th>Items</Table.Th><Table.Th>Vendor</Table.Th><Table.Th>Sites</Table.Th><Table.Th ta="right">Amount</Table.Th><Table.Th ta="right">SGST</Table.Th><Table.Th ta="right">CGST</Table.Th><Table.Th ta="right">Total</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>{sorted.length === 0 && <Table.Tr><Table.Td colSpan={10}><Text size="sm" c="dimmed" ta="center" py="sm">No sales match these filters.</Text></Table.Td></Table.Tr>}
        {pg.rows.map(s => { const t = docTotals(s.items); return <Table.Tr key={s.id} style={{ cursor: 'pointer' }} tabIndex={0} aria-label={`Open sale ${s.saleId}`} onClick={() => onOpen(s.id)} onKeyDown={e => e.key === 'Enter' && onOpen(s.id)}>
          <Table.Td fw={600} c="orange.8" style={{ whiteSpace: 'nowrap' }}>{s.saleId}</Table.Td><Table.Td><TypeBadge type={s.type} /></Table.Td><Table.Td style={{ whiteSpace: 'nowrap' }}>{fmtDate(s.date)}</Table.Td>
          <Table.Td><Text size="sm" fw={600}>{label(s)}</Text><Text size="xs" c="dimmed">{s.items.length} {s.items.length === 1 ? 'item' : 'items'}</Text></Table.Td>
          <Table.Td>{s.vendor}</Table.Td><Table.Td><Text size="sm">{sitesShort(s.siteIds)}</Text></Table.Td>
          <Table.Td ta="right">{inr(t.subtotal)}</Table.Td><Table.Td ta="right">{inr(t.sgst)}</Table.Td><Table.Td ta="right">{inr(t.cgst)}</Table.Td><Table.Td ta="right" fw={700}>{inr(t.total)}</Table.Td></Table.Tr> })}</Table.Tbody></Table></Table.ScrollContainer><Pager p={pg} label="sales" /></Paper>
    <Modal opened={formOpen} onClose={() => setFormOpen(false)} size="xl" title="New sale" scrollAreaComponent={ScrollArea.Autosize}><SaleForm onDone={() => setFormOpen(false)} /></Modal>
  </Stack>
}

// ---------- Sale form ----------
type Row = { key: number; material: string; qty: number | string; rate: number | string; gst: string }
let rowKey = 0
const blankRow = (): Row => ({ key: ++rowKey, material: '', qty: '', rate: '', gst: '18' })

function SaleForm({ onDone, existing }: { onDone: () => void; existing?: Sale }) {
  const { materialTypes, vendors, purchases, sales, sites } = useMaterialStore()
  const [type, setType] = useState<SaleType | ''>(existing?.type ?? '')
  const [date, setDate] = useState(existing?.date ?? today()), [vendor, setVendor] = useState(existing?.vendor ?? '')
  const [mobile, setMobile] = useState(''), [gst, setGst] = useState(''), [address, setAddress] = useState('')
  const [siteIds, setSiteIds] = useState<string[]>(existing?.siteIds.map(String) ?? [])
  const [rows, setRows] = useState<Row[]>(() => existing ? existing.items.map(l => ({ key: ++rowKey, material: l.material, qty: l.qty, rate: l.rate, gst: String(l.gst) })) : [blankRow()])
  const ev = findVendor(vendor), newVendor = !!vendor.trim() && !ev
  const pickVendor = (v: string) => { setVendor(v); const m = findVendor(v); setMobile(m ? m.mobile : ''); setGst(m ? m.gst : ''); setAddress(m ? m.address : '') }
  const patch = (key: number, d: Partial<Row>) => setRows(rs => rs.map(r => r.key === key ? { ...r, ...d } : r))
  const showMobile = ev ? ev.mobile : mobile, showGst = ev ? ev.gst : gst, showAddr = ev ? ev.address : address
  const items = rows.map(r => ({ r, c: calc(Number(r.qty) || 0, Number(r.rate) || 0, Number(r.gst)), m: findMaterial(r.material) }))
  const grand = docTotals(rows.map(r => ({ material: r.material, uom: '', qty: Number(r.qty) || 0, rate: Number(r.rate) || 0, gst: Number(r.gst) })))
  const gstBad = newVendor && gst.trim() !== '' && !GST_RE.test(gst.trim().toUpperCase())
  const rowOk = (r: Row) => !!findMaterial(r.material) && Number(r.qty) > 0 && Number(r.rate) > 0
  const valid = !!type && !!date && !!vendor.trim() && (!newVendor || /^\d{10}$/.test(mobile)) && rows.length > 0 && rows.every(rowOk)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    const data: SaleSnap = { type: type as SaleType, date, vendor: vendor.trim(), siteIds: siteIds.map(Number), items: rows.map(r => ({ material: r.material, uom: findMaterial(r.material)!.uom, qty: Number(r.qty), rate: Number(r.rate), gst: Number(r.gst) })) }
    const nv: Vendor | undefined = newVendor ? { name: vendor.trim(), mobile, gst: gst.trim().toUpperCase(), address: address.trim() } : undefined
    setBusy(true)
    try {
      const warnings = existing ? await updateSale(existing.id, data, nv) : await addSale(data, nv)
      notifications.show({ color: 'green', title: existing ? `${existing.saleId} updated` : 'Sale saved', message: 'Saved.' })
      if (warnings.length) notifications.show({ color: 'yellow', title: 'Stock warning', message: warnings.join('. '), autoClose: 8000 })
      onDone()
    } catch (e) { notifications.show({ color: 'red', title: 'Could not save sale', message: (e as Error).message }) } finally { setBusy(false) }
  }
  return <Stack gap="sm">
    <Paper withBorder p="xs" bg="gray.0"><Text size="xs" c="dimmed">Sale ID</Text><Text fw={700}>{existing ? existing.saleId : 'Generated on save'}</Text>
      {existing && <Text size="xs" c="dimmed">The ID does not change when a sale is edited.</Text>}</Paper>
    <div><Text size="xs" fw={500} mb={4}>Sale type <span style={{ color: 'var(--mantine-color-red-6)' }}>*</span></Text>
      <Group gap="xs" role="group" aria-label="Sale type">
        <Button color="red" variant={type === 'DEBIT' ? 'filled' : 'outline'} aria-pressed={type === 'DEBIT'} onClick={() => setType('DEBIT')} style={{ flex: '1 1 160px' }}>Debit</Button>
        <Button color="green" variant={type === 'CREDIT' ? 'filled' : 'outline'} aria-pressed={type === 'CREDIT'} onClick={() => setType('CREDIT')} style={{ flex: '1 1 160px' }}>Credit</Button></Group>
      <Text size="xs" c={type ? 'dimmed' : 'red.7'} mt={2}>{type === 'DEBIT' ? 'Debit: material given out. Current stock goes down.' : type === 'CREDIT' ? 'Credit: material taken in. Current stock goes up.' : 'Select Debit or Credit to continue. One of them is required.'}</Text></div>
    <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs">
      <TextInput size="xs" type="date" label="Sale date" required value={date} onChange={e => setDate(e.currentTarget.value)} />
      <div />
      <CreatableSelect label="Vendor" required placeholder="Search or add vendor" options={vendors.map(v => v.name)} value={vendor} onChange={pickVendor} createLabel="Create vendor" hint={newVendor ? 'New vendor will be created' : ev ? 'Existing vendor - details filled from vendor' : undefined} />
      <TextInput size="xs" label="Vendor mobile" required={newVendor} value={showMobile} inputMode="numeric" maxLength={10} disabled={!!ev} onChange={e => setMobile(e.currentTarget.value.replace(/\D/g, ''))} placeholder="10-digit mobile" error={newVendor && mobile && mobile.length !== 10 ? 'Enter 10 digits' : undefined} />
      <TextInput size="xs" label="Vendor GST number" value={showGst} disabled={!!ev} onChange={e => setGst(e.currentTarget.value.toUpperCase())} maxLength={15} placeholder="15-character GSTIN" description={gstBad ? <Text span size="xs" c="orange.8">Warning: this does not look like a valid 15-character GSTIN. It will still be saved.</Text> : undefined} />
      <TextInput size="xs" label="Vendor address" value={showAddr} disabled={!!ev} onChange={e => setAddress(e.currentTarget.value)} placeholder="Vendor address" />
    </SimpleGrid>
    <MultiSelect size="xs" label="Sites (optional)" searchable clearable placeholder={siteIds.length ? undefined : 'Select sites (optional)'} value={siteIds} onChange={setSiteIds}
      data={sites.map(s => ({ value: String(s.id), label: siteLabel(s) }))} nothingFoundMessage="No such site" description="Shown as Site | Project. Sites are only linked to this sale; the item quantity reduces (or adds to) stock once." />
    <div>
      <Group justify="space-between" mb={4}><Text fw={700} size="sm">Items ({rows.length})</Text><Button size="compact-sm" variant="light" leftSection={<Plus size={14} />} onClick={() => setRows(rs => [...rs, blankRow()])}>Add item</Button></Group>
      <Stack gap="xs">{items.map(({ r, c, m }, i) => {
        const avail = m ? stockOf(m.name, purchases, sales, existing?.id) : null
        const over = type === 'DEBIT' && avail !== null && Number(r.qty) > avail
        return <Paper withBorder p="xs" key={r.key} aria-label={`Item ${i + 1}`}>
          <SimpleGrid cols={{ base: 2, sm: 6 }} spacing="xs" style={{ alignItems: 'start' }}>
            <div style={{ gridColumn: 'span 2' }}><Select size="xs" label={`Item ${i + 1} - material type`} required searchable placeholder="Search existing material type" data={materialTypes.map(x => x.name)} value={r.material || null} onChange={v => patch(r.key, { material: v ?? '' })} nothingFoundMessage="Not found. New material types are created from a Purchase, not from a sale." />
              {avail !== null && <Text size="xs" c="dimmed" mt={2}>Stock now: {num(avail)} {m!.uom}</Text>}</div>
            <TextInput size="xs" label="Unit" value={m?.uom ?? ''} disabled placeholder="From type" />
            <NumberInput size="xs" label="Quantity" required min={0} decimalScale={3} value={r.qty} onChange={v => patch(r.key, { qty: v })} placeholder="0" hideControls error={over ? 'More than current stock' : undefined} />
            <NumberInput size="xs" label="Price (excl. GST)" required min={0} decimalScale={2} value={r.rate} onChange={v => patch(r.key, { rate: v })} leftSection={'\u20B9'} placeholder="0.00" hideControls />
            <NativeSelect size="xs" label="GST %" value={r.gst} onChange={e => patch(r.key, { gst: e.currentTarget.value })} data={GST_RATES.map(g => ({ value: String(g), label: `${g}%` }))} />
          </SimpleGrid>
          <Group justify="space-between" mt={6}><Text size="xs" c="dimmed">Amount {inr(c.subtotal)} + SGST {inr(c.sgst)} ({Number(r.gst) / 2}%) + CGST {inr(c.cgst)} ({Number(r.gst) / 2}%) = <b>{inr(c.total)}</b></Text>
            <Button size="compact-xs" variant="subtle" color="red" leftSection={<Trash2 size={12} />} disabled={rows.length === 1} onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))} aria-label={`Remove item ${i + 1}`}>Remove</Button></Group>
        </Paper> })}</Stack>
      {type === 'DEBIT' && items.some(({ r, m }) => m && Number(r.qty) > stockOf(m.name, purchases, sales, existing?.id)) && <Text size="xs" c="orange.8" mt={4}>Some quantities are above current stock. The preview only warns; whether to block this is not decided yet.</Text>}
    </div>
    <Paper withBorder p="xs" bg="gray.0"><Group justify="space-between" wrap="wrap">
      <div><Text size="xs" c="dimmed">Amount (all items)</Text><Text fw={600}>{inr(grand.subtotal)}</Text></div><div><Text size="xs" c="dimmed">SGST</Text><Text fw={600}>{inr(grand.sgst)}</Text></div><div><Text size="xs" c="dimmed">CGST</Text><Text fw={600}>{inr(grand.cgst)}</Text></div><div><Text size="xs" c="dimmed">Grand total (amount + SGST + CGST)</Text><Text fw={700} size="lg" c="orange.8">{inr(grand.total)}</Text></div></Group></Paper>
    <Text size="xs" c="dimmed">After saving, a challan PDF is generated by the server for View and Download.</Text>
    <Group justify="flex-end" style={{ position: 'sticky', bottom: 0, background: 'var(--mantine-color-body)', padding: '8px 0', borderTop: '1px solid var(--mantine-color-gray-3)', zIndex: 2 }}><Button variant="default" onClick={onDone}>Cancel</Button><Button color={type === 'DEBIT' ? 'red' : type === 'CREDIT' ? 'green' : 'orange'} leftSection={existing ? <Pencil size={14} /> : <Plus size={14} />} disabled={!valid || busy} onClick={save}>{existing ? 'Save changes' : 'Save sale'}</Button></Group>
  </Stack>
}

// ---------- Read-only sale dialog (same everywhere) ----------
const fmtStamp = (iso: string) => { const [d, t] = iso.split('T'); return `${fmtDate(d)} ${t.slice(0, 8)}` }
const lineSig = (l: Line) => `${l.qty} ${l.uom} @ ${inr(l.rate)} GST ${l.gst}%`
function changes(o: SaleSnap, n: SaleSnap) {
  const out: string[] = []
  if (o.type !== n.type) out.push(`Type: ${o.type === 'DEBIT' ? 'Debit - Out' : 'Credit - In'} \u2192 ${n.type === 'DEBIT' ? 'Debit - Out' : 'Credit - In'}`)
  if (o.date !== n.date) out.push(`Date: ${fmtDate(o.date)} \u2192 ${fmtDate(n.date)}`)
  if (o.vendor !== n.vendor) out.push(`Vendor: ${o.vendor} \u2192 ${n.vendor}`)
  if (sitesText(o.siteIds).sort().join(';') !== sitesText(n.siteIds).sort().join(';')) out.push(`Sites: ${sitesText(o.siteIds).join(', ')} \u2192 ${sitesText(n.siteIds).join(', ')}`)
  for (const a of o.items) { const b = n.items.find(x => x.material === a.material); if (!b) out.push(`Item removed: ${a.material} (${lineSig(a)})`); else if (lineSig(a) !== lineSig(b)) out.push(`${a.material}: ${lineSig(a)} \u2192 ${lineSig(b)}`) }
  for (const b of n.items) if (!o.items.some(x => x.material === b.material)) out.push(`Item added: ${b.material} (${lineSig(b)})`)
  return out
}
function SaleHistory({ s }: { s: Sale }) {
  const list: SaleVersion[] = s.versions
  return <Stack gap="xs" mt="xs">
    <Text size="xs" c="dimmed">Current version has been active since {fmtStamp(s.activeFrom)}. Earlier versions, newest first:</Text>
    {list.length === 0 ? <Text size="sm">This sale has not been edited.</Text> :
      <Accordion variant="separated" chevronPosition="left">{list.map((v, i) => {
        const newer: SaleSnap = i === 0 ? s : list[i - 1]
        return <Accordion.Item key={v.version} value={String(v.version)}>
          <Accordion.Control><Text size="sm" fw={600}>Version {v.version}</Text><Text size="xs" c="dimmed">Active {fmtStamp(v.activeFrom)} to {fmtStamp(v.activeTo)}</Text></Accordion.Control>
          <Accordion.Panel><Stack gap={6}>
            <SimpleGrid cols={2} spacing="xs" style={{ minWidth: 0 }}><Field label="Type"><TypeBadge type={v.type} /></Field><Field label="Date">{fmtDate(v.date)}</Field><Field label="Vendor">{v.vendor}</Field><Field label="Sites">{sitesText(v.siteIds).join(', ')}</Field></SimpleGrid>
            <ItemsTable items={v.items} />
            <div><Text size="xs" c="dimmed">Replaced by the next version with these changes</Text>{changes(v, newer).map(x => <Text key={x} size="xs">{x}</Text>)}</div>
          </Stack></Accordion.Panel></Accordion.Item> })}</Accordion>}
  </Stack>
}

export function SaleDialog({ id, onClose, readOnly = false, sale }: { id: number | null; onClose: () => void; readOnly?: boolean; sale?: Sale }) {
  const { sales, vendors } = useMaterialStore(readOnly)
  // Admin: the live store copy (fresh after edits). Read-only viewers: the server-scoped copy passed in.
  const s = readOnly ? sale : (sales.find(x => x.id === id) ?? sale)
  const vi = s?.vendorInfo ?? vendors.find(x => x.name === s?.vendor)
  const v = vi ? { mobile: vi.mobile, gst: vi.gst, address: vi.address } : undefined
  const [editing, setEditing] = useState(false), [confirm, setConfirm] = useState(false), [challan, setChallan] = useState(false), [showHistory, setShowHistory] = useState(false)
  const [blob, setBlob] = useState<Blob | null>(null), [challanErr, setChallanErr] = useState('')
  const close = () => { setEditing(false); setConfirm(false); setChallan(false); setShowHistory(false); setBlob(null); onClose() }
  const sid = s?.id
  useEffect(() => {
    if (!challan || sid === undefined) return
    let dead = false; setBlob(null); setChallanErr('')
    apiBlob(`/material/sales/${sid}/challan`).then(b => { if (!dead) setBlob(b) }).catch(e => { if (!dead) setChallanErr((e as Error).message) })
    return () => { dead = true }
  }, [challan, sid, s?.activeFrom])
  const openTab = () => { if (!blob) return; const u = URL.createObjectURL(blob); window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 60000) }
  const download = async () => { if (!s) return; try { const b = blob ?? await apiBlob(`/material/sales/${s.id}/challan`); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `challan-${s.saleId}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000) } catch (e) { notifications.show({ color: 'red', title: 'Could not download challan', message: (e as Error).message }) } }
  const del = async () => { if (!s) return; try { const w = await deleteSale(s.id); notifications.show({ color: 'red', title: `${s.saleId} deleted`, message: 'Removed from lists and stock. History is kept.' }); if (w.length) notifications.show({ color: 'yellow', title: 'Stock warning', message: w.join('. '), autoClose: 8000 }); close() } catch (e) { notifications.show({ color: 'red', title: 'Could not delete', message: (e as Error).message }) } }
  return <>
    <Modal opened={!!s} onClose={close} closeOnEscape={!challan && !confirm} size="xl" title={s ? <Text fw={700}>{editing ? `Edit sale ${s.saleId}` : `Sale ${s.saleId}`}</Text> : ''}>
      {s && (editing ? <SaleForm existing={s} onDone={() => setEditing(false)} /> : <Stack gap="sm" style={{ minWidth: 0 }}>
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <Field label="Sale ID">{s.saleId}</Field><Field label="Type"><TypeBadge type={s.type} /></Field>
          <Field label="Sale date">{fmtDate(s.date)}</Field><Field label="Vendor">{s.vendor}</Field>
          <Field label="Vendor mobile">{v?.mobile || '-'}</Field><Field label="Vendor GST number">{v?.gst || '-'}</Field>
          <Field label="Vendor address">{v?.address || '-'}</Field>
          <Field label="Sites (Site | Project)"><Group gap={4}>{s.sites.map(siteLabel).map(t => <Badge key={t} variant="light" color="gray" tt="none">{t}</Badge>)}</Group>{readOnly && <Text size="xs" c="dimmed" fw={400}>Only sites of your own projects are listed.</Text>}</Field>
        </SimpleGrid>
        <div><Text size="xs" c="dimmed" mb={4}>Items ({s.items.length})</Text><ItemsTable items={s.items} /></div>
        <Group justify="space-between" align="center"><div><Text size="xs" c="dimmed">Challan</Text><Text size="sm" fw={600}>challan-{s.saleId}.pdf</Text></div>
          <Group gap="xs"><Button variant="default" leftSection={<FileText size={14} />} onClick={() => setChallan(true)}>View challan</Button><Button variant="default" leftSection={<Download size={14} />} onClick={download}>Download PDF</Button></Group></Group>
        {readOnly ? <Group justify="space-between" mt="xs"><Text size="xs" c="dimmed">Read only - view access from the project or site page.</Text><Button variant="default" onClick={close}>Close</Button></Group> : <Group justify="space-between" mt="xs"><Button color="red" variant="light" leftSection={<Trash2 size={14} />} onClick={() => setConfirm(true)}>Delete</Button>
          <Group><Button variant="default" onClick={close}>Close</Button><Button leftSection={<Pencil size={14} />} onClick={() => setEditing(true)}>Edit</Button></Group></Group>}
        <div style={{ borderTop: '1px solid var(--mantine-color-gray-3)', paddingTop: 8 }}>
          <Button variant="subtle" size="compact-sm" leftSection={<History size={14} />} rightSection={<ChevronDown size={14} style={{ transform: showHistory ? 'rotate(180deg)' : undefined }} />} onClick={() => setShowHistory(x => !x)} aria-expanded={showHistory}>
            Edit history ({s.versions.length} earlier {s.versions.length === 1 ? 'version' : 'versions'})</Button>
          <Collapse expanded={showHistory}><SaleHistory s={s} /></Collapse>
        </div>
      </Stack>)}
    </Modal>
    <Modal opened={challan && !!s} onClose={() => setChallan(false)} size="xl" title={s ? `Challan ${s.saleId}` : 'Challan'} zIndex={400}>
      {s && (challanErr ? <Text size="sm" c="red">{challanErr}</Text> : blob ? <div><ChallanViewer blob={blob} />
        <Group justify="space-between" mt={4}><Text size="xs" c="dimmed">Created by the server from the saved sale.</Text><Group gap={6}><Button size="compact-xs" variant="default" onClick={openTab}>Open in new tab</Button><Button size="compact-xs" variant="default" leftSection={<Download size={12} />} onClick={download}>Download PDF</Button></Group></Group></div> : <Text size="sm" c="dimmed">Loading challan...</Text>)}
    </Modal>
    <Modal opened={confirm && !!s} onClose={() => setConfirm(false)} title="Delete this sale?" zIndex={400} size="sm">
      {s && <Stack gap="sm"><Text size="sm">Delete sale <b>{s.saleId}</b> ({label(s)}, {s.items.length} {s.items.length === 1 ? 'item' : 'items'}, {s.vendor})? Current stock will {s.type === 'DEBIT' ? 'increase (the material comes back)' : 'reduce'} by the quantity of every item in it. It is removed from lists and stock; the record and its edit history are kept.</Text>
        <Group justify="flex-end"><Button variant="default" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button color="red" leftSection={<Trash2 size={14} />} onClick={del}>Delete sale</Button></Group></Stack>}
    </Modal>
  </>
}

// ---------- Sales history of one material (stock detail) ----------
export function MaterialSalesHistory({ material, onOpen }: { material: string; onOpen: (id: number) => void }) {
  const { sales } = useMaterialStore()
  const rows = sales.filter(s => s.items.some(l => l.material === material)).sort(byDateDesc).map(s => ({ s, lines: s.items.filter(l => l.material === material) }))
  const pg = usePaged(rows)
  const uom = rows[0]?.lines[0].uom ?? ''
  return <Paper withBorder><Group gap={6} p="xs" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}><Text fw={700} size="sm">Sales history</Text><div style={{ marginLeft: 'auto' }}><ExportMenu filename={`${material}-sales-history`} table={{ sheet: 'Sales history', headers: ['Sale ID', 'Type', 'Date', 'Vendor', 'Sites', 'Qty', 'UOM', 'Price', 'GST % (total)', 'Amount', 'SGST', 'CGST', 'Total'], rows: rows.flatMap(({ s, lines }) => lines.map(l => { const c = calc(l.qty, l.rate, l.gst); return [s.saleId, s.type === 'DEBIT' ? 'Debit - Out' : 'Credit - In', fmtDate(s.date), s.vendor, sitesText(s.siteIds).join('; '), l.qty, l.uom, l.rate, l.gst, c.subtotal, c.sgst, c.cgst, c.total] })) }} /></div></Group>
    {rows.length === 0 ? <Text size="sm" c="dimmed" p="sm">No sales for this material yet.</Text> :
      <Table.ScrollContainer minWidth={620}><Table><Table.Thead><Table.Tr><Table.Th>Sale ID</Table.Th><Table.Th miw={110}>Type</Table.Th><Table.Th>Date</Table.Th><Table.Th>Vendor</Table.Th><Table.Th ta="right">Qty</Table.Th></Table.Tr></Table.Thead>
        <Table.Tbody>{pg.rows.map(({ s, lines }) => <Table.Tr key={s.id} style={{ cursor: 'pointer' }} tabIndex={0} aria-label={`Open sale ${s.saleId}`} onClick={() => onOpen(s.id)} onKeyDown={e => e.key === 'Enter' && onOpen(s.id)}>
          <Table.Td fw={600} c="orange.8">{s.saleId}{s.items.length > 1 && <Text size="xs" c="dimmed" fw={400}>{s.items.length} items in sale</Text>}</Table.Td><Table.Td><TypeBadge type={s.type} /></Table.Td><Table.Td>{fmtDate(s.date)}</Table.Td><Table.Td>{s.vendor}</Table.Td>
          <Table.Td ta="right" c={s.type === 'DEBIT' ? 'red.8' : 'green.8'} fw={600} style={{ whiteSpace: 'nowrap' }}>{s.type === 'DEBIT' ? '-' : '+'}{num(lines.reduce((a, l) => a + l.qty, 0))} {uom}</Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer>}
    {rows.length > 0 && <Pager p={pg} label="sales" />}
    <Text size="xs" c="dimmed" p="xs">Qty is for this material only, not the whole sale. Debit takes stock out, credit brings it in.</Text></Paper>
}

// ---------- Linked sales (project / site detail pages) ----------
export function LinkedSales({ projectId, siteId, readOnly = false }: { projectId?: number; siteId?: number; readOnly?: boolean }) {
  const { sales: storeSales } = useMaterialStore(readOnly)
  const [open, setOpen] = useState(false), [openId, setOpenId] = useState<number | null>(null)
  const [list, setList] = useState<Sale[]>([]), [err, setErr] = useState('')
  const path = siteId !== undefined ? `/sites/${siteId}/sales` : `/projects/${projectId}/sales`
  useEffect(() => {
    let dead = false
    api<Sale[]>(path).then(l => { if (!dead) { setList([...l].sort(byDateDesc)); setErr(''); l.forEach(x => { rememberSites(x.sites); x.versions.forEach(v => rememberSites(v.sites)) }) } }).catch(e => { if (!dead) setErr((e as Error).message) })
    return () => { dead = true }
  }, [path, storeSales])
  const pg = usePaged(list)
  return <Paper withBorder p="xs">
    <Button variant="subtle" size="compact-sm" leftSection={<FileText size={14} />} rightSection={<ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : undefined }} />} onClick={() => setOpen(v => !v)} aria-expanded={open}>Linked sales ({list.length})</Button>
    {readOnly && <Text size="xs" c="dimmed">Read only: sales linked to your own project.</Text>}
    <Collapse expanded={open}>{err ? <Text size="sm" c="red" py="xs">{err}</Text> : list.length === 0 ? <Text size="sm" c="dimmed" py="xs">No sales linked yet.</Text> : <>
      <Table.ScrollContainer minWidth={560}><Table highlightOnHover fz="sm"><Table.Thead><Table.Tr><Table.Th>Sale ID</Table.Th><Table.Th>Type</Table.Th><Table.Th>Date</Table.Th><Table.Th>Items</Table.Th><Table.Th>Vendor</Table.Th><Table.Th ta="right">Total</Table.Th></Table.Tr></Table.Thead>
        <Table.Tbody>{pg.rows.map(s => <Table.Tr key={s.id} style={{ cursor: 'pointer' }} tabIndex={0} aria-label={`Open sale ${s.saleId}`} onClick={() => setOpenId(s.id)} onKeyDown={e => e.key === 'Enter' && setOpenId(s.id)}>
          <Table.Td fw={600} c="orange.8">{s.saleId}</Table.Td><Table.Td><TypeBadge type={s.type} /></Table.Td><Table.Td>{fmtDate(s.date)}</Table.Td><Table.Td>{label(s)}</Table.Td><Table.Td>{s.vendor}</Table.Td><Table.Td ta="right" fw={600}>{inr(docTotals(s.items).total)}</Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer>
      <Pager p={pg} label="sales" /></>}</Collapse>
    <SaleDialog id={openId} onClose={() => setOpenId(null)} readOnly={readOnly} sale={list.find(x => x.id === openId)} />
  </Paper>
}
