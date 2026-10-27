import {chromium} from 'playwright-core'
const BASE=process.env.BASE_URL||'http://localhost:4173'
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']})
const mob=process.argv[2]==='mobile'
const p=await (await b.newContext(mob?{viewport:{width:412,height:915},isMobile:true,hasTouch:true,acceptDownloads:true}:{viewport:{width:1280,height:900},acceptDownloads:true})).newPage();p.setDefaultTimeout(6000);const errs=[]
p.on('pageerror',e=>errs.push(e.message));p.on('response',r=>{if(r.status()>=400)errs.push(r.status()+' '+r.url())})
const T=mob?'m':'d';const sh=async n=>{await p.waitForTimeout(600);await p.screenshot({path:`e2e-out/e2e-su${T}-${n}.png`})}
const step=async(n,f)=>{try{await f();console.log('OK  ',n)}catch(e){console.log('FAIL',n,e.message.split('\n')[0]);await sh('fail-'+n.replace(/\W+/g,'_'))}}
await p.goto(BASE+'/');await p.waitForTimeout(800)
await p.getByLabel('Mobile number').fill('+919000000009');await p.getByRole('textbox',{name:'Password'}).fill('SiteTrack123!');await p.getByRole('button',{name:'Sign in'}).click();await p.waitForTimeout(1200)
const api=async(path)=>p.evaluate(async path=>{const t=Object.values(localStorage).concat(Object.values(sessionStorage)).find(v=>/^eyJ/.test(v))||'';const r=await fetch('/api'+path,{headers:{Authorization:'Bearer '+t}});return r.json()},path)
const tab=async n=>{await p.goto(BASE+'/setup');await p.waitForTimeout(1200);await p.getByRole('tab',{name:n}).click();await p.waitForTimeout(600)}
await step('company edit + GST warning saves',async()=>{await tab('Company Setup');await p.getByRole('button',{name:'Edit',exact:true}).click()
  await p.getByLabel('Address').fill('Plot 12, GIDC Vatva, Ahmedabad');await p.getByLabel('GST number').fill('BADGST');await p.getByLabel('Mobile number').fill('9876543210')
  if(!(await p.locator('body').innerText()).includes('It will still be saved'))throw new Error('no warning');await sh('company-warning')
  await p.getByRole('button',{name:/Save/}).last().click();await p.waitForTimeout(1200)
  const c=(await api('/material/bootstrap')).company;if(c.gst!=='BADGST')throw new Error('not saved')})
await step('material type add/rename',async()=>{await p.goto(BASE+'/material');await p.waitForTimeout(1500)
  await p.getByRole('tab',{name:/Purchase/}).click();await p.getByRole('button',{name:'Purchase',exact:true}).click()
  await p.getByPlaceholder('Search or add vendor').fill('Moradiya Traders');await p.getByPlaceholder('10-digit mobile').fill('9825011111');await p.getByPlaceholder('Vendor address').fill('Vasna')
  await p.getByPlaceholder(/Search or add, e.g/).fill('Cement OPC');await p.getByLabel('Unit').selectOption('Bag');await p.getByPlaceholder('0',{exact:true}).first().fill('100');await p.getByPlaceholder('0.00').first().fill('400')
  await p.getByRole('button',{name:'Save purchase'}).click();await p.waitForTimeout(1500)
  await tab('Material Types');await p.getByRole('button',{name:'Edit Cement OPC'}).click();await p.waitForTimeout(400)
  await p.getByRole('dialog').getByRole('textbox').first().fill('Cement OPC 53');await p.getByRole('button',{name:/Save change/}).click();await p.waitForTimeout(1200)
  const bs=await api('/material/bootstrap');if(!bs.materialTypes.some(m=>m.name==='Cement OPC 53'))throw new Error('rename not saved');
  if(!JSON.stringify(bs.purchases).includes('Cement OPC 53'))throw new Error('rename did not propagate to purchase');await sh('types')})
await step('vendor edit propagates',async()=>{await tab('Vendors');await p.getByRole('button',{name:'Edit Moradiya Traders'}).click();await p.waitForTimeout(400)
  await p.getByLabel('Address').fill('Naroda, Ahmedabad');await p.getByLabel('GST number').fill('24AAAAA0000A1Z5');await p.getByRole('button',{name:/Save change/}).click();await p.waitForTimeout(1200)
  const bs=await api('/material/bootstrap');const v=bs.vendors.find(v=>v.name==='Moradiya Traders');if(v.address!=='Naroda, Ahmedabad')throw new Error('vendor not saved');
  if(!JSON.stringify(bs.purchases).includes('Naroda'))throw new Error('no propagation to purchase');await sh('vendors')})
await step('vendor mobile must be 10 digits',async()=>{await tab('Vendors');await p.getByRole('button',{name:'Edit Moradiya Traders'}).click();await p.waitForTimeout(400);await p.getByLabel(/^Mobile/).fill('12345');if(!(await p.getByRole('button',{name:/Save change/}).isDisabled()))throw new Error('save enabled');await p.keyboard.press('Escape')})
await step('sale without site + GST warning saves',async()=>{await p.goto(BASE+'/material');await p.waitForTimeout(1500)
  await p.getByRole('tab',{name:/Sales/}).click();await p.getByRole('button',{name:'Sale',exact:true}).click();await p.waitForTimeout(400);await p.getByRole('button',{name:'Credit',exact:true}).click()
  await p.getByPlaceholder('Search or add vendor').fill('Walk-in Buyer');await p.getByPlaceholder('10-digit mobile').fill('9898011199');await p.getByLabel('Vendor GST number').fill('XYZ')
  await p.getByPlaceholder('Search existing material type').click();await p.getByRole('option',{name:'Cement OPC 53'}).click()
  await p.getByPlaceholder('0',{exact:true}).first().fill('10');await p.getByPlaceholder('0.00').first().fill('420')
  if(!(await p.locator('body').innerText()).includes('It will still be saved'))throw new Error('no gst warning');await sh('sale-form')
  await p.getByRole('button',{name:'Save sale'}).click();await p.waitForTimeout(1500)
  const bs=await api('/material/bootstrap');const sl=bs.sales.find(x=>x.vendor==='Walk-in Buyer');if(!sl||sl.siteIds.length!==0||sl.type!=='CREDIT')throw new Error('sale not saved');if(sl.vendorInfo.gst!=='XYZ')throw new Error('gst not stored')})
await step('credit sale stock +10',async()=>{const st=await api('/material/stock');const c=st.find(x=>x.material==='Cement OPC 53');if(c.stock!==110)throw new Error('stock '+c.stock)})
await step('sale edit makes history, delete archives',async()=>{await p.getByText(/SES\d{9}/).first().click();await p.waitForTimeout(500);await p.getByRole('button',{name:'Edit',exact:true}).click()
  await p.getByPlaceholder('0',{exact:true}).first().fill('15');await p.getByRole('button',{name:'Save changes'}).click();await p.waitForTimeout(1500)
  await p.getByRole('button',{name:/Edit history/}).click();const t=await p.locator('body').innerText();if(!/1 earlier version/.test(t))throw new Error('no history');await sh('sale-history')
  const st=await api('/material/stock');if(st.find(x=>x.material==='Cement OPC 53').stock!==115)throw new Error('stock after edit')
  await p.getByRole('button',{name:'Delete',exact:true}).click();await p.getByRole('button',{name:'Delete sale'}).click();await p.waitForTimeout(1500)
  const st2=await api('/material/stock');if(st2.find(x=>x.material==='Cement OPC 53').stock!==100)throw new Error('stock after delete')})
console.log('errors',errs);await b.close()
