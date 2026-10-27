// UI PREVIEW ONLY: builds a sample challan PDF in the browser so View and Download can be shown.
// In the real build the challan PDF is generated on the backend when a sale is created.
import { calc, docTotals, fmtDate } from './materialMock'
import type { Company, Sale } from './salesMock'
import { siteById } from './salesMock'
import type { Vendor } from './materialStore'

type Op = string
const esc = (s: string) => s.replace(/[^\x20-\x7e]/g, '?').replace(/([\\()])/g, '\\$1')
const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const wrap = (s: string, n: number) => { const out: string[] = []; let cur = ''; for (const w of s.split(/\s+/)) { if ((cur + ' ' + w).trim().length > n) { out.push(cur); cur = w } else cur = (cur + ' ' + w).trim() } if (cur) out.push(cur); return out }

export function challanPdf(sale: Sale, vendor: Vendor | undefined, company: Company): Blob {
  const pages: Op[][] = [[]]
  let y = 800
  const ops = () => pages[pages.length - 1]
  const text = (x: number, yy: number, s: string, font: 'F1' | 'F2' | 'F3' | 'F4', size: number) => ops().push(`BT /${font} ${size} Tf ${x} ${yy} Td (${esc(s)}) Tj ET`)
  const rule = (yy: number) => ops().push(`0.6 w 40 ${yy} m 555 ${yy} l S`)
  const L = 40
  const need = (h: number) => { if (y - h < 60) { pages.push([]); y = 800; text(L, y, `${sale.saleId} (continued)`, 'F1', 10); y -= 20 } }
  text(L, y, company.name, 'F1', 17); y -= 15
  for (const line of wrap(company.address, 95)) { text(L, y, line, 'F2', 9); y -= 11 }
  text(L, y, `GSTIN: ${company.gst || '-'}    Mobile: ${company.mobile || '-'}`, 'F2', 9); y -= 8
  rule(y); y -= 20
  text(L, y, sale.type === 'DEBIT' ? 'DELIVERY CHALLAN' : 'MATERIAL RECEIPT CHALLAN', 'F1', 13)
  text(330, y, sale.type === 'DEBIT' ? 'Debit - material given out' : 'Credit - material taken in', 'F2', 9); y -= 18
  text(L, y, `Challan no: ${sale.saleId}`, 'F1', 10); text(330, y, `Date: ${fmtDate(sale.date)}`, 'F1', 10); y -= 18
  text(L, y, 'Party (vendor)', 'F1', 9); y -= 12
  for (const line of wrap(vendor?.name ?? sale.vendor, 80)) { need(14); text(L, y, line, 'F2', 10); y -= 12 }
  text(L, y, `Mobile: ${vendor?.mobile || '-'}    GSTIN: ${vendor?.gst || '-'}`, 'F2', 9); y -= 11
  for (const line of wrap(`Address: ${vendor?.address || '-'}`, 95)) { need(14); text(L, y, line, 'F2', 9); y -= 11 }
  y -= 4
  text(L, y, 'Sites', 'F1', 9); y -= 12
  for (const id of sale.siteIds) { const s = siteById(id); for (const line of wrap(s ? `${s.name} | ${s.projectName}` : `Site ${id}`, 95)) { need(14); text(L, y, line, 'F2', 9); y -= 11 } }
  y -= 6; rule(y); y -= 14
  // One header row, one data row per item, values right-aligned under their column.
  const tw = (str: string, size: number) => [...str].reduce((a, ch) => a + (/[0-9]/.test(ch) ? 0.556 : /[.,: ]/.test(ch) ? 0.278 : /[A-Z]/.test(ch) ? 0.68 : 0.54) * size, 0)
  const FS = 9
  const COLS = [ // [label, right edge, max width]
    ['Qty', 190, 52], ['Rate', 248, 54], ['GST%', 280, 28], ['Amount', 345, 62], ['SGST', 402, 52], ['CGST', 459, 52], ['Total', 555, 70],
  ] as const
  const ITEM_W = 96
  const cell = (i: number, str: string, font: 'F1' | 'F2') => { const [, xr, mw] = COLS[i]; const size = Math.min(FS, (FS * mw) / Math.max(tw(str, FS), 1)); text(xr - tw(str, size), y, str, font, size) }
  const head = () => { text(L, y, 'Item', 'F1', FS); COLS.forEach(([l, xr], i) => text(xr - tw(l, FS), y, l, 'F1', FS)); y -= 5; rule(y); y -= 13 }
  const needRows = (h: number) => { if (y - h < 60) { need(1e9); head() } }
  const wrapW = (str: string, maxW: number) => { const out: string[] = []; let cur = ''; for (const w of str.split(/\s+/)) { let word = w; while (tw(word, FS) > maxW) { let k = word.length; while (k > 1 && tw(word.slice(0, k), FS) > maxW) k--; if (cur) { out.push(cur); cur = '' } out.push(word.slice(0, k)); word = word.slice(k) } const t2 = cur ? cur + ' ' + word : word; if (tw(t2, FS) > maxW && cur) { out.push(cur); cur = word } else cur = t2 } if (cur) out.push(cur); return out }
  head()
  for (const l of sale.items) {
    const c = calc(l.qty, l.rate, l.gst)
    const names = wrapW(l.material, ITEM_W)
    needRows(12 * names.length + 8)
    names.forEach((nm, k) => {
      text(L, y, nm, 'F1', FS)
      if (k === 0) { [`${l.qty.toLocaleString('en-IN')} ${l.uom}`, money(l.rate), String(l.gst), money(c.subtotal), money(c.sgst), money(c.cgst), money(c.total)].forEach((v, i) => cell(i, v, 'F2')) }
      y -= 12
    })
    y -= 2; ops().push(`0.9 g 0.3 w 40 ${y + 8} m 555 ${y + 8} l S 0 g`); y -= 4
  }
  const t = docTotals(sale.items)
  needRows(110); rule(y + 6); y -= 8
  text(L, y, 'All items', 'F1', FS); [t.subtotal, t.sgst, t.cgst, t.total].forEach((v, i) => cell(i + 3, money(v), 'F1')); y -= 22
  text(L, y, `Grand total (amount + SGST + CGST): Rs. ${money(t.total)}`, 'F1', 11); y -= 50
  text(L, y, 'Received by: ______________________', 'F2', 9); text(360, y, `For ${company.name}`, 'F1', 9); y -= 36
  text(L, y, 'SAMPLE challan made in the browser for the UI preview. The real PDF will be created by the backend when a sale is saved.', 'F2', 7)

  const objs: string[] = []
  const fonts = ['Helvetica-Bold', 'Helvetica', 'Courier', 'Courier-Bold']
  objs.push('<< /Type /Catalog /Pages 2 0 R >>')
  objs.push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${7 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`)
  fonts.forEach(f => objs.push(`<< /Type /Font /Subtype /Type1 /BaseFont /${f} >>`))
  // objects 3..6 are fonts, pages start at 7
  pages.forEach((p, i) => {
    const body = p.join('\n')
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${8 + i * 2} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> >>`)
    objs.push(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`)
  })
  let out = '%PDF-1.4\n'; const off: number[] = []
  objs.forEach((o, k) => { off.push(out.length); out += `${k + 1} 0 obj\n${o}\nendobj\n` })
  const x = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`
  return new Blob([out], { type: 'application/pdf' })
}
