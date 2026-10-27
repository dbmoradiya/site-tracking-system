import { Button, Group, Modal, NativeSelect, Paper, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Pencil, Plus, Save } from 'lucide-react'
import { useState } from 'react'
import { UOMS } from './materialMock'
import { addMaterialType, addVendor, editMaterialType, editVendor, findMaterial, findVendor, useMaterialStore, type MaterialType, type Vendor } from './materialStore'

// UI PREVIEW ONLY: Setup tabs for Material types and Vendors. Items created in the Purchase form appear here.
export function MaterialTypesTab() {
  const { materialTypes, purchases } = useMaterialStore()
  const [sel, setSel] = useState<{ old: string; name: string; uom: string } | null>(null)
  const dupe = sel && sel.name.trim() && sel.name.trim().toLowerCase() !== sel.old.toLowerCase() && !!findMaterial(sel.name)
  const used = !!sel?.old && purchases.some(p => p.items.some(l => l.material === sel.old))
  const save = () => { if (!sel) return; const next: MaterialType = { name: sel.name.trim(), uom: used ? (findMaterial(sel.old)?.uom ?? sel.uom) : sel.uom }; sel.old ? editMaterialType(sel.old, next) : addMaterialType(next); notifications.show({ color: 'green', message: 'Saved in preview only' }); setSel(null) }
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
  const { vendors, purchases } = useMaterialStore()
  const [sel, setSel] = useState<{ old: string; name: string; mobile: string } | null>(null)
  const dupe = sel && sel.name.trim() && sel.name.trim().toLowerCase() !== sel.old.toLowerCase() && !!findVendor(sel.name)
  const save = () => { if (!sel) return; const next: Vendor = { name: sel.name.trim(), mobile: sel.mobile }; sel.old ? editVendor(sel.old, next) : addVendor(next); notifications.show({ color: 'green', message: 'Saved in preview only' }); setSel(null) }
  return <Stack gap="xs">
    <Group justify="space-between"><div><Title order={4}>Vendors</Title><Text size="xs" c="dimmed">{vendors.length} vendors - added automatically from the Purchase form</Text></div>
      <Button leftSection={<Plus size={14} />} onClick={() => setSel({ old: '', name: '', mobile: '' })}>Add Vendor</Button></Group>
    <Paper withBorder><Table.ScrollContainer minWidth={520}><Table highlightOnHover><Table.Thead><Table.Tr><Table.Th>Vendor</Table.Th><Table.Th>Mobile</Table.Th><Table.Th ta="right">Purchases</Table.Th><Table.Th ta="right" w={80}>Edit</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>{vendors.map(v => <Table.Tr key={v.name}><Table.Td fw={600}>{v.name}</Table.Td><Table.Td>{v.mobile}</Table.Td><Table.Td ta="right">{purchases.filter(p => p.vendor === v.name).length}</Table.Td>
        <Table.Td ta="right"><Button size="compact-xs" variant="subtle" leftSection={<Pencil size={12} />} aria-label={`Edit ${v.name}`} onClick={() => setSel({ old: v.name, name: v.name, mobile: v.mobile })}>Edit</Button></Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></Paper>
    <Modal opened={!!sel} onClose={() => setSel(null)} title={sel?.old ? `Edit ${sel.old}` : 'Add Vendor'}>{sel && <Stack gap="sm">
      <TextInput size="xs" label="Vendor name" required value={sel.name} onChange={e => setSel({ ...sel, name: e.currentTarget.value })} error={dupe ? 'Already exists' : undefined} />
      <TextInput size="xs" label="Mobile" required inputMode="numeric" maxLength={10} value={sel.mobile} onChange={e => setSel({ ...sel, mobile: e.currentTarget.value.replace(/\D/g, '') })} error={sel.mobile && sel.mobile.length !== 10 ? 'Enter 10 digits' : undefined} />
      <Group justify="flex-end"><Button variant="default" onClick={() => setSel(null)}>Cancel</Button><Button leftSection={<Save size={14} />} disabled={!sel.name.trim() || sel.mobile.length !== 10 || !!dupe} onClick={save}>Save changes</Button></Group></Stack>}</Modal>
  </Stack>
}
