// UI PREVIEW ONLY: static mock data. No API, database or stock logic is implemented yet.
export type Purchase = { id: number; date: string; material: string; uom: string; vendor: string; vendorMobile: string; qty: number; rate: number; gst: number }
export type Issue = { id: number; date: string; material: string; qty: number; project: string; site: string; issuedTo: string }

export const UOMS = ['Bag', 'Kg', 'Ton', 'Nos', 'Meter', 'Sq.ft', 'Litre', 'Box']
export const GST_RATES = [0, 5, 12, 18, 28]

export const seedPurchases: Purchase[] = [
  { id: 1, date: '2026-10-25', material: 'Cement OPC 53', uom: 'Bag', vendor: 'Ambika Traders', vendorMobile: '9825012345', qty: 200, rate: 395, gst: 28 },
  { id: 2, date: '2026-10-22', material: 'TMT Bar 12mm', uom: 'Kg', vendor: 'Jay Steel Corporation', vendorMobile: '9898123456', qty: 1500, rate: 64, gst: 18 },
  { id: 3, date: '2026-10-20', material: 'River Sand', uom: 'Ton', vendor: 'Khodiyar Supply', vendorMobile: '9712345678', qty: 30, rate: 1200, gst: 5 },
  { id: 4, date: '2026-10-18', material: 'Cement OPC 53', uom: 'Bag', vendor: 'Ambika Traders', vendorMobile: '9825012345', qty: 300, rate: 390, gst: 28 },
  { id: 5, date: '2026-10-15', material: 'Electrical Wire 2.5 sq mm', uom: 'Meter', vendor: 'Shree Electricals', vendorMobile: '9909012345', qty: 400, rate: 22, gst: 18 },
  { id: 6, date: '2026-10-12', material: 'TMT Bar 12mm', uom: 'Kg', vendor: 'Jay Steel Corporation', vendorMobile: '9898123456', qty: 2000, rate: 62, gst: 18 },
  { id: 8, date: '2026-10-24', material: 'Solar Panel 540W', uom: 'Nos', vendor: 'Sunrise Solar Distributors', vendorMobile: '9879012345', qty: 60, rate: 14500, gst: 12 },
  { id: 9, date: '2026-10-21', material: 'Solar Inverter 5kW', uom: 'Nos', vendor: 'Sunrise Solar Distributors', vendorMobile: '9879012345', qty: 8, rate: 38000, gst: 12 },
  { id: 7, date: '2026-10-10', material: 'Wall Putty', uom: 'Bag', vendor: 'Khodiyar Supply', vendorMobile: '9712345678', qty: 40, rate: 780, gst: 28 },
]

export const seedIssues: Issue[] = [
  { id: 8, date: '2026-10-25', material: 'Solar Panel 540W', qty: 24, project: 'Sun City Complex', site: 'Block A', issuedTo: 'Nilesh Shah (Supervisor)' },
  { id: 9, date: '2026-10-22', material: 'Solar Inverter 5kW', qty: 3, project: 'Green Valley Villas', site: 'Villa 12', issuedTo: 'Ramesh Patel (Supervisor)' },
  { id: 1, date: '2026-10-26', material: 'Cement OPC 53', qty: 120, project: 'Green Valley Villas', site: 'Villa 12', issuedTo: 'Ramesh Patel (Supervisor)' },
  { id: 2, date: '2026-10-24', material: 'TMT Bar 12mm', qty: 900, project: 'Sun City Complex', site: 'Block B', issuedTo: 'Nilesh Shah (Supervisor)' },
  { id: 3, date: '2026-10-23', material: 'Cement OPC 53', qty: 150, project: 'Sun City Complex', site: 'Block A', issuedTo: 'Nilesh Shah (Supervisor)' },
  { id: 4, date: '2026-10-21', material: 'River Sand', qty: 12, project: 'Green Valley Villas', site: 'Villa 12', issuedTo: 'Ramesh Patel (Supervisor)' },
  { id: 5, date: '2026-10-19', material: 'TMT Bar 12mm', qty: 1100, project: 'Green Valley Villas', site: 'Villa 9', issuedTo: 'Ramesh Patel (Supervisor)' },
  { id: 6, date: '2026-10-16', material: 'Electrical Wire 2.5 sq mm', qty: 150, project: 'Sun City Complex', site: 'Block A', issuedTo: 'Nilesh Shah (Supervisor)' },
  { id: 7, date: '2026-10-13', material: 'Cement OPC 53', qty: 180, project: 'Green Valley Villas', site: 'Villa 9', issuedTo: 'Ramesh Patel (Supervisor)' },
]

// GST entered is split equally into SGST and CGST (user request, preview only). Amounts rounded to paise;
// if the GST paise are odd, CGST takes the extra paisa so SGST + CGST always equals the GST on the amount.
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
export const calc = (qty: number, rate: number, gst: number) => {
  const subtotal = r2(qty * rate)
  const gstAmount = r2(subtotal * gst / 100)
  const sgst = r2(Math.floor(gstAmount * 100 / 2) / 100)
  const cgst = r2(gstAmount - sgst)
  return { subtotal, gstAmount, sgst, cgst, total: r2(subtotal + sgst + cgst) }
}
export const inr = (n: number) => '\u20B9' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const num = (n: number) => n.toLocaleString('en-IN')
export const fmtDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }
