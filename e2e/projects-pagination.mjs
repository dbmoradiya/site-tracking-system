// Projects menu list pagination: pager over the projects table; Sites inside a project stay unpaginated.
// Real clicks in the real built app; throwaway embedded database.
import {chromium} from 'playwright-core'
const BASE=process.env.BASE_URL||'http://localhost:4173'
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']})
const mob=process.argv[2]==='mobile'
const ctxOpts=mob?{viewport:{width:412,height:915},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:900}}
const p=await (await b.newContext(ctxOpts)).newPage();p.setDefaultTimeout(8000)
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('response',r=>{if(r.status()>=400)errs.push(r.status()+' '+r.url())})
const T=mob?'m':'d';const sh=async n=>{await p.waitForTimeout(600);await p.screenshot({path:`e2e-out/e2e-pg${T}-${n}.png`})}
const step=async(n,f)=>{try{await f();console.log('OK  ',n)}catch(e){console.log('FAIL',n,e.message.split('\n')[0]);await sh('fail-'+n.replace(/\W+/g,'_'))}}
await p.goto(BASE+'/');await p.waitForTimeout(800)
await p.getByLabel('Mobile number').fill('+919000000009');await p.getByRole('textbox',{name:'Password'}).fill('SiteTrack123!');await p.getByRole('button',{name:'Sign in'}).click();await p.waitForTimeout(1500)
const call=(method,path,body)=>p.evaluate(async([method,path,body])=>{const t=Object.values(localStorage).concat(Object.values(sessionStorage)).find(v=>/^eyJ/.test(v))||'';const h={Authorization:'Bearer '+t};let b;if(body){h['Content-Type']='application/json';b=JSON.stringify(body)}const r=await fetch('/api'+path,{method,headers:h,body:b});return {status:r.status,json:await r.json().catch(()=>null)}},[method,path,body])
const projects=async()=>{await p.goto(BASE+'/projects');await p.waitForTimeout(1200)}
const bodyRows=async()=>p.locator('table tbody tr').count()
await step('seed: 12 extra projects (14 total with seeded 2)',async()=>{
  const emps=(await call('GET','/setup')).json.employees;const cid=emps.find(e=>e.name==='Kavita Shah').id
  for(let i=1;i<=12;i++){const n='PG'+String(i).padStart(2,'0');const r=await call('POST','/projects',{name:n,customerName:'Cust '+n,customerMobile:'98250000'+String(i).padStart(2,'0'),coordinatorId:cid});if(r.status!==200)throw new Error('project '+n+' '+r.status)}})
await step('Projects list paginates: 10 rows, "Showing 1-10 of 14 projects", page control visible',async()=>{await projects()
  const t=await p.locator('body').innerText();if(!/14 projects/.test(t))throw new Error('count: '+t.slice(0,200))
  if(!/Showing 1-10 of 14 projects/.test(t))throw new Error('pager text missing')
  if(await bodyRows()!==10)throw new Error('rows '+(await bodyRows()))
  await p.getByRole('button',{name:'2',exact:true}).waitFor();await sh('page1')})
await step('page 2 shows remaining 4 rows and page 1 names are gone',async()=>{
  const first=await p.locator('table tbody tr').first().innerText()
  await p.getByRole('button',{name:'2',exact:true}).click();await p.waitForTimeout(600)
  const t=await p.locator('body').innerText();if(!/Showing 11-14 of 14 projects/.test(t))throw new Error('pager page2')
  if(await bodyRows()!==4)throw new Error('rows '+(await bodyRows()))
  const first2=await p.locator('table tbody tr').first().innerText();if(first2===first)throw new Error('same rows on page 2');await sh('page2')})
await step('rows-per-page 25 shows all 14 and hides the page control',async()=>{
  await p.getByLabel('Rows per page').selectOption('25');await p.waitForTimeout(600)
  const t=await p.locator('body').innerText();if(!/Showing 1-14 of 14 projects/.test(t))throw new Error('pager 25')
  if(await bodyRows()!==14)throw new Error('rows '+(await bodyRows()))
  if(await p.getByRole('button',{name:'2',exact:true}).count()!==0)throw new Error('page control still visible')})
await step('search narrows the list and the pager follows the filtered total',async()=>{
  await p.getByLabel('Search projects').fill('PG0');await p.waitForTimeout(600)
  const t=await p.locator('body').innerText();if(!/9 projects/.test(t))throw new Error('count: '+t.slice(0,200))
  if(!/Showing 1-9 of 9 projects/.test(t))throw new Error('pager filtered')
  if(await bodyRows()!==9)throw new Error('rows '+(await bodyRows()))
  await p.getByLabel('Search projects').fill('PG11');await p.waitForTimeout(600)
  const t2=await p.locator('body').innerText();if(!/Showing 1-1 of 1 projects/.test(t2))throw new Error('pager single');await sh('filtered')})
await step('Sites list inside a project stays unpaginated (no pager, no rows-per-page)',async()=>{
  await p.getByLabel('Search projects').fill('Sun City');await p.waitForTimeout(600)
  await p.getByRole('link',{name:'Sun City Complex'}).click();await p.waitForTimeout(1200)
  const t=await p.locator('body').innerText();if(!/Block A/.test(t)||!/Block B/.test(t))throw new Error('sites missing')
  if(await p.getByLabel('Rows per page').count()!==0)throw new Error('pager on sites list')
  if(/Showing \d+-\d+ of \d+ sites/.test(t))throw new Error('sites pager text');await sh('sites')})
console.log('errors',errs);await b.close()
