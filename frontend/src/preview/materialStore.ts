// UI PREVIEW ONLY: in-memory store shared by Material and Setup pages. Resets on reload. No API or database.
import { useSyncExternalStore } from 'react'
import { seedIssues, seedPurchases, type Issue, type Purchase } from './materialMock'

export type MaterialType = { name: string; uom: string }
export type Vendor = { name: string; mobile: string }
type State = { materialTypes: MaterialType[]; vendors: Vendor[]; purchases: Purchase[]; issues: Issue[] }

const uniq = <T,>(xs: T[], key: (x: T) => string) => { const m = new Map<string, T>(); for (const x of xs) if (!m.has(key(x))) m.set(key(x), x); return [...m.values()] }
let state: State = {
  materialTypes: uniq(seedPurchases, p => p.material).map(p => ({ name: p.material, uom: p.uom })).sort((a, b) => a.name.localeCompare(b.name)),
  vendors: uniq(seedPurchases, p => p.vendor).map(p => ({ name: p.vendor, mobile: p.vendorMobile })).sort((a, b) => a.name.localeCompare(b.name)),
  purchases: seedPurchases, issues: seedIssues,
}
const listeners = new Set<() => void>()
const set = (next: State) => { state = next; listeners.forEach(l => l()) }
export const useMaterialStore = () => useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => state)

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
export const findMaterial = (name: string) => state.materialTypes.find(m => same(m.name, name))
export const findVendor = (name: string) => state.vendors.find(v => same(v.name, name))

// A new material type or vendor typed in the purchase form is created automatically on save.
export function addPurchase(p: Omit<Purchase, 'id'>) {
  const materialTypes = findMaterial(p.material) ? state.materialTypes : [...state.materialTypes, { name: p.material, uom: p.uom }]
  const vendors = findVendor(p.vendor) ? state.vendors : [...state.vendors, { name: p.vendor, mobile: p.vendorMobile }]
  set({ ...state, materialTypes, vendors, purchases: [{ ...p, id: Date.now() }, ...state.purchases] })
}
export function editMaterialType(oldName: string, next: MaterialType) {
  set({ ...state,
    materialTypes: state.materialTypes.map(m => m.name === oldName ? next : m),
    purchases: state.purchases.map(p => p.material === oldName ? { ...p, material: next.name, uom: next.uom } : p),
    issues: state.issues.map(i => i.material === oldName ? { ...i, material: next.name } : i) })
}
export function editVendor(oldName: string, next: Vendor) {
  set({ ...state, vendors: state.vendors.map(v => v.name === oldName ? next : v),
    purchases: state.purchases.map(p => p.vendor === oldName ? { ...p, vendor: next.name, vendorMobile: next.mobile } : p) })
}
export function addMaterialType(m: MaterialType) { if (!findMaterial(m.name)) set({ ...state, materialTypes: [...state.materialTypes, m] }) }
export function addVendor(v: Vendor) { if (!findVendor(v.name)) set({ ...state, vendors: [...state.vendors, v] }) }
