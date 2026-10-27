// UI PREVIEW ONLY: sample sales data, sites and projects. No API, database, stock or challan backend exists yet.
import type { Line } from './materialMock'

export type SaleType = 'DEBIT' | 'CREDIT' // Debit = material given out (stock down). Credit = material taken in (stock up).
export type SaleSnap = { type: SaleType; date: string; vendor: string; siteIds: number[]; items: Line[] }
export type SaleVersion = SaleSnap & { version: number; activeFrom: string; activeTo: string }
export type Sale = SaleSnap & { id: number; saleId: string; activeFrom: string; versions: SaleVersion[] }
export type SiteRef = { id: number; name: string; projectId: number; projectName: string }
export type Company = { name: string; address: string; gst: string; mobile: string }

export const PREVIEW_SITES: SiteRef[] = [
  { id: 101, name: 'Block A', projectId: 1, projectName: 'Sun City Complex' },
  { id: 102, name: 'Block B', projectId: 1, projectName: 'Sun City Complex' },
  { id: 201, name: 'Villa 9', projectId: 2, projectName: 'Green Valley Villas' },
  { id: 202, name: 'Villa 12', projectId: 2, projectName: 'Green Valley Villas' },
]
export const siteLabel = (s: SiteRef) => `${s.name} | ${s.projectName}`
export const siteById = (id: number) => PREVIEW_SITES.find(s => s.id === id)

// Sample values only. The user edits the real ones in Setup > Company Setup.
export const seedCompany: Company = { name: 'Shreeji Enterprise', address: '12, Sample Industrial Estate, Naroda, Ahmedabad - 382330', gst: '24AAAAA0000A1Z5', mobile: '9999900000' }

export const makeSaleId = (date: string, n: number) => 'SES' + date.slice(2, 4) + date.slice(5, 7) + date.slice(8, 10) + String(n).padStart(3, '0')
const L = (material: string, uom: string, qty: number, rate: number, gst: number): Line => ({ material, uom, qty, rate, gst })

type Seed = Omit<Sale, 'saleId' | 'activeFrom' | 'versions'>
const seed: Seed[] = [
  { id: 1, type: 'DEBIT', date: '2026-10-13', vendor: 'Patel Constructions', siteIds: [201], items: [L('Cement OPC 53', 'Bag', 180, 430, 28)] },
  { id: 2, type: 'DEBIT', date: '2026-10-16', vendor: 'Nilesh Contractors', siteIds: [101], items: [L('Electrical Wire 2.5 sq mm', 'Meter', 150, 26, 18)] },
  { id: 3, type: 'DEBIT', date: '2026-10-19', vendor: 'Patel Constructions', siteIds: [201], items: [L('TMT Bar 12mm', 'Kg', 1100, 70, 18)] },
  { id: 4, type: 'DEBIT', date: '2026-10-21', vendor: 'Patel Constructions', siteIds: [202], items: [L('River Sand', 'Ton', 12, 1400, 5)] },
  { id: 5, type: 'DEBIT', date: '2026-10-23', vendor: 'Nilesh Contractors', siteIds: [101], items: [L('Cement OPC 53', 'Bag', 150, 430, 28)] },
  { id: 6, type: 'DEBIT', date: '2026-10-24', vendor: 'Nilesh Contractors', siteIds: [102], items: [L('TMT Bar 12mm', 'Kg', 900, 70, 18)] },
  { id: 7, type: 'DEBIT', date: '2026-10-25', vendor: 'Ramesh Builders', siteIds: [101, 202], items: [L('Solar Panel 540W', 'Nos', 24, 16000, 12), L('Solar Inverter 5kW', 'Nos', 3, 42000, 12)] },
  { id: 8, type: 'DEBIT', date: '2026-10-26', vendor: 'Patel Constructions', siteIds: [202], items: [L('Cement OPC 53', 'Bag', 120, 430, 28)] },
  { id: 9, type: 'CREDIT', date: '2026-10-26', vendor: 'Nilesh Contractors', siteIds: [102], items: [L('TMT Bar 12mm', 'Kg', 150, 62, 18)] },
]
const counters = new Map<string, number>()
export const seedSales: Sale[] = [...seed].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).map(s => {
  const n = (counters.get(s.date) ?? 0) + 1; counters.set(s.date, n)
  return { ...s, saleId: makeSaleId(s.date, n), activeFrom: `${s.date}T10:00:00`, versions: [] }
}).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
export const seedSaleCounters = counters
