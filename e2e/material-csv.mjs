import { chromium } from 'playwright-core'
import { readFile } from 'node:fs/promises'
const mob = process.argv[2] === 'mobile', T = mob ? 'm' : 'd'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: mob ? 412 : 1280, height: mob ? 915 : 900 }, acceptDownloads: true })).newPage()
page.setDefaultTimeout(10000)
let failures = 0
const errors = []; page.on('pageerror', e => errors.push(e.message))
const step = async (name, fn) => { try { await fn(); console.log('OK  ', name) } catch (e) { failures++; console.log('FAIL', name, e.message); await page.screenshot({ path: `e2e-out/csv-${T}-fail-${failures}.png` }) } }
const assert = (ok, message) => { if (!ok) throw Error(message) }
await page.goto('http://localhost:4173')
await page.getByLabel('Mobile number').fill('9000000009'); await page.getByRole('textbox', { name: 'Password' }).fill('SiteTrack123!')
await page.getByRole('button', { name: 'Sign in' }).click(); await page.getByRole('button', { name: 'Sign in' }).waitFor({ state: 'hidden' })
await page.goto('http://localhost:4173/setup'); await page.getByRole('tab', { name: 'Material Types' }).click()
const upload = async text => {
  await page.locator('input[type=file]').setInputFiles({ name: 'materials.csv', mimeType: 'text/csv', buffer: Buffer.from(text) })
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click()
  await page.getByText('Import complete', { exact: true }).waitFor()
}
const bootstrap = () => page.evaluate(async () => (await fetch('/api/material/bootstrap', { headers: { Authorization: 'Bearer ' + localStorage.getItem('sitetrack-token') } })).json())
await step('CSV template download has safe empty header and UTF-8 BOM', async () => {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CSV template', exact: true }).click()])
  const content = await readFile(await download.path(), 'utf8')
  assert(download.suggestedFilename() === 'material-types-template.csv' && content === '\uFEFFname,uom,hsn\r\n', 'wrong template')
})
await step('CSV dialog instructions and disabled import until file chosen', async () => {
  await page.getByRole('button', { name: 'Upload CSV', exact: true }).click()
  assert(await page.getByRole('button', { name: 'Import CSV', exact: true }).isDisabled(), 'enabled without file')
  await page.getByText(/Existing names with different UOM/).waitFor()
})
await step('CSV browser upload accepts BOM, commas, quotes, Unicode, blank HSN', async () => {
  await upload('\uFEFFname,uom,hsn\r\nCSV Cable,Meter,0012\r\n"Box, ""large""",Nos,\r\nકેબલ,Kg,1234\r\n')
  await page.getByText('3 added, 0 skipped, 0 errors (3 rows). Existing materials were not changed.', { exact: true }).waitFor()
  const types = (await bootstrap()).materialTypes
  assert(types.find(m => m.name === 'CSV Cable').hsn === '0012', 'leading zeros lost')
  assert(types.some(m => m.name === 'Box, "large"' && !m.hsn) && types.some(m => m.name === 'કેબલ'), 'quoted/unicode not saved')
})
await step('CSV partial success, exact match skip, UOM and HSN conflicts shown by row', async () => {
  await upload('name,uom,hsn\n csv cable ,meter,0012\nCSV Cable,Kg,0012\nCSV Cable,Meter,9999\n,Nos,\nCSV New,Nos,\nCSV Missing,,\n')
  await page.getByText('1 added, 1 skipped, 4 errors (6 rows). Existing materials were not changed.', { exact: true }).waitFor()
  const table = page.getByRole('table', { name: 'CSV import results' })
  assert((await page.getByRole('dialog').innerText()).includes('existing UOM: Meter, HSN: 0012'), 'no conflict details')
  const types = (await bootstrap()).materialTypes, cable = types.find(m => m.name === 'CSV Cable')
  assert(cable.uom === 'Meter' && cable.hsn === '0012', 'existing data changed')
  assert(types.some(m => m.name === 'CSV New') && !types.some(m => m.name === 'CSV Missing'), 'wrong partial inserts')
  await page.screenshot({ path: `e2e-out/csv-${T}-partial.png` })
  if (mob) {
    await page.getByRole('button', { name: 'Close', exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: `e2e-out/csv-${T}-partial-bottom.png` })
  }
})
await step('CSV retry is idempotent and reports skips', async () => {
  await upload('name,uom,hsn\nCSV New,Nos,\nCSV Cable,Meter,0012\n')
  await page.getByText('0 added, 2 skipped, 0 errors (2 rows). Existing materials were not changed.', { exact: true }).waitFor()
})
await step('CSV malformed quotes reject whole document and show error', async () => {
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('name,uom,hsn\nCSV No Write,Nos,\n"broken') })
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click(); await page.getByText('Import failed', { exact: true }).waitFor()
  await page.getByText(/Unclosed quoted value/).waitFor()
  assert(!(await bootstrap()).materialTypes.some(m => m.name === 'CSV No Write'), 'partial write on broken document')
})
await step('CSV oversized file blocked in UI', async () => {
  await page.locator('input[type=file]').setInputFiles({ name: 'large.csv', mimeType: 'text/csv', buffer: Buffer.alloc(1024 * 1024 + 1, 'a') })
  await page.getByText('File must be 1 MB or smaller', { exact: true }).waitFor()
  assert(await page.getByRole('button', { name: 'Import CSV', exact: true }).isDisabled(), 'oversize allowed')
})
await step('CSV list refresh and mobile controls stay reachable without page overflow', async () => {
  await page.getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); await page.getByRole('button', { name: 'Edit CSV New', exact: true }).waitFor()
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'horizontal page overflow')
  await page.screenshot({ path: `e2e-out/csv-${T}-list.png` })
})
await step('CSV no browser runtime errors', async () => assert(errors.length === 0, errors.join('; ')))
await browser.close(); process.exitCode = failures ? 1 : 0
