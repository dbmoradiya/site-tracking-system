// UI PREVIEW ONLY: static mock data. No API, database or stock logic is implemented yet.
export type Invoice = { name: string; type: string; url: string }
export type Purchase = { id: number; purchaseId: string; billNumber: string; invoice?: Invoice; date: string; material: string; uom: string; vendor: string; vendorMobile: string; qty: number; rate: number; gst: number }
export type Issue = { id: number; date: string; material: string; qty: number; project: string; site: string; issuedTo: string }

export const UOMS = ['Bag', 'Kg', 'Ton', 'Nos', 'Meter', 'Sq.ft', 'Litre', 'Box']
export const GST_RATES = [0, 5, 12, 18, 28]

const seedBase: Omit<Purchase, 'purchaseId' | 'billNumber'>[] = [
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

// Purchase ID pattern from the user's example (SE261027001 = SE + yyMMdd + 3-digit counter). Counter policy is illustrative.
export const makePurchaseId = (date: string, n: number) => 'SE' + date.slice(2, 4) + date.slice(5, 7) + date.slice(8, 10) + String(n).padStart(3, '0')
const svgInvoice = (no: string, vendor: string, total: string) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#fff" stroke="#999"/><text x="40" y="70" font-size="28" font-family="Arial" font-weight="bold">TAX INVOICE (sample)</text><text x="40" y="120" font-size="18" font-family="Arial">Invoice no: ${no}</text><text x="40" y="150" font-size="18" font-family="Arial">Vendor: ${vendor}</text><line x1="40" y1="180" x2="560" y2="180" stroke="#333"/><text x="40" y="220" font-size="16" font-family="Arial">Sample image invoice for preview only</text><text x="40" y="700" font-size="22" font-family="Arial" font-weight="bold">Grand total: ${total}</text></svg>`)
const pdfInvoice = () => { const body = 'BT /F1 22 Tf 60 740 Td (TAX INVOICE - sample PDF, preview only) Tj ET\nBT /F1 14 Tf 60 700 Td (Invoice no: JS/2410/118) Tj ET'
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${body.length} >>\nstream\n${body}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  let out = '%PDF-1.4\n'; const off: number[] = []; objs.forEach((o, k) => { off.push(out.length); out += `${k + 1} 0 obj\n${o}\nendobj\n` })
  const x = out.length; out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`
  return 'data:application/pdf;base64,' + btoa(out) }
const seedBills: Record<number, { billNumber: string; invoice?: Invoice }> = {
  1: { billNumber: 'AT/2526/0417', invoice: { name: 'invoice-AT-0417.svg', type: 'image/svg+xml', url: svgInvoice('AT/2526/0417', 'Ambika Traders', '1,01,120.00') } },
  2: { billNumber: 'JS/2410/118', invoice: { name: 'invoice-JS-118.pdf', type: 'application/pdf', url: pdfInvoice() } },
  3: { billNumber: 'KS-0092' },
}
const counters = new Map<string, number>()
export const seedPurchases: Purchase[] = [...seedBase].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).map(p => {
  const n = (counters.get(p.date) ?? 0) + 1; counters.set(p.date, n)
  return { ...p, purchaseId: makePurchaseId(p.date, n), billNumber: seedBills[p.id]?.billNumber ?? '', invoice: seedBills[p.id]?.invoice }
}).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
export const seedCounters = counters

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
