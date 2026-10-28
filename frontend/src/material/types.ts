// Material module shared types and money helpers (no data lives here).
// url is an API path for stored invoices; file is set only for a file picked in the form and not yet saved.
export type Invoice = { name: string; type: string; url: string; file?: File }
// A purchase is one document (one vendor, one bill, one invoice) with one or more item lines.
export type Line = { material: string; uom: string; hsn?: string; qty: number; rate: number; gst: number; groupLine?: number; groupId?: number; groupName?: string; groupQty?: number; groupPer?: number }
export type Snapshot = { date: string; vendor: string; vendorMobile: string; vendorGst?: string; vendorAddress?: string; billNumber: string; invoice?: Invoice; items: Line[] }
// Prior versions of an edited purchase, with the period each was active. Newest first.
export type PurchaseVersion = Snapshot & { version: number; activeFrom: string; activeTo: string }
export type Purchase = Snapshot & { id: number; purchaseId: string; activeFrom: string; versions: PurchaseVersion[] }

export const UOMS = ['Bag', 'Bundle', 'Box', 'Can', 'Carton', 'Cm', 'Coil', 'Cu.ft', 'Cu.m', 'Dozen', 'Drum', 'Feet', 'Gram', 'Inch', 'Kg', 'Litre', 'Meter', 'Ml', 'Mm', 'Nos', 'Packet', 'Pair', 'Pcs', 'Quintal', 'Roll', 'Running ft', 'Set', 'Sheet', 'Sq.ft', 'Sq.m', 'Ton']
export const GST_RATES = [0, 5, 12, 18, 28]

// GST entered is split equally into SGST and CGST (user request). Amounts rounded to paise;
// if the GST paise are odd, CGST takes the extra paisa so SGST + CGST always equals the GST on the amount.
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
// Whole paise arithmetic, same rounding as the server: amount and GST amount to the paisa, SGST is half rounded down, CGST the rest.
export const calc = (qty: number, rate: number, gst: number) => {
  const subP = Math.round(qty * rate * 100)
  const gstP = Math.round(subP * gst / 100)
  const sgstP = Math.floor(gstP / 2)
  return { subtotal: subP / 100, gstAmount: gstP / 100, sgst: sgstP / 100, cgst: (gstP - sgstP) / 100, total: (subP + gstP) / 100 }
}
export const docTotals = (items: Line[]) => items.reduce((t, l) => { const c = calc(l.qty, l.rate, l.gst); return { subtotal: r2(t.subtotal + c.subtotal), sgst: r2(t.sgst + c.sgst), cgst: r2(t.cgst + c.cgst), total: r2(t.total + c.total) } }, { subtotal: 0, sgst: 0, cgst: 0, total: 0 })
export const inr = (n: number) => '\u20B9' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const num = (n: number) => n.toLocaleString('en-IN')
export const fmtDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }
