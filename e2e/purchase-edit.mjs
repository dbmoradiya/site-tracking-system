import {chromium} from 'playwright-core'
const BASE=process.env.BASE_URL||'http://localhost:4173'
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']})
const mob=process.argv[2]==='mobile'
const p=await (await b.newContext(mob?{viewport:{width:412,height:915},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:900}})).newPage();const errs=[];p.setDefaultTimeout(6000);p.on('pageerror',e=>errs.push(e.message));p.on('response',r=>{if(r.status()>=400)errs.push(r.status()+' '+r.url())})
const T=mob?'m':'d';const sh=async n=>{await p.waitForTimeout(600);await p.screenshot({path:`e2e-out/e2e-ed${T}-${n}.png`})}
const step=async(n,f)=>{try{await f();console.log('OK  ',n)}catch(e){console.log('FAIL',n,e.message.split('\n')[0]);await sh('fail-'+n.replace(/\W+/g,'_'))}}
await p.goto(BASE+'/');await p.waitForTimeout(800)
await p.getByLabel('Mobile number').fill('+919000000009');await p.getByRole('textbox',{name:'Password'}).fill('SiteTrack123!');await p.getByRole('button',{name:'Sign in'}).click();await p.waitForTimeout(1200)
await p.goto(BASE+'/material');await p.waitForTimeout(3000)
await step('stock page',async()=>{await sh('stock')})
await step('edit purchase creates a version',async()=>{
  await p.getByRole('tab',{name:/Purchase/}).click();await p.waitForTimeout(500)
  await p.getByText(/SE\d{9}/).first().click();await p.getByRole('button',{name:'Edit',exact:true}).click()
  await p.getByPlaceholder('0',{exact:true}).first().fill('120');console.log('filled');await p.getByRole('button',{name:'Save changes'}).click();console.log('saved');await p.waitForTimeout(1500)
  console.log('reopened');await sh('after-save');console.log(await p.getByRole('button').allInnerTexts());await p.getByRole('button',{name:/Edit history/}).click();await p.waitForTimeout(500)
  const t=await p.getByRole('dialog').innerText();if(!/1 earlier version/.test(t))throw new Error('no version: '+t.slice(0,200));await sh('history')})
await step('delete purchase archives',async()=>{const code=(await p.getByText(/SE\d{9}/).first().innerText()).trim();await p.getByRole('button',{name:'Delete',exact:true}).click();await p.getByRole('button',{name:'Delete purchase'}).click();await p.waitForTimeout(1500);await p.waitForTimeout(1500);const n=await p.getByRole('row',{name:new RegExp(code)}).count();if(n){await sh('after-delete');throw new Error('still listed '+n)}})
console.log('errors',errs);await b.close()
