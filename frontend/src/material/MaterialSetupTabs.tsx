import { Button, Group, Modal, NativeSelect, Paper, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Pencil, Plus, Save } from 'lucide-react'
import { useState } from 'react'
import { UOMS } from './types'
import { addMaterialType, addVendor, editMaterialType, editVendor, findMaterial, findVendor, setCompany, useMaterialStore, type MaterialType, type Vendor } from './materialStore'

// Setup tabs for Material types, Vendors and Company. Material types created in the Purchase form appear here.
export function MaterialTypesTab() {
  const { materialTypes, purchases } = useMaterialStore()
  const [sel, setSel] = useState<{ old: string; name: string; uom: string } | null>(null)
  const dupe = sel && sel.name.trim() && sel.name.trim().toLowerCase() !== sel.old.toLowerCase() && !!findMaterial(sel.name)
  const used = !!sel?.old && (findMaterial(sel.old)?.usedCount ?? 0) > 0
  const save = async () => { if (!sel) return; const next: MaterialType = { name: sel.name.trim(), uom: used ? (findMaterial(sel.old)?.uom ?? sel.uom) : sel.uom }; try { if (sel.old) await editMaterialType(sel.old, next); else await addMaterialType(next); notifications.show({ color: 'green', message: 'Saved' }); setSel(null) } catch (e) { notifications.show({ color: 'red', title: 'Could not save', message: (e as Error).message }) } }
  return <Stack gap="xs">
    <Group justify="space-between"><div><Title order={4}>Material Types</Title><Text size="xs" c="dimmed">{materialTypes.length} types - added automatically from the Purchase form</Text></div>
      <Button leftSection={<Plus size={14} />} onClick={() => setSel({ old: '', name: '', uom: '' })}>Add Material Type</Button></Group>
    <Paper withBorder><Table.ScrollContainer minWidth={520}><Table highlightOnHover><Table.Thead><Table.Tr><Table.Th>Material type</Table.Th><Table.Th>UOM</Table.Th><Table.Th ta="right">Purchases</Table.Th><Table.Th ta="right" w={80}>Edit</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>{materialTypes.map(m => <Table.Tr key={m.name}><Table.Td fw={600}>{m.name}</Table.Td><Table.Td>{m.uom}</Table.Td><Table.Td ta="right">{purchases.filter(p => p.items.some(l => l.material === m.name)).length}</Table.Td>
        <Table.Td ta="right"><Button size="compact-xs" variant="subtle" leftSection={<Pencil size={12} />} aria-label={`Edit ${m.name}`} onClick={() => setSel({ old: m.name, name: m.name, uom: m.uom })}>Edit</Button></Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></Paper>
    <Modal opened={!!sel} onClose={() => setSel(null)} title={sel?.old ? `Edit ${sel.old}` : 'Add Material Type'}>{sel && <Stack gap="sm">
      <TextInput size="xs" label="Material type" required value={sel.name} onChange={e => setSel({ ...sel, name: e.currentTarget.value })} error={dupe ? 'Already exists' : undefined} />
      <NativeSelect size="xs" label="Unit of measurement" value={sel.uom} onChange={e => setSel({ ...sel, uom: e.currentTarget.value })} disabled={used} description={used ? 'Locked: purchases already use this unit' : undefined} data={[{ value: '', label: 'Select unit' }, ...UOMS.map(u => ({ value: u, label: u }))]} />
      <Group justify="flex-end"><Button variant="default" onClick={() => setSel(null)}>Cancel</Button><Button leftSection={<Save size={14} />} disabled={!sel.name.trim() || !sel.uom || !!dupe} onClick={save}>Save changes</Button></Group></Stack>}</Modal>
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
      <TextInput size="xs" label="GST number" maxLength={15} value={sel.gst} onChange={e => setSel({ ...sel, gst: e.currentTarget.value.toUpperCase() })} placeholder="15-character GSTIN" error={sel.gst && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(sel.gst) ? 'GSTIN looks invalid (15 characters)' : undefined} />
      <TextInput size="xs" label="Address" value={sel.address} onChange={e => setSel({ ...sel, address: e.currentTarget.value })} placeholder="Vendor address" />
      <Group justify="flex-end"><Button variant="default" onClick={() => setSel(null)}>Cancel</Button><Button leftSection={<Save size={14} />} disabled={!sel.name.trim() || sel.mobile.length !== 10 || !!dupe || (!!sel.gst && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(sel.gst))} onClick={save}>Save changes</Button></Group></Stack>}</Modal>
  </Stack>
}

// Company Setup: Shreeji Enterprise address, GST number and mobile. These print on the challan.
export function CompanyTab() {
  const { company } = useMaterialStore()
  const [edit, setEdit] = useState(false), [d, setD] = useState(company)
  const ok = d.address.trim() && /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(d.gst.trim().toUpperCase()) && /^\d{10}$/.test(d.mobile)
  return <Stack gap="xs">
    <Group justify="space-between"><div><Title order={4}>Company Setup</Title><Text size="xs" c="dimmed">Printed on the challan.</Text></div>
      {!edit && <Button leftSection={<Pencil size={14} />} onClick={() => { setD(company); setEdit(true) }}>Edit</Button>}</Group>
    <Paper withBorder p="sm"><Stack gap="sm" maw={560}>
      <TextInput size="xs" label="Company name" value={company.name} disabled />
      <TextInput size="xs" label="Address" required value={edit ? d.address : company.address} disabled={!edit} onChange={e => setD({ ...d, address: e.currentTarget.value })} />
      <TextInput size="xs" label="GST number" required value={edit ? d.gst : company.gst} disabled={!edit} maxLength={15} onChange={e => setD({ ...d, gst: e.currentTarget.value.toUpperCase() })} error={edit && d.gst && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(d.gst) ? 'GSTIN looks invalid (15 characters)' : undefined} />
      <TextInput size="xs" label="Mobile number" required value={edit ? d.mobile : company.mobile} disabled={!edit} inputMode="numeric" maxLength={10} onChange={e => setD({ ...d, mobile: e.currentTarget.value.replace(/\D/g, '') })} error={edit && d.mobile && d.mobile.length !== 10 ? 'Enter 10 digits' : undefined} />
      {edit && <Group justify="flex-end"><Button variant="default" onClick={() => setEdit(false)}>Cancel</Button><Button leftSection={<Save size={14} />} disabled={!ok} onClick={async () => { try { await setCompany({ ...d, gst: d.gst.trim().toUpperCase(), address: d.address.trim() }); notifications.show({ color: 'green', message: 'Saved' }); setEdit(false) } catch (e) { notifications.show({ color: 'red', title: 'Could not save', message: (e as Error).message }) } }}>Save changes</Button></Group>}
    </Stack></Paper>
  </Stack>
}
