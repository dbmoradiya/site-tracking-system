// UI PREVIEW ONLY: in-memory store shared by Material and Setup pages. Resets on reload. No API or database.
import { useSyncExternalStore } from 'react'
import { makePurchaseId, seedCounters, seedIssues, seedPurchases, type Issue, type Purchase, type PurchaseVersion, type Snapshot } from './materialMock'

export type MaterialType = { name: string; uom: string }
export type Vendor = { name: string; mobile: string }
type State = { materialTypes: MaterialType[]; vendors: Vendor[]; purchases: Purchase[]; issues: Issue[] }

const uniq = <T,>(xs: T[], key: (x: T) => string) => { const m = new Map<string, T>(); for (const x of xs) if (!m.has(key(x))) m.set(key(x), x); return [...m.values()] }
let state: State = {
  materialTypes: uniq(seedPurchases.flatMap(p => p.items), l => l.material).map(l => ({ name: l.material, uom: l.uom })).sort((a, b) => a.name.localeCompare(b.name)),
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
const ensureRefs = (p: Snapshot) => ({
  materialTypes: [...state.materialTypes, ...uniq(p.items.filter(l => !findMaterial(l.material)), l => l.material.toLowerCase()).map(l => ({ name: l.material, uom: l.uom }))],
  vendors: findVendor(p.vendor) ? state.vendors : [...state.vendors, { name: p.vendor, mobile: p.vendorMobile }] })
export const nextPurchaseId = (date: string) => makePurchaseId(date, (counters.get(date) ?? 0) + 1)
const nowIso = () => { const d = new Date(); const z = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}` }
const sig = (p: Snapshot) => JSON.stringify([p.date, p.vendor, p.vendorMobile, p.billNumber, p.invoice?.url ?? '', p.items.map(l => [l.material, l.uom, l.qty, l.rate, l.gst])])
export function updatePurchase(id: number, p: Snapshot) {
  // Purchase ID never changes on edit. Every real change keeps the previous whole document as a version with its active period. No change = no new version.
  const at = nowIso()
  set({ ...state, ...ensureRefs(p), purchases: state.purchases.map(x => {
    if (x.id !== id || sig(x) === sig(p)) return x
    const prior: PurchaseVersion = { version: x.versions.length + 1, activeFrom: x.activeFrom, activeTo: at, date: x.date, vendor: x.vendor, vendorMobile: x.vendorMobile, billNumber: x.billNumber, invoice: x.invoice, items: x.items }
    return { ...p, id, purchaseId: x.purchaseId, activeFrom: at, versions: [prior, ...x.versions] }
  }) })
}
export function deletePurchase(id: number) { set({ ...state, purchases: state.purchases.filter(x => x.id !== id) }) }
export function addPurchase(p: Snapshot) {
  const n = (counters.get(p.date) ?? 0) + 1; counters.set(p.date, n)
  set({ ...state, ...ensureRefs(p), purchases: [{ ...p, id: Date.now(), purchaseId: makePurchaseId(p.date, n), activeFrom: nowIso(), versions: [] }, ...state.purchases] })
}
export function editMaterialType(oldName: string, next: MaterialType) {
  set({ ...state,
    materialTypes: state.materialTypes.map(m => m.name === oldName ? next : m),
    // Rename only: historical purchases keep their own UOM and quantity, never reinterpreted.
    purchases: state.purchases.map(p => ({ ...p, items: p.items.map(l => l.material === oldName ? { ...l, material: next.name } : l), versions: p.versions.map(v => ({ ...v, items: v.items.map(l => l.material === oldName ? { ...l, material: next.name } : l) })) })),
    issues: state.issues.map(i => i.material === oldName ? { ...i, material: next.name } : i) })
}
export function editVendor(oldName: string, next: Vendor) {
  set({ ...state, vendors: state.vendors.map(v => v.name === oldName ? next : v),
    purchases: state.purchases.map(p => p.vendor === oldName ? { ...p, vendor: next.name, vendorMobile: next.mobile } : p) })
}
export function addMaterialType(m: MaterialType) { if (!findMaterial(m.name)) set({ ...state, materialTypes: [...state.materialTypes, m] }) }
export function addVendor(v: Vendor) { if (!findVendor(v.name)) set({ ...state, vendors: [...state.vendors, v] }) }
