import { Button, Menu } from '@mantine/core'
import { Download } from 'lucide-react'
import { exportCsv, exportXlsx, type Table } from './exporter'

// Exports exactly the rows passed in (what the grid currently shows). Preview only: sample data.
export function ExportMenu({ table, filename, label = 'Export', note }: { table: Table; filename: string; label?: string; note?: string }) {
  return <Menu position="bottom-end" width={230} withinPortal>
    <Menu.Target><Button size="xs" variant="default" leftSection={<Download size={14} aria-hidden="true" />} aria-label={`${label} ${table.sheet}`}>{label}</Button></Menu.Target>
    <Menu.Dropdown>
      <Menu.Label>{table.rows.length} rows{note ? ` - ${note}` : ''}</Menu.Label>
      <Menu.Item onClick={() => exportXlsx(table, filename)}>Excel (.xlsx)</Menu.Item>
      <Menu.Item onClick={() => exportCsv(table, filename)}>CSV (.csv)</Menu.Item>
    </Menu.Dropdown>
  </Menu>
}
