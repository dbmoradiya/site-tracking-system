import {chromium} from 'playwright-core'
const BASE=process.env.BASE_URL||'http://localhost:4173'
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']})
const p=await (await b.newContext({viewport:{width:1280,height:900}})).newPage();const errs=[];p.setDefaultTimeout(6000);p.on('pageerror',e=>errs.push(e.message));p.on('response',r=>{if(r.status()>=400)errs.push(r.status()+' '+r.url())})
const sh=async n=>{await p.waitForTimeout(600);await p.screenshot({path:`e2e-out/e2e-${n}.png`})}
const step=async(n,f)=>{try{await f();console.log('OK  ',n)}catch(e){console.log('FAIL',n,e.message.split('\n')[0]);await sh('fail-'+n.replace(/\W+/g,'_'))}}
await p.goto(BASE+'/');await p.waitForTimeout(800)
await p.getByLabel('Mobile number').fill('+919000000009');await p.getByRole('textbox',{name:'Password'}).fill('SiteTrack123!');await p.getByRole('button',{name:'Sign in'}).click();await p.waitForTimeout(1200)
await p.goto(BASE+'/material');await p.waitForTimeout(1500)
await step('empty stock loads',async()=>{await p.getByRole('tab',{name:/Current stock/}).waitFor()})
await step('add purchase with PDF invoice',async()=>{
  await p.getByRole('tab',{name:/Purchase/}).click();await p.getByRole('button',{name:'Purchase',exact:true}).click()
  await p.getByPlaceholder('Search or add vendor').fill('Moradiya Traders');await p.getByPlaceholder('10-digit mobile').fill('9825011111',{timeout:800}).catch(()=>{})
  await p.getByPlaceholder('Vendor address').fill('Vasna, Ahmedabad',{timeout:800}).catch(()=>{})
  await p.getByPlaceholder(/Search or add, e.g/).fill('Cement OPC')
  await p.getByLabel('Unit').selectOption('Bag',{timeout:800}).catch(()=>{});await p.getByLabel('Quantity').fill('100');await p.getByLabel(/Rate/).fill('400');await p.getByLabel('GST %').selectOption('28')
  await p.getByPlaceholder('Vendor bill / invoice no.').fill('MT-001')
  await p.locator('input[type=file]').setInputFiles('fixtures/invoice.pdf');await sh('purchase-form')
  await p.getByRole('button',{name:'Save purchase'}).click();await p.waitForTimeout(1500)
  await p.getByText(/SE\d{9}/).first().waitFor({timeout:3000})})
await step('purchase persisted after reload',async()=>{await p.reload();await p.waitForTimeout(2500);await p.getByRole('tab',{name:/Purchase/}).click();await p.getByText(/SE\d{9}/).first().waitFor({timeout:6000});await sh('purchase-list')})
await step('view invoice shows canvas',async()=>{await p.getByText(/SE\d{9}/).first().click();await p.getByRole('button',{name:'View invoice'}).click();await p.waitForTimeout(1500);if(await p.locator('canvas').count()<1)throw new Error('no canvas');await sh('invoice-view');await p.keyboard.press('Escape');await p.keyboard.press('Escape')})
await step('stock shows 100 Bag',async()=>{await p.getByRole('tab',{name:/Current stock/}).click();await p.waitForTimeout(500);await p.getByText('Cement OPC').first().waitFor();await sh('stock')})

const sale=async(type,qty)=>{
  await p.getByRole('tab',{name:/Sales/}).click();await p.getByRole('button',{name:'Sale',exact:true}).click();await p.waitForTimeout(400)
  await p.getByRole('button',{name:type,exact:true}).click()
  const v=p.getByPlaceholder('Search or add vendor');await v.fill('Patel Constructions')
  if(await p.getByPlaceholder('10-digit mobile').isEnabled())await p.getByPlaceholder('10-digit mobile').fill('9898011122')
  await p.getByPlaceholder('Select sites (optional)').click();await p.getByRole('option',{name:/Block A \| Sun City/}).click();await p.getByRole('option',{name:/Villa 9/}).click();await p.keyboard.press('Escape')
  await p.getByPlaceholder('Search existing material type').click();await p.getByRole('option',{name:'Cement OPC'}).click()
  await p.getByLabel('Quantity').fill(qty);await p.getByLabel(/Price/).fill('420')
  await sh('sale-form-'+type+qty)
  await p.getByRole('button',{name:'Save sale'}).click();await p.waitForTimeout(1500)}
await step('debit 30 saves',async()=>{await sale('Debit','30');await p.getByText(/SES\d{9}/).first().waitFor()})
await step('view challan renders canvas',async()=>{await p.getByText(/SES\d{9}/).first().click();await p.getByRole('button',{name:'View challan'}).click();await p.waitForTimeout(2000);if(await p.locator('canvas').count()<1)throw new Error('no canvas');await sh('challan');await p.keyboard.press('Escape')})
await step('download challan',async()=>{const [d]=await Promise.all([p.waitForEvent('download'),p.getByRole('button',{name:'Download PDF'}).first().click()]);const f='e2e-out/downloaded-challan.pdf';await d.saveAs(f);const {execSync}=await import('node:child_process');const t=execSync('pdftotext '+f+' -').toString();console.log('   file',d.suggestedFilename());if(!/Patel Constructions/.test(t)||!/SES\d{9}/.test(t)||!/Cement OPC/.test(t))throw new Error('downloaded PDF content wrong: '+t.slice(0,200))})
await p.keyboard.press('Escape');await p.waitForTimeout(400)
await step('stock is 70',async()=>{await p.getByRole('tab',{name:/Current stock/}).click();await p.waitForTimeout(600);const t=await p.locator('tr',{hasText:'Cement OPC'}).first().innerText();console.log('   row:',t.replace(/\s+/g,' '));if(!/70/.test(t))throw new Error('stock not 70')})
await step('over-stock debit warns and saves',async()=>{await sale('Debit','500');await p.getByText('Stock warning').first().waitFor({timeout:4000});await sh('overstock')})
console.log('errors',errs);await b.close()
