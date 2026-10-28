// Material module data. Loaded from the API (admin only); every change goes to the server and then reloads.
import { useEffect, useSyncExternalStore } from 'react'
import { api } from '../lib/api'
import type { Company, Sale, SaleSnap, SiteRef } from './sales'
import type { Purchase, Snapshot } from './types'

export type MaterialType = { id?: number; name: string; uom: string; hsn?: string; usedCount?: number }
export type MaterialGroup = { id: number; name: string; archived: boolean; usedCount: number; items: { materialId: number; material: string; uom: string; hsn: string; qty: number }[] }
export type Vendor = { id?: number; name: string; mobile: string; gst: string; address: string }
type State = { loaded: boolean; error: string; materialTypes: MaterialType[]; groups: MaterialGroup[]; vendors: Vendor[]; purchases: Purchase[]; sales: Sale[]; company: Company; sites: SiteRef[] }

const emptyCompany: Company = { name: 'Shreeji Enterprise', address: '', gst: '', mobile: '' }
let state: State = { loaded: false, error: '', materialTypes: [], groups: [], vendors: [], purchases: [], sales: [], company: emptyCompany, sites: [] }
let loading = false
const listeners = new Set<() => void>()
const set = (next: State) => { state = next; listeners.forEach(l => l()) }

type Bootstrap = { materialTypes: MaterialType[]; groups?: MaterialGroup[]; vendors: Vendor[]; company: Company; purchases: Purchase[]; sales: Sale[]; sites: SiteRef[] }
export async function loadMaterial() {
  loading = true
  try {
    const b = await api<Bootstrap>('/material/bootstrap')
    set({ loaded: true, error: '', materialTypes: b.materialTypes, groups: b.groups ?? [], vendors: b.vendors, purchases: b.purchases, sales: b.sales, company: b.company, sites: b.sites })
  } catch (e) { set({ ...state, error: (e as Error).message }) } finally { loading = false }
}
/** skipLoad: read-only viewers (coordinators) have no access to the admin data, so they never load it. */
export const useMaterialStore = (skipLoad = false) => {
  useEffect(() => { if (!skipLoad && !state.loaded && !loading) void loadMaterial() }, [skipLoad])
  return useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => state)
}

// Sites seen so far (the admin list plus the sites on every sale loaded), so a site id can be shown as "Site | Project".
const siteCache = new Map<number, SiteRef>()
export const rememberSites = (sites: SiteRef[]) => sites.forEach(s => siteCache.set(s.id, s))
export const siteById = (id: number) => { state.sites.forEach(s => siteCache.set(s.id, s)); state.sales.forEach(x => { rememberSites(x.sites); x.versions.forEach(v => rememberSites(v.sites)) }); return siteCache.get(id) }

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
export const findMaterial = (name: string) => state.materialTypes.find(m => same(m.name, name))
export const findVendor = (name: string) => state.vendors.find(v => same(v.name, name))

const form = (data: unknown, file?: File) => { const f = new FormData(); f.append('data', JSON.stringify(data)); if (file) f.append('invoice', file); return f }
const purchaseData = (p: Snapshot, removeInvoice?: boolean) => ({ date: p.date, vendor: p.vendor, vendorMobile: p.vendorMobile, vendorGst: p.vendorGst ?? '', vendorAddress: p.vendorAddress ?? '', billNumber: p.billNumber, removeInvoice: !!removeInvoice, items: p.items })

export async function addPurchase(p: Snapshot) {
  await api('/material/purchases', { method: 'POST', body: form(purchaseData(p), p.invoice?.file) })
  await loadMaterial()
}
export async function updatePurchase(id: number, p: Snapshot) {
  const had = state.purchases.find(x => x.id === id)?.invoice
  await api(`/material/purchases/${id}`, { method: 'PUT', body: form(purchaseData(p, !!had && !p.invoice), p.invoice?.file) })
  await loadMaterial()
}
/** Returns stock warnings (a material that went below zero). */
export async function deletePurchase(id: number) {
  const r = await api<{ warnings: string[] }>(`/material/purchases/${id}`, { method: 'DELETE' }); await loadMaterial(); return r.warnings
}
const saleData = (x: SaleSnap, nv?: Vendor) => ({ type: x.type, date: x.date, vendor: x.vendor, siteIds: x.siteIds, items: x.items, groups: x.groups ?? [], newVendor: nv ? { name: nv.name, mobile: nv.mobile, gst: nv.gst, address: nv.address } : null })
export async function addSale(x: SaleSnap, nv?: Vendor) {
  const r = await api<{ warnings: string[] }>('/material/sales', { method: 'POST', body: JSON.stringify(saleData(x, nv)) }); await loadMaterial(); return r.warnings
}
export async function updateSale(id: number, x: SaleSnap, nv?: Vendor) {
  const r = await api<{ warnings: string[] }>(`/material/sales/${id}`, { method: 'PUT', body: JSON.stringify(saleData(x, nv)) }); await loadMaterial(); return r.warnings
}
export async function deleteSale(id: number) {
  const r = await api<{ warnings: string[] }>(`/material/sales/${id}`, { method: 'DELETE' }); await loadMaterial(); return r.warnings
}
export async function addMaterialType(m: MaterialType) { await api('/material/types', { method: 'POST', body: JSON.stringify({ name: m.name, uom: m.uom, hsn: m.hsn ?? '' }) }); await loadMaterial() }
export async function editMaterialType(oldName: string, m: MaterialType) {
  const cur = findMaterial(oldName); if (!cur?.id) throw new Error('Material type not found')
  await api(`/material/types/${cur.id}`, { method: 'PUT', body: JSON.stringify({ name: m.name, uom: m.uom, hsn: m.hsn ?? '' }) }); await loadMaterial()
}
export async function addVendor(v: Vendor) { await api('/material/vendors', { method: 'POST', body: JSON.stringify(v) }); await loadMaterial() }
export async function editVendor(oldName: string, v: Vendor) {
  const cur = findVendor(oldName); if (!cur?.id) throw new Error('Vendor not found')
  await api(`/material/vendors/${cur.id}`, { method: 'PUT', body: JSON.stringify(v) }); await loadMaterial()
}
export async function setCompany(c: Company) { await api('/material/company', { method: 'PUT', body: JSON.stringify(c) }); await loadMaterial() }

export type GroupDraft = { name: string; items: { material: string; qty: number }[] }
export async function addGroup(g: GroupDraft) { await api('/material/groups', { method: 'POST', body: JSON.stringify(g) }); await loadMaterial() }
export async function editGroup(id: number, g: GroupDraft) { await api(`/material/groups/${id}`, { method: 'PUT', body: JSON.stringify(g) }); await loadMaterial() }
export async function archiveGroup(id: number, archived: boolean) { await api(`/material/groups/${id}/${archived ? 'archive' : 'restore'}`, { method: 'POST' }); await loadMaterial() }
