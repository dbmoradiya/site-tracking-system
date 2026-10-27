import {chromium} from 'playwright-core'
const BASE=process.env.BASE_URL||'http://localhost:4173'
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']})
const mob=process.argv[2]==='mobile'
const p=await (await b.newContext(mob?{viewport:{width:412,height:915},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:900}})).newPage();const errs=[];p.setDefaultTimeout(6000);p.on('pageerror',e=>errs.push(e.message));p.on('response',r=>{if(r.status()>=400)errs.push(r.status()+' '+r.url())})
const T=mob?'m':'d';const sh=async n=>{await p.waitForTimeout(600);await p.screenshot({path:`e2e-out/e2e-co${T}-${n}.png`})}
const step=async(n,f)=>{try{await f();console.log('OK  ',n)}catch(e){console.log('FAIL',n,e.message.split('\n')[0]);await sh('fail-'+n.replace(/\W+/g,'_'))}}
const go=async u=>{await p.goto(BASE+''+u);await p.waitForTimeout(1200)}
await go('/');await p.getByLabel('Mobile number').fill('+919000000001');await p.getByRole('textbox',{name:'Password'}).fill('SiteTrack123!');await p.getByRole('button',{name:'Sign in'}).click();await p.waitForTimeout(1500)
await step('no Material menu',async()=>{if(await p.getByRole('link',{name:'Material'}).count())throw new Error('menu visible')})
await step('/material redirects',async()=>{await go('/material');if(p.url().includes('/material'))throw new Error(p.url())})
await step('own project shows linked sales',async()=>{await go('/projects/1');await p.getByRole('button',{name:/Linked sales/}).click();const n=await p.locator('[aria-label^="Open sale"]').count();console.log('   rows',n);const sl=(await import('node:fs')).readFileSync('e2e-out/siteless.txt','utf8').trim();if(n<1)throw new Error('rows '+n);if((await p.locator('body').innerText()).includes(sl))throw new Error('site-less sale visible');await sh('project')})
await step('sale popup read-only, only own sites',async()=>{await p.locator('[aria-label^="Open sale"]').first().click();await p.waitForTimeout(800);for(const n of ['Edit','Delete','Save'])if(await p.getByRole('button',{name:n,exact:true}).count()>0&&n!=='Edit history')throw new Error(n+' present');const t=await p.getByRole('dialog').innerText();if(/Villa 9|Green Valley/.test(t))throw new Error('other project site leaked');await sh('popup')})
await step('challan View works',async()=>{await p.getByRole('button',{name:'View challan'}).click();await p.waitForTimeout(2000);if(await p.locator('canvas').count()<1)throw new Error('no canvas');await sh('challan');await p.keyboard.press('Escape');await p.keyboard.press('Escape')})
await step('other project blocked',async()=>{await go('/projects/2');if(await p.getByRole('button',{name:/Linked sales/}).count())throw new Error('linked sales shown for other project')})
await step('other site blocked',async()=>{await go('/sites/3');if(await p.getByRole('button',{name:/Linked sales/}).count())throw new Error('shown')})
await step('own site shows sales',async()=>{await go('/sites/1');await p.getByRole('button',{name:/Linked sales/}).click();if(await p.locator('[aria-label^="Open sale"]').count()<1)throw new Error('none');await sh('site')})
console.log('errors',errs);await b.close()
