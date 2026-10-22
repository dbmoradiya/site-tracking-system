import { MultiSelect } from '@mantine/core'

export type BusinessRole = 'COORDINATOR' | 'SUPERVISOR' | 'DESIGN_ENGINEER' | 'PROCUREMENT_MANAGER' | 'TEAM'
export function titleCase(value: string) { return value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) }
const people: BusinessRole[] = ['COORDINATOR', 'SUPERVISOR', 'DESIGN_ENGINEER', 'PROCUREMENT_MANAGER']

export function RolesSelect({ label, selected, onChange, includeTeam, required }: { label: string; selected: BusinessRole[]; onChange: (roles: BusinessRole[]) => void; includeTeam?: boolean; required?: boolean }) {
  const options = (includeTeam ? [...people, 'TEAM' as BusinessRole] : people).map(role => ({ value: role, label: titleCase(role) }))
  return <MultiSelect label={label} required={required} data={options} value={selected} onChange={value => onChange(value as BusinessRole[])}
    placeholder={selected.length ? undefined : 'No roles'} clearable hidePickedOptions={false} comboboxProps={{ withinPortal: true, zIndex: 1000 }} />
}
