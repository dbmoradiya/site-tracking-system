// UI PREVIEW ONLY: in-memory store shared by Material and Setup pages. Resets on reload. No API or database.
import { useSyncExternalStore } from 'react'
import { makePurchaseId, seedCounters, seedIssues, seedPurchases, type Issue, type Purchase } from './materialMock'

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
const counters = new Map(seedCounters) // never reuses a number for a date, even after delete (illustrative policy)
const ensureRefs = (p: { material: string; uom: string; vendor: string; vendorMobile: string }) => ({
  materialTypes: findMaterial(p.material) ? state.materialTypes : [...state.materialTypes, { name: p.material, uom: p.uom }],
  vendors: findVendor(p.vendor) ? state.vendors : [...state.vendors, { name: p.vendor, mobile: p.vendorMobile }] })
export const nextPurchaseId = (date: string) => makePurchaseId(date, (counters.get(date) ?? 0) + 1)
export function updatePurchase(id: number, p: Omit<Purchase, 'id' | 'purchaseId'>) {
  // Purchase ID never changes on edit, even if the date changes.
  set({ ...state, ...ensureRefs(p), purchases: state.purchases.map(x => x.id === id ? { ...p, id, purchaseId: x.purchaseId } : x) })
}
export function deletePurchase(id: number) { set({ ...state, purchases: state.purchases.filter(x => x.id !== id) }) }
export function addPurchase(p: Omit<Purchase, 'id' | 'purchaseId'>) {
  const n = (counters.get(p.date) ?? 0) + 1; counters.set(p.date, n)
  set({ ...state, ...ensureRefs(p), purchases: [{ ...p, id: Date.now(), purchaseId: makePurchaseId(p.date, n) }, ...state.purchases] })
}
export function editMaterialType(oldName: string, next: MaterialType) {
  set({ ...state,
    materialTypes: state.materialTypes.map(m => m.name === oldName ? next : m),
    // Rename only: historical purchases keep their own UOM and quantity, never reinterpreted.
    purchases: state.purchases.map(p => p.material === oldName ? { ...p, material: next.name } : p),
    issues: state.issues.map(i => i.material === oldName ? { ...i, material: next.name } : i) })
}
export function editVendor(oldName: string, next: Vendor) {
  set({ ...state, vendors: state.vendors.map(v => v.name === oldName ? next : v),
    purchases: state.purchases.map(p => p.vendor === oldName ? { ...p, vendor: next.name, vendorMobile: next.mobile } : p) })
}
export function addMaterialType(m: MaterialType) { if (!findMaterial(m.name)) set({ ...state, materialTypes: [...state.materialTypes, m] }) }
export function addVendor(v: Vendor) { if (!findVendor(v.name)) set({ ...state, vendors: [...state.vendors, v] }) }
