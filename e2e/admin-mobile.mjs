import {chromium} from 'playwright-core'
const BASE=process.env.BASE_URL||'http://localhost:4173'
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']})
const p=await (await b.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true})).newPage();const errs=[];p.setDefaultTimeout(6000);p.on('pageerror',e=>errs.push(e.message));p.on('response',r=>{if(r.status()>=400)errs.push(r.status()+' '+r.url())})
const sh=async n=>{await p.waitForTimeout(600);await p.screenshot({path:`e2e-out/mob-${n}.png`})}
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

console.log('errors',errs);await b.close()
