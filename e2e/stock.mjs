// Sale without any purchase: Current stock shows the material with negative stock; Setup Material Types shows purchased and sold totals.
// Real clicks in the real built app; throwaway embedded database.
import {chromium} from 'playwright-core'
import {execSync} from 'node:child_process'
const BASE=process.env.BASE_URL||'http://localhost:4173'
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']})
const mob=process.argv[2]==='mobile'
const ctxOpts=mob?{viewport:{width:412,height:915},isMobile:true,hasTouch:true,acceptDownloads:true}:{viewport:{width:1280,height:900},acceptDownloads:true}
const p=await (await b.newContext(ctxOpts)).newPage();p.setDefaultTimeout(8000)
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('response',r=>{if(r.status()>=400&&!/\/challan/.test(r.url()))errs.push(r.status()+' '+r.url())})
const T=mob?'m':'d';const sh=async n=>{await p.waitForTimeout(600);await p.screenshot({path:`e2e-out/e2e-stk${T}-${n}.png`})}
const step=async(n,f)=>{try{await f();console.log('OK  ',n)}catch(e){console.log('FAIL',n,e.message.split('\n')[0]);await sh('fail-'+n.replace(/\W+/g,'_'))}}
await p.goto(BASE+'/');await p.waitForTimeout(800)
await p.getByLabel('Mobile number').fill('+919000000009');await p.getByRole('textbox',{name:'Password'}).fill('SiteTrack123!');await p.getByRole('button',{name:'Sign in'}).click();await p.waitForTimeout(1500)
const call=(method,path,body,multipart)=>p.evaluate(async([method,path,body,multipart])=>{const t=Object.values(localStorage).concat(Object.values(sessionStorage)).find(v=>/^eyJ/.test(v))||'';const h={Authorization:'Bearer '+t};let b;if(multipart){const f=new FormData();f.append('data',JSON.stringify(body));b=f}else if(body){h['Content-Type']='application/json';b=JSON.stringify(body)}const r=await fetch('/api'+path,{method,headers:h,body:b});const ct=r.headers.get('content-type')||'';return {status:r.status,json:ct.includes('json')?await r.json():null}},[method,path,body,multipart])
const pdfOf=async(id,q='')=>{const a=await p.evaluate(async([id,q])=>{const t=Object.values(localStorage).concat(Object.values(sessionStorage)).find(v=>/^eyJ/.test(v))||'';const r=await fetch('/api/material/sales/'+id+'/challan'+q,{headers:{Authorization:'Bearer '+t}});return Array.from(new Uint8Array(await r.arrayBuffer()))},[id,q]);const {writeFileSync}=await import('node:fs');const f=`e2e-out/grp-${T}-${Date.now()}.pdf`;writeFileSync(f,Buffer.from(a));return {f,text:execSync('pdftotext -layout '+f+' -').toString(),bytes:Buffer.from(a).toString('base64')}}
const tab=async n=>{await p.goto(BASE+'/setup');await p.waitForTimeout(1200);await p.getByRole('tab',{name:n}).click();await p.waitForTimeout(600)}
const stockTab=async()=>{await p.goto(BASE+'/material');await p.waitForTimeout(1500)}
const row=async(label)=>(await p.locator('tr',{hasText:label}).first().innerText()).replace(/\s+/g,' ')
await step('seed: SOLDONLY (never purchased), BOTH (purchased 10, sold 4, returned 1)',async()=>{
  for(const n of ['SOLDONLY','BOTH']){const r=await call('POST','/material/types',{name:n,uom:'Nos',hsn:''});if(r.status!==200)throw new Error('type '+r.status)}
  let r=await call('POST','/material/purchases',{date:'2026-10-28',vendor:'Stk Supplier',vendorMobile:'9825012345',vendorGst:'',vendorAddress:'Surat',billNumber:'S1',items:[{material:'BOTH',uom:'Nos',qty:10,rate:50,gst:18}]},true)
  if(r.status!==200)throw new Error('purchase '+r.status)
  const s=(type,items)=>call('POST','/material/sales',{type,date:'2026-10-28',vendor:'Stk Supplier',siteIds:[],items})
  r=await s('DEBIT',[{material:'SOLDONLY',uom:'Nos',qty:5,rate:10,gst:18},{material:'BOTH',uom:'Nos',qty:4,rate:60,gst:18}]);if(r.status!==200)throw new Error('sale '+r.status)
  r=await s('CREDIT',[{material:'BOTH',uom:'Nos',qty:1,rate:60,gst:18}]);if(r.status!==200)throw new Error('credit '+r.status)})
await step('Current stock lists the never-purchased item with negative stock, no bad date',async()=>{await stockTab()
  const t=await row('SOLDONLY');if(!/SOLDONLY Nos 0 5 0 -5 Nos -/i.test(t))throw new Error(t)
  const b=await row('BOTH');if(!/BOTH Nos 10 4 1 7 Nos/i.test(b))throw new Error(b)
  if((await p.locator('tbody').first().innerText()).includes('undefined'))throw new Error('undefined text');await sh('stock')})
await step('stock detail of never-purchased item: -5, empty purchase history, sale in history',async()=>{
  await p.getByLabel('Open SOLDONLY detail').click();await p.waitForTimeout(900);const t=await p.getByRole('dialog').innerText()
  if(!/Current stock\s*-5 Nos/.test(t)||!/Debit \(out\)\s*5 Nos/.test(t))throw new Error(t.slice(0,300));await sh('stock-detail')})
await step('backend stock API agrees (-5 and 7)',async()=>{const st=(await call('GET','/material/bootstrap')).json.stock
  const g=n=>Number(st.find(x=>x.material===n).stock);if(g('SOLDONLY')!==-5||g('BOTH')!==7)throw new Error(g('SOLDONLY')+' '+g('BOTH'))})
await step('Setup Material Types shows purchased and sold totals; Material groups stays sales-only',async()=>{await tab('Material Types')
  const th=(await p.locator('table').first().locator('thead').innerText()).replace(/\s+/g,' ');if(!/Purchases Purchased qty Sales Sold qty/.test(th))throw new Error(th)
  const a=await row('SOLDONLY');if(!/SOLDONLY Nos - 0 0 Nos 1 5 Nos/i.test(a))throw new Error(a)
  const b=await row('BOTH');if(!/BOTH Nos - 1 10 Nos 1 4 Nos/i.test(b))throw new Error(b)
  const g=await p.getByLabel('Material groups').innerText();if(/Purchase/.test(g))throw new Error('groups table mentions purchases');await sh('setup')})
await step('branding: Shreeji Energy in header, login logo, page title, company name and a new challan PDF; old name gone',async()=>{
  await stockTab();const h=await p.locator('header').first().innerText();if(!/Shreeji Energy/.test(h)||/Enterprise/i.test(h))throw new Error('header: '+h)
  if(!/Shreeji Energy/.test(await p.title()))throw new Error('title '+await p.title());await sh('branding-header')
  const co=(await call('GET','/material/bootstrap')).json.company;if(co.name!=='Shreeji Energy')throw new Error('company '+co.name)
  const sales=(await call('GET','/material/sales')).json;const id=(sales.content||sales)[0].id;const x=(await pdfOf(id)).text
  if(!/Shreeji Energy/.test(x)||/Enterprise/i.test(x))throw new Error('pdf: '+x.slice(0,300))
  const l=await (await b.newContext(ctxOpts)).newPage();await l.goto(BASE+'/');await l.waitForTimeout(1200)
  const im=l.locator('img[alt="Shreeji Energy logo"]:visible').first();await im.waitFor();const nat=await im.evaluate(e=>e.naturalWidth);if(nat<500)throw new Error('logo too small '+nat)
  if(/Enterprise/i.test(await l.locator('body').innerText()))throw new Error('login still says Enterprise')
  await l.screenshot({path:`e2e-out/e2e-stk${T}-login.png`});await l.context().close()})
console.log('errors',errs);await b.close()
