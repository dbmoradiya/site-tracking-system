import { Combobox, InputBase, useCombobox } from '@mantine/core'
import { Plus } from 'lucide-react'
import { useState } from 'react'

type Props = { label: string; placeholder: string; options: string[]; value: string; onChange: (value: string, created: boolean) => void; required?: boolean; createLabel?: string }

export function CreatableSelect({ label, placeholder, options, value, onChange, required, createLabel = 'Add' }: Props) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() })
  const [search, setSearch] = useState(value)
  const q = search.trim()
  const filtered = options.filter(o => o.toLowerCase().includes(q.toLowerCase()))
  const exact = options.some(o => o.toLowerCase() === q.toLowerCase())
  const pick = (val: string) => {
    if (val === '__create__') { setSearch(q); onChange(q, true) }
    else { setSearch(val); onChange(val, false) }
    combobox.closeDropdown()
  }
  return <Combobox store={combobox} withinPortal={false} onOptionSubmit={pick}>
    <Combobox.Target>
      <InputBase size="xs" label={label} required={required} placeholder={placeholder} value={search} rightSection={<Combobox.Chevron />} rightSectionPointerEvents="none"
        onChange={e => { setSearch(e.currentTarget.value); onChange(e.currentTarget.value, !options.some(o => o.toLowerCase() === e.currentTarget.value.trim().toLowerCase())); combobox.openDropdown(); combobox.updateSelectedOptionIndex() }}
        onClick={() => combobox.openDropdown()} onFocus={() => combobox.openDropdown()} onBlur={() => combobox.closeDropdown()} />
    </Combobox.Target>
    <Combobox.Dropdown>
      <Combobox.Options mah={200} style={{ overflowY: 'auto' }}>
        {filtered.map(o => <Combobox.Option value={o} key={o}>{o}</Combobox.Option>)}
        {q && !exact && <Combobox.Option value="__create__"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--mantine-color-orange-8)' }}><Plus size={14} aria-hidden="true" />{createLabel} &ldquo;{q}&rdquo;</span></Combobox.Option>}
        {filtered.length === 0 && !q && <Combobox.Empty>Type to search or add</Combobox.Empty>}
      </Combobox.Options>
    </Combobox.Dropdown>
  </Combobox>
}
