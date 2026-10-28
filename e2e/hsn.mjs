// HSN code on material types: Setup add/edit (incl. warning), sale with that material, challan PDF shows HSN.
import {chromium} from 'playwright-core'
import {execSync} from 'node:child_process'
const BASE=process.env.BASE_URL||'http://localhost:4173'
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']})
const mob=process.argv[2]==='mobile'
const p=await (await b.newContext(mob?{viewport:{width:412,height:915},isMobile:true,hasTouch:true,acceptDownloads:true}:{viewport:{width:1280,height:900},acceptDownloads:true})).newPage();p.setDefaultTimeout(8000)
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('response',r=>{if(r.status()>=400)errs.push(r.status()+' '+r.url())})
const T=mob?'m':'d';const sh=async n=>{await p.waitForTimeout(600);await p.screenshot({path:`e2e-out/e2e-hsn${T}-${n}.png`})}
const step=async(n,f)=>{try{await f();console.log('OK  ',n)}catch(e){console.log('FAIL',n,e.message.split('\n')[0]);await sh('fail-'+n.replace(/\W+/g,'_'))}}
await p.goto(BASE+'/');await p.waitForTimeout(800)
await p.getByLabel('Mobile number').fill('+919000000009');await p.getByRole('textbox',{name:'Password'}).fill('SiteTrack123!');await p.getByRole('button',{name:'Sign in'}).click();await p.waitForTimeout(1500)
// page-context fetch with the stored token (same technique as setup.mjs)
const call=(method,path,body,multipart)=>p.evaluate(async([method,path,body,multipart])=>{const t=Object.values(localStorage).concat(Object.values(sessionStorage)).find(v=>/^eyJ/.test(v))||'';const h={Authorization:'Bearer '+t};let b;if(multipart){const f=new FormData();f.append('data',JSON.stringify(body));b=f}else if(body){h['Content-Type']='application/json';b=JSON.stringify(body)}const r=await fetch('/api'+path,{method,headers:h,body:b});const ct=r.headers.get('content-type')||'';return {status:r.status,json:ct.includes('json')?await r.json():null}},[method,path,body,multipart])
const tab=async n=>{await p.goto(BASE+'/setup');await p.waitForTimeout(1200);await p.getByRole('tab',{name:n}).click();await p.waitForTimeout(600)}
const types=async()=>(await call('GET','/material/bootstrap')).json.materialTypes
await step('add material type with HSN (Setup)',async()=>{await tab('Material Types');await p.getByRole('button',{name:'Add Material Type'}).click();await p.waitForTimeout(400)
  const d=p.getByRole('dialog');await d.getByLabel('Material type').fill('Cement PPC');await d.getByLabel('Unit of measurement').selectOption('Bag');await d.getByLabel(/HSN code/).fill('2523')
  if((await p.locator('body').innerText()).includes('HSN is usually'))throw new Error('warning shown for a valid HSN')
  await sh('add-dialog');await d.getByRole('button',{name:/Save/}).click();await p.waitForTimeout(1200)
  const m=(await types()).find(x=>x.name==='Cement PPC');if(!m||m.hsn!=='2523')throw new Error('not saved: '+JSON.stringify(m))
  if(!(await p.locator('tbody').innerText()).includes('2523'))throw new Error('HSN not in table');await sh('types-table')})
await step('odd HSN warns and still saves; edit then restore',async()=>{await p.getByRole('button',{name:'Edit Cement PPC'}).click();await p.waitForTimeout(400)
  const d=p.getByRole('dialog');await d.getByLabel(/HSN code/).fill('ABC');if(!(await p.locator('body').innerText()).includes('It will still be saved'))throw new Error('no warning');await sh('warning')
  await d.getByRole('button',{name:/Save/}).click();await p.waitForTimeout(1200);let m=(await types()).find(x=>x.name==='Cement PPC');if(m.hsn!=='ABC')throw new Error('odd HSN not saved')
  await p.getByRole('button',{name:'Edit Cement PPC'}).click();await p.waitForTimeout(400);await p.getByRole('dialog').getByLabel(/HSN code/).fill('2523');await p.getByRole('dialog').getByRole('button',{name:/Save/}).click();await p.waitForTimeout(1200)
  m=(await types()).find(x=>x.name==='Cement PPC');if(m.hsn!=='2523')throw new Error('edit not saved')})
await step('material without HSN stays empty',async()=>{const pr=await call('POST','/material/purchases',{date:'2026-10-28',vendor:'Hsn Vendor',vendorMobile:'9825012345',vendorGst:'',vendorAddress:'Ahmedabad',billNumber:'H1',items:[{material:'Cement PPC',uom:'Bag',qty:100,rate:400,gst:18},{material:'River Sand',uom:'Ton',qty:20,rate:1500,gst:5}]},true)
  if(pr.status!==200&&pr.status!==201)throw new Error('purchase '+pr.status);const t=await types();if((t.find(x=>x.name==='River Sand').hsn||'')!=='')throw new Error('River Sand should have no HSN')
  await tab('Material Types');if(!(await p.locator('tbody tr',{hasText:'River Sand'}).innerText()).includes('-'))throw new Error('dash expected');await sh('types-with-empty')})
await step('sale with HSN material: challan View and PDF text has HSN',async()=>{await p.goto(BASE+'/material');await p.waitForTimeout(1500)
  await p.getByRole('tab',{name:/Sales/}).click();await p.getByRole('button',{name:'Sale',exact:true}).click();await p.waitForTimeout(400);await p.getByRole('button',{name:'Debit',exact:true}).click()
  await p.getByPlaceholder('Search or add vendor').fill('Hsn Vendor');await p.waitForTimeout(300);await p.getByRole('option',{name:/Hsn Vendor/}).click().catch(()=>{})
  await p.getByPlaceholder('Search existing material type').click();await p.getByRole('option',{name:'Cement PPC'}).click()
  await p.getByPlaceholder('0',{exact:true}).first().fill('10');await p.getByPlaceholder('0.00').first().fill('420')
  await p.getByRole('button',{name:'Save sale'}).click();await p.waitForTimeout(1500)
  await p.getByText(/SES\d{9}/).first().click();await p.getByRole('button',{name:'View challan'}).click();await p.waitForTimeout(2500);if(await p.locator('canvas').count()<1)throw new Error('no canvas');await sh('challan-view');await p.keyboard.press('Escape')
  const [d]=await Promise.all([p.waitForEvent('download'),p.getByRole('button',{name:'Download PDF'}).first().click()]);const f=`e2e-out/hsn-challan-${T}.pdf`;await d.saveAs(f)
  const t=execSync('pdftotext -layout '+f+' -').toString();if(!/HSN/.test(t)||!/2523/.test(t))throw new Error('HSN or 2523 missing in PDF');console.log('   pdf text:',t.split('\n').filter(l=>/HSN|Cement PPC/.test(l)).join(' | '))})
await step('challan with two materials: HSN where set, dash where empty',async()=>{const s=(await call('POST','/material/sales',{type:'DEBIT',date:'2026-10-28',vendor:'Hsn Vendor',siteIds:[],items:[{material:'Cement PPC',uom:'Bag',qty:5,rate:420,gst:18},{material:'River Sand',uom:'Ton',qty:2,rate:1600,gst:5}]}))
  if(s.status>=300)throw new Error('sale '+s.status);const sales=(await call('GET','/material/bootstrap')).json.sales;const sl=sales.find(x=>x.items.length===2);const pdf=await p.evaluate(async id=>{const t=Object.values(localStorage).concat(Object.values(sessionStorage)).find(v=>/^eyJ/.test(v))||'';const r=await fetch('/api/material/sales/'+id+'/challan',{headers:{Authorization:'Bearer '+t}});return Array.from(new Uint8Array(await r.arrayBuffer()))},sl.id)
  const {writeFileSync}=await import('node:fs');const f=`e2e-out/hsn-challan2-${T}.pdf`;writeFileSync(f,Buffer.from(pdf));const t=execSync('pdftotext -layout '+f+' -').toString()
  const line=n=>t.split('\n').find(l=>l.includes(n))||'';if(!/2523/.test(line('Cement PPC')))throw new Error('Cement PPC line lacks HSN: '+line('Cement PPC'));if(/\b\d{4,8}\b\s+\d/.test(line('River Sand').replace(/₹[\d,.]+/g,''))&&/2523/.test(line('River Sand')))throw new Error('River Sand wrongly has HSN')
  execSync(`pdftoppm -r 80 -png ${f} e2e-out/hsn-challan2-${T}`)})

// ---- stored challan lifecycle ----
const saleCode=async()=>{const bs=(await call('GET','/material/bootstrap')).json;return bs.sales.find(x=>x.items.length===1&&x.items[0].material==='Cement PPC')}
const pdfOf=async(id,q='')=>{const a=await p.evaluate(async([id,q])=>{const t=Object.values(localStorage).concat(Object.values(sessionStorage)).find(v=>/^eyJ/.test(v))||'';const r=await fetch('/api/material/sales/'+id+'/challan'+q,{headers:{Authorization:'Bearer '+t}});return Array.from(new Uint8Array(await r.arrayBuffer()))},[id,q]);const {writeFileSync}=await import('node:fs');const f=`e2e-out/lc-${T}-${Date.now()}.pdf`;writeFileSync(f,Buffer.from(a));return {f,text:execSync('pdftotext -layout '+f+' -').toString(),bytes:Buffer.from(a).toString('base64')}}
const openSale=async code=>{await p.goto(BASE+'/material');await p.waitForTimeout(1500);await p.getByRole('tab',{name:/Sales/}).click();await p.waitForTimeout(500);await p.getByText(code).first().click();await p.waitForTimeout(600)}
let first,saleRow
await step('stored challan is the same file every time and ignores later HSN change',async()=>{saleRow=await saleCode();first=await pdfOf(saleRow.id);const again=await pdfOf(saleRow.id);if(first.bytes!==again.bytes)throw new Error('bytes differ between two fetches')
  const t=(await types()).find(x=>x.name==='Cement PPC');const r=await call('PUT','/material/types/'+t.id,{name:'Cement PPC',uom:'Bag',hsn:'9999'});if(r.status!==200)throw new Error('hsn change '+r.status)
  const after=await pdfOf(saleRow.id);if(after.bytes!==first.bytes)throw new Error('stored challan changed after master HSN change');if(!/2523/.test(after.text)||/9999/.test(after.text))throw new Error('old HSN not kept')})
await step('Regenerate challan in popup (confirm) uses latest HSN and keeps old',async()=>{await openSale(saleRow.saleId);await p.getByRole('button',{name:'Regenerate challan'}).click();await p.waitForTimeout(400);if(!(await p.locator('body').innerText()).includes('The current challan stays in the challan history'))throw new Error('no confirm text');await sh('regen-confirm')
  await p.getByRole('dialog').last().getByRole('button',{name:'Regenerate challan'}).click();await p.waitForTimeout(1500)
  const h=(await call('GET','/material/sales/'+saleRow.id+'/challans')).json;if(h.length!==2||h[0].reason!=='REGENERATED')throw new Error('history '+JSON.stringify(h))
  const now=await pdfOf(saleRow.id);if(!/9999/.test(now.text))throw new Error('new HSN missing');const old=await pdfOf(saleRow.id,'?seq=1');if(old.bytes!==first.bytes)throw new Error('old challan not kept byte for byte');await sh('popup-after-regen')})
await step('challan history list: view older challan renders, shows older HSN',async()=>{await p.getByRole('button',{name:/Challan history/}).click();await p.waitForTimeout(400);await sh('challan-history')
  await p.getByRole('button',{name:'View',exact:true}).last().click();await p.waitForTimeout(2500);if(await p.locator('canvas').count()<1)throw new Error('no canvas for older challan');if(!(await p.locator('body').innerText()).includes('older, challan 1'))throw new Error('title lacks older marker');await sh('older-challan')
  await p.keyboard.press('Escape');await p.waitForTimeout(300)})
await step('sale edit makes a new stored challan, old ones kept',async()=>{await p.getByRole('button',{name:'Edit',exact:true}).click();await p.waitForTimeout(500);await p.getByPlaceholder('0',{exact:true}).first().fill('12');await p.getByRole('button',{name:'Save changes'}).click();await p.waitForTimeout(1800)
  const h=(await call('GET','/material/sales/'+saleRow.id+'/challans')).json;if(h.length!==3||h[0].reason!=='EDITED')throw new Error('history '+JSON.stringify(h));const cur=await pdfOf(saleRow.id);if(!/12 Bag/.test(cur.text))throw new Error('edited qty not on new challan');const old=await pdfOf(saleRow.id,'?seq=1');if(old.bytes!==first.bytes)throw new Error('first challan changed')
  const fs=await import('node:fs');fs.copyFileSync(cur.f,`e2e-out/challan-latest-${T}.pdf`);execSync(`pdftoppm -r 80 -png e2e-out/challan-latest-${T}.pdf e2e-out/challan-latest-${T}`)})
console.log('errors',errs);await b.close()
