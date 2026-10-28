// Sales types (no data lives here).
import type { Line } from './types'

export type SaleType = 'DEBIT' | 'CREDIT' // Debit = material given out (stock down). Credit = material taken in (stock up).
export type SiteRef = { id: number; name: string; projectId: number; projectName: string }
export type GroupLineIn = { groupId: number; qty: number; children: { material: string; rate: number; gst: number }[] }
export type SaleSnap = { type: SaleType; date: string; vendor: string; siteIds: number[]; items: Line[]; groups?: GroupLineIn[] }
export type SaleVersion = SaleSnap & { version: number; activeFrom: string; activeTo: string; sites: SiteRef[] }
// sites carries the names the viewer is allowed to see (a coordinator only gets sites of the projects they coordinate).
export type Sale = SaleSnap & { id: number; saleId: string; activeFrom: string; sites: SiteRef[]; vendorInfo?: { mobile: string; gst: string; address: string }; versions: SaleVersion[] }
export type Company = { name: string; address: string; gst: string; mobile: string }
export const siteLabel = (s: SiteRef) => `${s.name} | ${s.projectName}`
