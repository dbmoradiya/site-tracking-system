import { Badge, Button, Group, Modal, NativeSelect, NumberInput, Paper, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Archive, ArchiveRestore, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { UOMS } from './types'
import { addGroup, addMaterialType, addVendor, archiveGroup, editGroup, editMaterialType, editVendor, findMaterial, findVendor, setCompany, useMaterialStore, type MaterialGroup, type MaterialType, type Vendor } from './materialStore'

// Setup tabs for Material types, Vendors and Company. Material types created in the Purchase form appear here.
export function MaterialTypesTab() {
  const { materialTypes, purchases } = useMaterialStore()
  const [sel, setSel] = useState<{ old: string; name: string; uom: string; hsn: string } | null>(null)
  const dupe = sel && sel.name.trim() && sel.name.trim().toLowerCase() !== sel.old.toLowerCase() && !!findMaterial(sel.name)
  const used = !!sel?.old && (findMaterial(sel.old)?.usedCount ?? 0) > 0
  const save = async () => { if (!sel) return; const next: MaterialType = { name: sel.name.trim(), uom: used ? (findMaterial(sel.old)?.uom ?? sel.uom) : sel.uom, hsn: sel.hsn.trim() }; try { if (sel.old) await editMaterialType(sel.old, next); else await addMaterialType(next); notifications.show({ color: 'green', message: 'Saved' }); setSel(null) } catch (e) { notifications.show({ color: 'red', title: 'Could not save', message: (e as Error).message }) } }
  return <Stack gap="xs">
    <Group justify="space-between"><div><Title order={4}>Material Types</Title><Text size="xs" c="dimmed">{materialTypes.length} types - added automatically from the Purchase form</Text></div>
      <Button leftSection={<Plus size={14} />} onClick={() => setSel({ old: '', name: '', uom: '', hsn: '' })}>Add Material Type</Button></Group>
    <Paper withBorder><Table.ScrollContainer minWidth={520}><Table highlightOnHover><Table.Thead><Table.Tr><Table.Th>Material type</Table.Th><Table.Th>UOM</Table.Th><Table.Th>HSN code</Table.Th><Table.Th ta="right">Purchases</Table.Th><Table.Th ta="right" w={80}>Edit</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>{materialTypes.map(m => <Table.Tr key={m.name}><Table.Td fw={600}>{m.name}</Table.Td><Table.Td>{m.uom}</Table.Td><Table.Td>{m.hsn || '-'}</Table.Td><Table.Td ta="right">{purchases.filter(p => p.items.some(l => l.material === m.name)).length}</Table.Td>
        <Table.Td ta="right"><Button size="compact-xs" variant="subtle" leftSection={<Pencil size={12} />} aria-label={`Edit ${m.name}`} onClick={() => setSel({ old: m.name, name: m.name, uom: m.uom, hsn: m.hsn ?? '' })}>Edit</Button></Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></Paper>
    <Modal opened={!!sel} onClose={() => setSel(null)} title={sel?.old ? `Edit ${sel.old}` : 'Add Material Type'}>{sel && <Stack gap="sm">
      <TextInput size="xs" label="Material type" required value={sel.name} onChange={e => setSel({ ...sel, name: e.currentTarget.value })} error={dupe ? 'Already exists' : undefined} />
      <NativeSelect size="xs" label="Unit of measurement" value={sel.uom} onChange={e => setSel({ ...sel, uom: e.currentTarget.value })} disabled={used} description={used ? 'Locked: purchases already use this unit' : undefined} data={[{ value: '', label: 'Select unit' }, ...UOMS.map(u => ({ value: u, label: u }))]} />
      <div><TextInput size="xs" label="HSN code (optional)" placeholder="e.g. 2523" maxLength={16} value={sel.hsn} onChange={e => setSel({ ...sel, hsn: e.currentTarget.value })} />
        {sel.hsn.trim() && !/^(\d{4}|\d{6}|\d{8})$/.test(sel.hsn.trim()) && <Text size="xs" c="orange.8" mt={2}>HSN is usually 4, 6 or 8 digits. It will still be saved.</Text>}</div>
      <Group justify="flex-end"><Button variant="default" onClick={() => setSel(null)}>Cancel</Button><Button leftSection={<Save size={14} />} disabled={!sel.name.trim() || !sel.uom || !!dupe} onClick={save}>Save changes</Button></Group></Stack>}</Modal>
    <GroupsSection />
  </Stack>
}

const perText = (g: MaterialGroup) => g.items.map(i => `${i.qty} ${i.uom} ${i.material}`).join(' + ')
type GDraft = { id?: number; name: string; rows: { key: number; material: string; qty: number | string }[] }
let gkey = 0

/** Material groups live under the material type list: 1 group = fixed quantities of several materials (e.g. 1 ACDB = 4 MCB + 1 Box). Stock stays on the materials. */
function GroupsSection() {
  const { groups, materialTypes } = useMaterialStore()
  const [d, setD] = useState<GDraft | null>(null), [arch, setArch] = useState<MaterialGroup | null>(null), [busy, setBusy] = useState(false)
  const names = d ? d.rows.map(r => r.material.toLowerCase()).filter(Boolean) : []
  const dupName = !!d && !!d.name.trim() && groups.some(g => g.id !== d.id && g.name.toLowerCase() === d.name.trim().toLowerCase())
  const rowErr = (r: GDraft['rows'][number]) => r.material && names.filter(n => n === r.material.toLowerCase()).length > 1 ? 'Already in this group' : undefined
  const qtyOk = (q: number | string) => Number(q) > 0 && Math.abs(Number(q) * 1000 - Math.round(Number(q) * 1000)) < 1e-6
  const valid = !!d && !!d.name.trim() && !dupName && d.rows.length > 0 && d.rows.every(r => !!findMaterial(r.material) && qtyOk(r.qty) && !rowErr(r))
  const save = async () => {
    if (!d || !valid) return; setBusy(true)
    const body = { name: d.name.trim(), items: d.rows.map(r => ({ material: r.material, qty: Number(r.qty) })) }
    try { if (d.id) await editGroup(d.id, body); else await addGroup(body); notifications.show({ color: 'green', message: 'Group saved' }); setD(null) }
    catch (e) { notifications.show({ color: 'red', title: 'Could not save group', message: (e as Error).message }) } finally { setBusy(false) }
  }
  const doArchive = async () => {
    if (!arch) return; setBusy(true)
    try { await archiveGroup(arch.id, !arch.archived); setArch(null) } catch (e) { notifications.show({ color: 'red', title: 'Could not change group', message: (e as Error).message }) } finally { setBusy(false) }
  }
  const openEdit = (g: MaterialGroup) => setD({ id: g.id, name: g.name, rows: g.items.map(i => ({ key: ++gkey, material: i.material, qty: i.qty })) })
  return <Stack gap="xs" mt="md" aria-label="Material groups">
    <Group justify="space-between"><div><Title order={4}>Material groups</Title><Text size="xs" c="dimmed">{groups.filter(g => !g.archived).length} {groups.filter(g => !g.archived).length === 1 ? "group" : "groups"} - a group is a set of materials sold together (1 ACDB = 4 MCB + 1 Box). Stock is always kept on the materials.</Text></div>
      <Button leftSection={<Plus size={14} />} onClick={() => setD({ name: '', rows: [{ key: ++gkey, material: '', qty: '' }] })}>Add group</Button></Group>
    <Paper withBorder><Table.ScrollContainer minWidth={520}><Table highlightOnHover><Table.Thead><Table.Tr><Table.Th>Group</Table.Th><Table.Th>Contains (per 1 group)</Table.Th><Table.Th ta="right">Sales</Table.Th><Table.Th ta="right" w={170}>Actions</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>{groups.length === 0 && <Table.Tr><Table.Td colSpan={4}><Text size="sm" c="dimmed" ta="center" py="sm">No groups yet. Add one to sell several materials together.</Text></Table.Td></Table.Tr>}
        {groups.map(g => <Table.Tr key={g.id} style={g.archived ? { opacity: 0.6 } : undefined}><Table.Td fw={600}>{g.name}{g.archived && <Badge ml={6} size="sm" variant="light" color="gray" tt="none">Archived</Badge>}</Table.Td><Table.Td>{perText(g)}</Table.Td><Table.Td ta="right">{g.usedCount}</Table.Td>
          <Table.Td ta="right"><Group gap={4} justify="flex-end" wrap="nowrap"><Button size="compact-xs" variant="subtle" leftSection={<Pencil size={12} />} aria-label={`Edit group ${g.name}`} onClick={() => openEdit(g)}>Edit</Button>
            <Button size="compact-xs" variant="subtle" color={g.archived ? 'green' : 'gray'} leftSection={g.archived ? <ArchiveRestore size={12} /> : <Archive size={12} />} aria-label={`${g.archived ? 'Restore' : 'Archive'} group ${g.name}`} onClick={() => setArch(g)}>{g.archived ? 'Restore' : 'Archive'}</Button></Group></Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></Paper>
    <Modal opened={!!d} onClose={() => setD(null)} size="lg" title={d?.id ? `Edit group ${d.name}` : 'Add group'}>{d && <Stack gap="sm">
      <TextInput size="xs" label="Group name" required placeholder="e.g. ACDB" value={d.name} onChange={e => setD({ ...d, name: e.currentTarget.value })} error={dupName ? 'A group with this name already exists' : undefined} />
      <div><Text size="xs" fw={500} mb={4}>Materials in 1 group</Text>
        <Stack gap="xs">{d.rows.map((r, i) => { const m = findMaterial(r.material); return <Paper withBorder p="xs" key={r.key} aria-label={`Group material ${i + 1}`}>
          <Group gap="xs" align="flex-start" wrap="wrap"><div style={{ flex: '2 1 160px', minWidth: 0 }}><Select size="xs" label={`Material ${i + 1}`} searchable placeholder="Search existing material type" data={materialTypes.map(x => x.name)} value={r.material || null} onChange={v => setD({ ...d, rows: d.rows.map(x => x.key === r.key ? { ...x, material: v ?? '' } : x) })} error={rowErr(r)} nothingFoundMessage="No such material type" /></div>
            <NumberInput size="xs" label="Qty per 1 group" w={120} min={0} decimalScale={3} hideControls placeholder="0" value={r.qty} onChange={v => setD({ ...d, rows: d.rows.map(x => x.key === r.key ? { ...x, qty: v } : x) })} />
            <TextInput size="xs" label="Unit" w={80} disabled value={m?.uom ?? ''} placeholder="-" />
            <Button size="compact-xs" variant="subtle" color="red" mt={22} leftSection={<Trash2 size={12} />} disabled={d.rows.length === 1} aria-label={`Remove group material ${i + 1}`} onClick={() => setD({ ...d, rows: d.rows.filter(x => x.key !== r.key) })}>Remove</Button></Group></Paper> })}</Stack>
        <Button mt="xs" size="compact-sm" variant="light" leftSection={<Plus size={14} />} onClick={() => setD({ ...d, rows: [...d.rows, { key: ++gkey, material: '', qty: '' }] })}>Add material</Button></div>
      <Text size="xs" c="dimmed">{d.name.trim() ? `1 ${d.name.trim()}` : '1 group'} = {d.rows.filter(r => r.material && Number(r.qty) > 0).map(r => `${r.qty} ${findMaterial(r.material)?.uom ?? ''} ${r.material}`).join(' + ') || '...'}. {d.id ? 'Changing a group affects new sales only. Sales already saved keep the quantities they were saved with.' : 'The group has no stock of its own.'}</Text>
      <Group justify="flex-end"><Button variant="default" onClick={() => setD(null)}>Cancel</Button><Button leftSection={<Save size={14} />} loading={busy} disabled={!valid} onClick={save}>Save group</Button></Group></Stack>}</Modal>
    <Modal opened={!!arch} onClose={() => setArch(null)} title={arch?.archived ? 'Restore group' : 'Archive group'}>{arch && <Stack gap="sm">
      <Text size="sm">{arch.archived ? <>Restore <b>{arch.name}</b>? It can be added to new sales again.</> : <>Archive <b>{arch.name}</b>? It will not appear when adding a new sale. Sales and challans that already use it do not change. You can restore it later.</>}</Text>
      <Group justify="flex-end"><Button variant="default" onClick={() => setArch(null)}>Cancel</Button><Button color={arch.archived ? 'green' : 'red'} loading={busy} onClick={doArchive}>{arch.archived ? 'Restore' : 'Archive'}</Button></Group></Stack>}</Modal>
  </Stack>
}

export function VendorsTab() {
  const { vendors, purchases, sales } = useMaterialStore()
  const [sel, setSel] = useState<{ old: string; name: string; mobile: string; gst: string; address: string } | null>(null)
  const dupe = sel && sel.name.trim() && sel.name.trim().toLowerCase() !== sel.old.toLowerCase() && !!findVendor(sel.name)
  const save = async () => { if (!sel) return; const next: Vendor = { name: sel.name.trim(), mobile: sel.mobile, gst: sel.gst.trim().toUpperCase(), address: sel.address.trim() }; try { if (sel.old) await editVendor(sel.old, next); else await addVendor(next); notifications.show({ color: 'green', message: 'Saved' }); setSel(null) } catch (e) { notifications.show({ color: 'red', title: 'Could not save', message: (e as Error).message }) } }
  return <Stack gap="xs">
    <Group justify="space-between"><div><Title order={4}>Vendors</Title><Text size="xs" c="dimmed">{vendors.length} vendors - one list for purchases and sales</Text></div>
      <Button leftSection={<Plus size={14} />} onClick={() => setSel({ old: '', name: '', mobile: '', gst: '', address: '' })}>Add Vendor</Button></Group>
    <Paper withBorder><Table.ScrollContainer minWidth={760}><Table highlightOnHover><Table.Thead><Table.Tr><Table.Th>Vendor</Table.Th><Table.Th>Mobile</Table.Th><Table.Th>GST number</Table.Th><Table.Th>Address</Table.Th><Table.Th ta="right">Purchases + sales</Table.Th><Table.Th ta="right" w={80}>Edit</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>{vendors.map(v => <Table.Tr key={v.name}><Table.Td fw={600}>{v.name}</Table.Td><Table.Td>{v.mobile || '-'}</Table.Td><Table.Td>{v.gst || '-'}</Table.Td><Table.Td maw={260}><Text size="sm" lineClamp={1}>{v.address || '-'}</Text></Table.Td><Table.Td ta="right">{purchases.filter(p => p.vendor === v.name).length + sales.filter(x => x.vendor === v.name).length}</Table.Td>
        <Table.Td ta="right"><Button size="compact-xs" variant="subtle" leftSection={<Pencil size={12} />} aria-label={`Edit ${v.name}`} onClick={() => setSel({ old: v.name, name: v.name, mobile: v.mobile, gst: v.gst, address: v.address })}>Edit</Button></Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></Paper>
    <Modal opened={!!sel} onClose={() => setSel(null)} title={sel?.old ? `Edit ${sel.old}` : 'Add Vendor'}>{sel && <Stack gap="sm">
      <TextInput size="xs" label="Vendor name" required value={sel.name} onChange={e => setSel({ ...sel, name: e.currentTarget.value })} error={dupe ? 'Already exists' : undefined} />
      <TextInput size="xs" label="Mobile" required inputMode="numeric" maxLength={10} value={sel.mobile} onChange={e => setSel({ ...sel, mobile: e.currentTarget.value.replace(/\D/g, '') })} error={sel.mobile && sel.mobile.length !== 10 ? 'Enter 10 digits' : undefined} />
      <TextInput size="xs" label="GST number" maxLength={40} value={sel.gst} onChange={e => setSel({ ...sel, gst: e.currentTarget.value.toUpperCase() })} placeholder="15-character GSTIN" inputWrapperOrder={['label','input','description','error']} description={sel.gst && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(sel.gst) ? <Text span size="xs" c="orange.8">Warning: this does not look like a valid 15-character GSTIN. It will still be saved.</Text> : undefined} />
      <TextInput size="xs" label="Address" value={sel.address} onChange={e => setSel({ ...sel, address: e.currentTarget.value })} placeholder="Vendor address" />
      <Group justify="flex-end"><Button variant="default" onClick={() => setSel(null)}>Cancel</Button><Button leftSection={<Save size={14} />} disabled={!sel.name.trim() || sel.mobile.length !== 10 || !!dupe} onClick={save}>Save changes</Button></Group></Stack>}</Modal>
  </Stack>
}

// Company Setup: Shreeji Enterprise address, GST number and mobile. These print on the challan.
export function CompanyTab() {
  const { company } = useMaterialStore()
  const [edit, setEdit] = useState(false), [d, setD] = useState(company)
  const ok = d.address.trim() && /^\d{10}$/.test(d.mobile)
  return <Stack gap="xs">
    <Group justify="space-between"><div><Title order={4}>Company Setup</Title><Text size="xs" c="dimmed">Printed on the challan.</Text></div>
      {!edit && <Button leftSection={<Pencil size={14} />} onClick={() => { setD(company); setEdit(true) }}>Edit</Button>}</Group>
    <Paper withBorder p="sm"><Stack gap="sm" maw={560}>
      <TextInput size="xs" label="Company name" value={company.name} disabled />
      <TextInput size="xs" label="Address" required value={edit ? d.address : company.address} disabled={!edit} onChange={e => setD({ ...d, address: e.currentTarget.value })} />
      <TextInput inputWrapperOrder={['label','input','description','error']} size="xs" label="GST number" value={edit ? d.gst : company.gst} disabled={!edit} maxLength={40} onChange={e => setD({ ...d, gst: e.currentTarget.value.toUpperCase() })} description={edit && d.gst && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(d.gst) ? <Text span size="xs" c="orange.8">Warning: this does not look like a valid 15-character GSTIN. It will still be saved.</Text> : undefined} />
      <TextInput size="xs" label="Mobile number" required value={edit ? d.mobile : company.mobile} disabled={!edit} inputMode="numeric" maxLength={10} onChange={e => setD({ ...d, mobile: e.currentTarget.value.replace(/\D/g, '') })} error={edit && d.mobile && d.mobile.length !== 10 ? 'Enter 10 digits' : undefined} />
      {edit && <Group justify="flex-end"><Button variant="default" onClick={() => setEdit(false)}>Cancel</Button><Button leftSection={<Save size={14} />} disabled={!ok} onClick={async () => { try { await setCompany({ ...d, gst: d.gst.trim().toUpperCase(), address: d.address.trim() }); notifications.show({ color: 'green', message: 'Saved' }); setEdit(false) } catch (e) { notifications.show({ color: 'red', title: 'Could not save', message: (e as Error).message }) } }}>Save changes</Button></Group>}
    </Stack></Paper>
  </Stack>
}
