// Material groups (1 ACDB = 4 MCB + 1 Box): Setup section under Material Types, group lines in a sale, grouped challan,
// frozen history, archive, coordinator read-only. Real clicks in the real built app; the database is a throwaway embedded one.
import {chromium} from 'playwright-core'
import {execSync} from 'node:child_process'
const BASE=process.env.BASE_URL||'http://localhost:4173'
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']})
const mob=process.argv[2]==='mobile'
const ctxOpts=mob?{viewport:{width:412,height:915},isMobile:true,hasTouch:true,acceptDownloads:true}:{viewport:{width:1280,height:900},acceptDownloads:true}
const p=await (await b.newContext(ctxOpts)).newPage();p.setDefaultTimeout(8000)
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('response',r=>{if(r.status()>=400&&!/\/challan/.test(r.url()))errs.push(r.status()+' '+r.url())})
const T=mob?'m':'d';const sh=async n=>{await p.waitForTimeout(600);await p.screenshot({path:`e2e-out/e2e-grp${T}-${n}.png`})}
const step=async(n,f)=>{try{await f();console.log('OK  ',n)}catch(e){console.log('FAIL',n,e.message.split('\n')[0]);await sh('fail-'+n.replace(/\W+/g,'_'))}}
await p.goto(BASE+'/');await p.waitForTimeout(800)
await p.getByLabel('Mobile number').fill('+919000000009');await p.getByRole('textbox',{name:'Password'}).fill('SiteTrack123!');await p.getByRole('button',{name:'Sign in'}).click();await p.waitForTimeout(1500)
const call=(method,path,body,multipart)=>p.evaluate(async([method,path,body,multipart])=>{const t=Object.values(localStorage).concat(Object.values(sessionStorage)).find(v=>/^eyJ/.test(v))||'';const h={Authorization:'Bearer '+t};let b;if(multipart){const f=new FormData();f.append('data',JSON.stringify(body));b=f}else if(body){h['Content-Type']='application/json';b=JSON.stringify(body)}const r=await fetch('/api'+path,{method,headers:h,body:b});const ct=r.headers.get('content-type')||'';return {status:r.status,json:ct.includes('json')?await r.json():null}},[method,path,body,multipart])
const pdfOf=async(id,q='')=>{const a=await p.evaluate(async([id,q])=>{const t=Object.values(localStorage).concat(Object.values(sessionStorage)).find(v=>/^eyJ/.test(v))||'';const r=await fetch('/api/material/sales/'+id+'/challan'+q,{headers:{Authorization:'Bearer '+t}});return Array.from(new Uint8Array(await r.arrayBuffer()))},[id,q]);const {writeFileSync}=await import('node:fs');const f=`e2e-out/grp-${T}-${Date.now()}.pdf`;writeFileSync(f,Buffer.from(a));return {f,text:execSync('pdftotext -layout '+f+' -').toString(),bytes:Buffer.from(a).toString('base64')}}
const boot=async()=>(await call('GET','/material/bootstrap')).json
const stockOf=async n=>Number((await boot()).stock.find(x=>x.material===n).stock)
const tab=async n=>{await p.goto(BASE+'/setup');await p.waitForTimeout(1200);await p.getByRole('tab',{name:n}).click();await p.waitForTimeout(600)}
const openSale=async code=>{await p.goto(BASE+'/material');await p.waitForTimeout(1500);await p.getByRole('tab',{name:/Sales/}).click();await p.waitForTimeout(500);await p.getByText(code).first().click();await p.waitForTimeout(700)}
const num=x=>Number(x)
let gid,saleA,pdfA
await step('seed materials and stock (API)',async()=>{
  for(const [n,h] of [['GMCB','8536'],['GBox','8538']]){const r=await call('POST','/material/types',{name:n,uom:'Nos',hsn:h});if(r.status!==200)throw new Error('type '+r.status)}
  const r=await call('POST','/material/purchases',{date:'2026-10-28',vendor:'Grp Supplier',vendorMobile:'9825012345',vendorGst:'',vendorAddress:'Surat',billNumber:'G1',items:[{material:'GMCB',uom:'Nos',qty:50,rate:100,gst:18},{material:'GBox',uom:'Nos',qty:20,rate:300,gst:18}]},true)
  if(r.status!==200)throw new Error('purchase '+r.status)})
await step('Material groups section is BELOW the material type list on the same page',async()=>{await tab('Material Types')
  const g=p.getByLabel('Material groups');await g.waitFor();const gb=await g.boundingBox();const tb=await p.locator('table').first().boundingBox()
  if(!(gb.y>tb.y+tb.height-1))throw new Error('groups not below list: '+JSON.stringify([gb,tb]))
  if(await p.getByRole('tab',{name:/Groups/}).count())throw new Error('unexpected separate Groups tab');await sh('setup-empty')})
await step('add group in dialog: duplicate material blocks save, then save ACDB = 4 GMCB + 1 GBox',async()=>{
  await p.getByRole('button',{name:'Add group'}).click();await p.waitForTimeout(400);const d=p.getByRole('dialog')
  await d.getByLabel('Group name').fill('ACDB')
  await d.getByPlaceholder('Search existing material type').nth(0).click();await p.getByRole('option',{name:'GMCB'}).click();await d.getByLabel('Qty per 1 group').first().fill('4')
  await d.getByRole('button',{name:'Add material'}).click();await p.waitForTimeout(300)
  await d.getByPlaceholder('Search existing material type').nth(1).click();await p.getByRole('option',{name:'GMCB'}).click();await d.getByLabel('Qty per 1 group').nth(1).fill('1');await p.waitForTimeout(300)
  if(!(await d.innerText()).includes('Already in this group'))throw new Error('no duplicate message');if(!(await d.getByRole('button',{name:'Save group'}).isDisabled()))throw new Error('save not disabled for duplicate');await sh('group-duplicate')
  await d.getByPlaceholder('Search existing material type').nth(1).click();await p.getByRole('option',{name:'GBox'}).click();await p.waitForTimeout(300)
  if(await d.getByRole('button',{name:'Save group'}).isDisabled())throw new Error('save disabled');await sh('group-dialog')
  await d.getByRole('button',{name:'Save group'}).click();await p.waitForTimeout(1200)
  const gs=(await boot()).groups;if(gs.length!==1||gs[0].name!=='ACDB'||gs[0].items.length!==2)throw new Error(JSON.stringify(gs));gid=gs[0].id
  if(!(await p.getByLabel('Material groups').innerText()).includes('4 Nos GMCB + 1 Nos GBox'))throw new Error('list text');await sh('setup-with-group')})
await step('sale: Add group, quantity 2 expands to 8 + 2, price per child, save',async()=>{
  await p.goto(BASE+'/material');await p.waitForTimeout(1500);await p.getByRole('tab',{name:/Sales/}).click();await p.getByRole('button',{name:'Sale',exact:true}).click();await p.waitForTimeout(400)
  await p.getByRole('button',{name:'Debit',exact:true}).click()
  await p.getByPlaceholder('Search or add vendor').fill('Grp Supplier');await p.waitForTimeout(300);await p.getByRole('option',{name:/Grp Supplier/}).click().catch(()=>{})
  await p.getByRole('button',{name:'Add group'}).click();await p.waitForTimeout(300);await p.getByPlaceholder('Select a group to add').click();await p.getByRole('option',{name:/ACDB/}).click();await p.waitForTimeout(400)
  if(!(await p.getByRole('button',{name:'Save sale'}).isDisabled()))throw new Error('save should be disabled before qty and prices')
  await p.getByLabel('Group quantity - ACDB').fill('2');await p.waitForTimeout(300)
  const t=await p.getByLabel('Group ACDB',{exact:true}).innerText();if(!/Quantity 8 Nos \(4 x 2\)/.test(t)||!/Quantity 2 Nos \(1 x 2\)/.test(t))throw new Error('expansion text: '+t)
  await p.getByLabel('ACDB - GMCB price (excl. GST)').fill('180');await p.getByLabel('ACDB - GBox price (excl. GST)').fill('650');await p.waitForTimeout(300)
  if(!(await p.getByLabel('Group ACDB',{exact:true}).innerText()).includes('3,233.20'))throw new Error('group subtotal missing');await sh('sale-form-group')
  await p.getByRole('button',{name:'Save sale'}).click();await p.waitForTimeout(1500)
  const s=(await boot()).sales[0];saleA=s;if(s.items.length!==2||num(s.items[0].qty)!==8||num(s.items[1].qty)!==2||s.items[0].groupName!=='ACDB'||num(s.items[0].groupQty)!==2)throw new Error(JSON.stringify(s.items))
  if(await stockOf('GMCB')!==42||await stockOf('GBox')!==18)throw new Error('stock not reduced on children')})
await step('sale popup shows group heading, children and subtotal; challan PDF the same',async()=>{await openSale(saleA.saleId)
  const t=await p.getByRole('dialog').innerText();if(!/ACDB x 2/.test(t)||!/ACDB subtotal/.test(t))throw new Error('popup lacks group layout: '+t.slice(0,300));await sh('sale-popup')
  await p.getByRole('button',{name:'View challan'}).click();await p.waitForTimeout(2500);if(await p.locator('canvas').count()<1)throw new Error('no canvas');await sh('challan-view');await p.keyboard.press('Escape');await p.waitForTimeout(300)
  const [d]=await Promise.all([p.waitForEvent('download'),p.getByRole('button',{name:'Download PDF'}).first().click()]);const f=`e2e-out/grp-challan-${T}.pdf`;await d.saveAs(f)
  const x=execSync('pdftotext -layout '+f+' -').toString();if(!/ACDB x 2/.test(x)||!/1 ACDB = 4 Nos GMCB \+ 1 Nos GBox/.test(x)||!/ACDB subtotal/.test(x)||!/8536/.test(x)||!/2,740\.00/.test(x))throw new Error('pdf text: '+x.slice(0,600))
  execSync(`pdftoppm -r 80 -png ${f} e2e-out/grp-challan-${T}`);pdfA=await pdfOf(saleA.id)})
await step('changing the group later leaves the old sale and its saved challan untouched; new sale uses new quantities',async()=>{
  await tab('Material Types');await p.getByRole('button',{name:'Edit group ACDB'}).click();await p.waitForTimeout(400);const d=p.getByRole('dialog')
  if(!(await d.innerText()).includes('affects new sales only'))throw new Error('no note');await d.getByLabel('Qty per 1 group').first().fill('5');await d.getByRole('button',{name:'Save group'}).click();await p.waitForTimeout(1200)
  const g=(await boot()).groups[0];if(num(g.items[0].qty)!==5)throw new Error('not edited')
  const now=await pdfOf(saleA.id);if(now.bytes!==pdfA.bytes)throw new Error('saved challan changed');const s=(await boot()).sales.find(x=>x.id===saleA.id);if(num(s.items[0].qty)!==8)throw new Error('old sale changed')
  const r=await call('POST','/material/sales',{type:'DEBIT',date:'2026-10-28',vendor:'Grp Supplier',siteIds:[1],items:[],groups:[{groupId:gid,qty:1,children:[{material:'GMCB',rate:180,gst:18},{material:'GBox',rate:650,gst:18}]}]})
  if(r.status!==200)throw new Error('new sale '+r.status);if(num(r.json.items[0].qty)!==5)throw new Error('new sale should use 5 per group');saleA.newId=r.json.id;saleA.newCode=r.json.saleId})
await step('edit the old sale in the form: group qty 3 keeps its own member list (4 per group), version + new challan',async()=>{await openSale(saleA.saleId)
  await p.getByRole('button',{name:'Edit',exact:true}).click();await p.waitForTimeout(600);await p.getByLabel('Group quantity - ACDB').fill('3');await p.waitForTimeout(300)
  const t=await p.getByLabel('Group ACDB',{exact:true}).innerText();if(!/Quantity 12 Nos \(4 x 3\)/.test(t))throw new Error('should keep 4 per group: '+t);await sh('edit-form')
  await p.getByRole('button',{name:/Save/}).last().click();await p.waitForTimeout(1500)
  const s=(await boot()).sales.find(x=>x.id===saleA.id);if(num(s.items[0].qty)!==12||s.versions.length!==1||num(s.versions[0].items[0].groupQty)!==2)throw new Error(JSON.stringify([s.items,s.versions.length]))
  const h=(await call('GET','/material/sales/'+saleA.id+'/challans')).json;if(h.length!==2||h[0].reason!=='EDITED')throw new Error(JSON.stringify(h));const old=await pdfOf(saleA.id,'?seq=1');if(old.bytes!==pdfA.bytes)throw new Error('first challan not kept')
  await p.getByRole('button',{name:/Edit history/}).click().catch(()=>{});await sh('after-edit')})
await step('archive group (confirm): hidden from new sale, restore brings it back',async()=>{
  await tab('Material Types');await p.getByRole('button',{name:'Archive group ACDB'}).click();await p.waitForTimeout(400);if(!(await p.getByRole('dialog').innerText()).includes('do not change'))throw new Error('no confirm text')
  await p.getByRole('dialog').getByRole('button',{name:'Archive',exact:true}).click();await p.waitForTimeout(1200);if(!(await boot()).groups[0].archived)throw new Error('not archived');await sh('archived')
  await p.goto(BASE+'/material');await p.waitForTimeout(1500);await p.getByRole('tab',{name:/Sales/}).click();await p.getByRole('button',{name:'Sale',exact:true}).click();await p.waitForTimeout(400);await p.getByRole('button',{name:'Add group'}).click();await p.waitForTimeout(300)
  if(!(await p.getByPlaceholder(/No groups available/).count()))throw new Error('archived group still offered');await sh('archived-not-offered');await p.keyboard.press('Escape');await p.waitForTimeout(300)
  await tab('Material Types');await p.getByRole('button',{name:'Restore group ACDB'}).click();await p.waitForTimeout(400);await p.getByRole('dialog').getByRole('button',{name:'Restore',exact:true}).click();await p.waitForTimeout(1200)
  if((await boot()).groups[0].archived)throw new Error('not restored')})
await step('coordinator: sees group layout read-only on own site; no Material menu or groups API',async()=>{
  const c=await (await b.newContext(ctxOpts)).newPage();c.setDefaultTimeout(8000)
  await c.goto(BASE+'/');await c.waitForTimeout(800);await c.getByLabel('Mobile number').fill('+919000000001');await c.getByRole('textbox',{name:'Password'}).fill('SiteTrack123!');await c.getByRole('button',{name:'Sign in'}).click();await c.waitForTimeout(1500)
  if(await c.getByRole('link',{name:'Material'}).count())throw new Error('menu visible')
  await c.goto(BASE+'/sites/1');await c.waitForTimeout(1200);await c.getByRole('button',{name:/Linked sales/}).click();await c.waitForTimeout(600)
  await c.locator('[aria-label^="Open sale"]').first().click();await c.waitForTimeout(800);const t=await c.getByRole('dialog').innerText()
  if(!/ACDB x \d/.test(t)||!/ACDB subtotal/.test(t))throw new Error('coordinator popup lacks group layout: '+t.slice(0,300))
  for(const n of ['Edit','Delete','Regenerate challan'])if(await c.getByRole('button',{name:n,exact:true}).count())throw new Error('button '+n+' visible')
  await c.screenshot({path:`e2e-out/e2e-grp${T}-coordinator.png`})
  const g=await c.evaluate(async()=>{const t=Object.values(localStorage).concat(Object.values(sessionStorage)).find(v=>/^eyJ/.test(v))||'';const r=await fetch('/api/material/groups',{headers:{Authorization:'Bearer '+t}});return r.status})
  if(g!==403)throw new Error('groups API status '+g);await c.context().close()})
console.log('errors',errs);await b.close()
