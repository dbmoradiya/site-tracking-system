// UI PREVIEW ONLY: in-memory store shared by Material and Setup pages. Resets on reload. No API or database.
import { useSyncExternalStore } from 'react'
import { makeSaleId, seedCompany, seedSaleCounters, seedSales, type Company, type Sale, type SaleSnap, type SaleVersion } from './salesMock'
import { makePurchaseId, seedCounters, seedPurchases, type Purchase, type PurchaseVersion, type Snapshot } from './materialMock'

export type MaterialType = { name: string; uom: string }
export type Vendor = { name: string; mobile: string; gst: string; address: string }
type State = { materialTypes: MaterialType[]; vendors: Vendor[]; purchases: Purchase[]; sales: Sale[]; company: Company }

const uniq = <T,>(xs: T[], key: (x: T) => string) => { const m = new Map<string, T>(); for (const x of xs) if (!m.has(key(x))) m.set(key(x), x); return [...m.values()] }
// Sample GST numbers and addresses so the challan has something to show. Not real.
const sampleVendorInfo: Record<string, { gst: string; address: string }> = {
  'Ambika Traders': { gst: '24BBBBB1111B1Z6', address: 'Shop 4, APMC Market, Vasna, Ahmedabad' },
  'Jay Steel Corporation': { gst: '24CCCCC2222C1Z7', address: '88 Steel Yard, Odhav, Ahmedabad' },
  'Khodiyar Supply': { gst: '', address: 'Ring Road, Surat' },
  'Shree Electricals': { gst: '24DDDDD3333D1Z8', address: 'Station Road, Rajkot' },
  'Sunrise Solar Distributors': { gst: '24EEEEE4444E1Z9', address: 'GIDC Estate, Vadodara' },
}
const saleVendors: Record<string, { mobile: string; gst: string; address: string }> = {
  'Patel Constructions': { mobile: '9898011122', gst: '24FFFFF5555F1Z1', address: '21 Shanti Nagar, Gandhinagar' },
  'Nilesh Contractors': { mobile: '9879033344', gst: '24GGGGG6666G1Z2', address: 'Plot 7, Bopal, Ahmedabad' },
  'Ramesh Builders': { mobile: '9825055566', gst: '', address: 'Sector 11, Gandhinagar' },
}
let state: State = {
  materialTypes: uniq(seedPurchases.flatMap(p => p.items), l => l.material).map(l => ({ name: l.material, uom: l.uom })).sort((a, b) => a.name.localeCompare(b.name)),
  vendors: [...uniq(seedPurchases, p => p.vendor).map(p => ({ name: p.vendor, mobile: p.vendorMobile, ...(sampleVendorInfo[p.vendor] ?? { gst: '', address: '' }) })),
    ...Object.entries(saleVendors).map(([name, v]) => ({ name, ...v }))].sort((a, b) => a.name.localeCompare(b.name)),
  purchases: seedPurchases, sales: seedSales, company: seedCompany,
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
  vendors: findVendor(p.vendor) ? state.vendors : [...state.vendors, { name: p.vendor, mobile: p.vendorMobile, gst: p.vendorGst ?? '', address: p.vendorAddress ?? '' }] })
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
    sales: state.sales.map(x => ({ ...x, items: x.items.map(l => l.material === oldName ? { ...l, material: next.name } : l), versions: x.versions.map(v => ({ ...v, items: v.items.map(l => l.material === oldName ? { ...l, material: next.name } : l) })) })) })
}
export function editVendor(oldName: string, next: Vendor) {
  set({ ...state, vendors: state.vendors.map(v => v.name === oldName ? next : v),
    purchases: state.purchases.map(p => p.vendor === oldName ? { ...p, vendor: next.name, vendorMobile: next.mobile } : p),
    sales: state.sales.map(x => x.vendor === oldName ? { ...x, vendor: next.name } : x) })
}
export function addMaterialType(m: MaterialType) { if (!findMaterial(m.name)) set({ ...state, materialTypes: [...state.materialTypes, m] }) }
export function addVendor(v: Vendor) { if (!findVendor(v.name)) set({ ...state, vendors: [...state.vendors, v] }) }

export const setCompany = (c: Company) => set({ ...state, company: c })

// Sales (UI preview only). Debit = stock out, credit = stock in. Sites are only links (one stock effect per sale).
const saleCounters = new Map(seedSaleCounters)
export const nextSaleId = (date: string) => makeSaleId(date, (saleCounters.get(date) ?? 0) + 1)
const ensureSaleVendor = (vendor: string, extra?: Vendor) => findVendor(vendor) ? state.vendors : [...state.vendors, extra ?? { name: vendor, mobile: '', gst: '', address: '' }]
export function addSale(x: SaleSnap, newVendor?: Vendor) {
  const n = (saleCounters.get(x.date) ?? 0) + 1; saleCounters.set(x.date, n)
  set({ ...state, vendors: ensureSaleVendor(x.vendor, newVendor), sales: [{ ...x, id: Date.now(), saleId: makeSaleId(x.date, n), activeFrom: nowIso(), versions: [] }, ...state.sales] })
}
const saleSig = (x: SaleSnap) => JSON.stringify([x.type, x.date, x.vendor, [...x.siteIds].sort(), x.items.map(l => [l.material, l.uom, l.qty, l.rate, l.gst])])
export function updateSale(id: number, x: SaleSnap, newVendor?: Vendor) {
  const at = nowIso()
  set({ ...state, vendors: ensureSaleVendor(x.vendor, newVendor), sales: state.sales.map(o => {
    if (o.id !== id || saleSig(o) === saleSig(x)) return o
    const prior: SaleVersion = { version: o.versions.length + 1, activeFrom: o.activeFrom, activeTo: at, type: o.type, date: o.date, vendor: o.vendor, siteIds: o.siteIds, items: o.items }
    return { ...x, id, saleId: o.saleId, activeFrom: at, versions: [prior, ...o.versions] }
  }) })
}
export function deleteSale(id: number) { set({ ...state, sales: state.sales.filter(x => x.id !== id) }) }
