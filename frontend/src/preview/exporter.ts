// UI PREVIEW ONLY: client-side export of the sample data shown on screen. Not connected to any backend or real stock.
export type Cell = string | number
export type Table = { sheet: string; headers: string[]; rows: Cell[][] }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const enc = new TextEncoder()
const stamp = () => new Date().toISOString().slice(0, 10)

function save(blob: Blob, filename: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function exportCsv(t: Table, name: string) {
  const line = (r: Cell[]) => r.map(c => { const s = String(c); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }).join(',')
  const text = '\uFEFF' + [line(t.headers), ...t.rows.map(line)].join('\r\n') + '\r\n'
  save(new Blob([text], { type: 'text/csv;charset=utf-8' }), `${name}-${stamp()}.csv`)
}

const crcTable = (() => { const t: number[] = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
const crc32 = (b: Uint8Array) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }

function zip(files: { name: string; data: Uint8Array }[]) {
  const parts: Uint8Array[] = [], central: Uint8Array[] = []; let offset = 0
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.data)
    const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint32(14, crc, true); lh.setUint32(18, f.data.length, true); lh.setUint32(22, f.data.length, true); lh.setUint16(26, nm.length, true)
    const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint32(16, crc, true); ch.setUint32(20, f.data.length, true); ch.setUint32(24, f.data.length, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, offset, true)
    parts.push(new Uint8Array(lh.buffer), nm, f.data); central.push(new Uint8Array(ch.buffer), nm)
    offset += 30 + nm.length + f.data.length
  }
  const csize = central.reduce((s, p) => s + p.length, 0)
  const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, offset, true)
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

const col = (i: number) => String.fromCharCode(65 + i)
export function exportXlsx(t: Table, name: string) {
  const cell = (c: Cell, r: number, i: number) => typeof c === 'number' ? `<c r="${col(i)}${r}"><v>${c}</v></c>` : `<c r="${col(i)}${r}" t="inlineStr"><is><t>${esc(String(c))}</t></is></c>`
  const rowXml = (cells: Cell[], r: number) => `<row r="${r}">${cells.map((c, i) => cell(c, r, i)).join('')}</row>`
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${[t.headers, ...t.rows].map((r, i) => rowXml(r, i + 1)).join('')}</sheetData></worksheet>`
  const sheetName = esc(t.sheet.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '))
  const f = (name: string, text: string) => ({ name, data: enc.encode(text) })
  const blob = zip([
    f('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
    f('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    f('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    f('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
    f('xl/worksheets/sheet1.xml', sheet),
  ])
  save(blob, `${name}-${stamp()}.xlsx`)
}
