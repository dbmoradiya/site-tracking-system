import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:4173',root='design/deliverables';
const manifest=JSON.parse(await fs.readFile(root+'/review-manifest.json','utf8'));
await fs.mkdir('design/test-results',{recursive:true});await fs.mkdir(root+'/previews',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1500,height:1100},deviceScaleFactor:1});
const failures=[],rendered=[],consoleErrors=[];page.on('pageerror',e=>consoleErrors.push(e.message));
const samples=new Set(['A02','A05','A07','A08','A22','A25','A38','A48','A65','M04','M06','M24','M58','M10','M11','M17','M35','M45','M46','M47','M74','M78','M80','M82','M84','M88','M90','M105','M106','M109','M110']);
for(const s of manifest.screens){
 await page.goto(base+'/screens/'+s.id+'.svg');await page.evaluate(()=>document.fonts.ready);
 const result=await page.evaluate(()=>{const svg=document.querySelector('svg'),vb=svg.viewBox.baseVal,issues=[];for(const e of svg.querySelectorAll('text')){const b=e.getBBox(),w=Number(e.dataset.boxWidth);if(b.width>w+4)issues.push({type:'text-overflow',text:e.textContent,actual:b.width,allowed:w});if(b.x<-2||b.y<-2||b.x+b.width>vb.width+3||b.y+b.height>vb.height+3)issues.push({type:'out-of-board',text:e.textContent,x:b.x,y:b.y,width:b.width,height:b.height});}return {issues,textCount:svg.querySelectorAll('text').length,width:vb.width,height:vb.height,fonts:[...document.fonts].map(f=>({family:f.family,status:f.status}))};});
 for(const issue of result.issues)failures.push({screen:s.id,...issue});rendered.push({screen:s.id,textCount:result.textCount,fonts:result.fonts});
 if(samples.has(s.id))await page.locator('svg').screenshot({path:root+'/previews/'+s.id+'.png'});
}
if(failures.length)console.log(JSON.stringify({renderIssues:failures.slice(0,30),count:failures.length},null,2));
// Exercise the redesigned main workspace using actual rendered hotspots.
const open=async id=>{await page.goto(base+'/#'+id);await page.waitForFunction(id=>document.querySelector('#current-title')?.textContent.startsWith(id+' /'),id);await page.locator('#stage svg').waitFor();};
const click=async id=>{await page.locator('#stage a[data-to="'+id+'"]').first().click();await page.waitForFunction(id=>document.querySelector('#current-title')?.textContent.startsWith(id+' /'),id);};
await open('M04');await click('M06');await click('M58');assert.match(await page.locator('#stage').innerText(),/You have started this work/);await click('M17');await click('M19');await click('M06');
await click('M24');await click('M29');await click('M24');await click('M26');await click('M27');await click('M06');await click('M07');await click('M56');await click('M19');
await open('M06');await click('M11');await click('M14');await click('M34');
await open('M06');await click('M15');await click('M105');await click('M106');await click('M34');
await open('M46');await click('M74');await click('M78');await click('M80');await click('M92');await click('M74');await click('M82');await click('M109');await click('M110');await click('M92');await click('M74');await click('M90');await click('M113');await click('M74');
await open('M45');await click('M73');await click('M75');await click('M83');await click('M85');await click('M73');
await open('A08');await click('A22');
// Exercise real SVG hotspots, not just the declarative navigation graph.
await page.goto(base+'/#M10');await page.locator('#stage svg').waitFor();
await page.locator('#stage a[data-to="M11"]').click();await page.waitForFunction(()=>document.querySelector('#current-title')?.textContent.startsWith('M11 /'));
await page.locator('#stage a[data-to="M14"]').click();await page.waitForFunction(()=>document.querySelector('#current-title')?.textContent.startsWith('M14 /'));
await page.locator('#stage a[data-to="M10"]').click();await page.waitForFunction(()=>document.querySelector('#current-title')?.textContent.startsWith('M10 /'));
await page.locator('#note').fill('QA: photo addition location is clear.');await page.locator('#save-note').click();assert.ok(await page.evaluate(()=>localStorage.getItem('fieldwork-review-notes').includes('photo addition location')));
await page.goto(base+'/#A65');await page.locator('#stage a[data-to="A52"]').click();await page.waitForFunction(()=>document.querySelector('#current-title')?.textContent.startsWith('A52 /'));
assert.match(await page.locator('#stage').innerText(),/Materials still visible/);
await page.setViewportSize({width:360,height:800});await page.goto(base+'/employee.html#M46');await page.locator('#phone svg').waitFor();await page.locator('#phone a[data-to="M74"]').click();await page.waitForFunction(()=>location.hash==='#M74');await page.locator('#phone a[data-to="M82"]').click();await page.waitForFunction(()=>location.hash==='#M82');await page.locator('#phone a[data-to="M109"]').first().click();await page.waitForFunction(()=>location.hash==='#M109');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'Employee demo horizontal overflow');
await page.goto(base+'/employee.html#M46');await page.locator('#phone a[data-to="M121"]').click();await page.waitForFunction(()=>location.hash==='#M121');await page.locator('#phone a[data-to="M127"]').click();await page.waitForFunction(()=>location.hash==='#M127');await page.locator('#phone a[data-to="M45"]').click();await page.waitForFunction(()=>location.hash==='#M45');
await page.setViewportSize({width:390,height:844});await page.goto(base+'/#M46');await page.locator('#stage svg').waitFor();await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:root+'/previews/review-mobile.png',fullPage:true});
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'Review gallery horizontal overflow');
await page.setViewportSize({width:1500,height:1100});await page.goto(base+'/#A02');await page.locator('#stage svg').waitFor();await page.screenshot({path:root+'/previews/review-desktop.png',fullPage:true});
await page.goto(base+'/print.html',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);assert.equal(await page.locator('.page > svg').count(),manifest.screens.length,'PDF must inline SVG screens so web fonts render');assert.ok(await page.evaluate(()=>[...document.fonts].some(f=>f.family==='sourcesanspro'&&f.status==='loaded')),'PDF Source Sans Pro failed to load');await page.pdf({path:root+'/design-review.pdf',format:'A4',landscape:true,printBackground:true,preferCSSPageSize:true});
const result={sourceSha256:manifest.sourceSha256,screensRendered:rendered.length,textNodesMeasured:rendered.reduce((n,r)=>n+r.textCount,0),failures,consoleErrors,flowsTested:['My work → site → Start work → Finished → manager check','direct photo → location → send without caption','direct voice → record → stop → send without typing','Gujarati home → photo → voice → material request with language preserved','Hindi home → start → completion with language preserved','materials → record use / request → site','all work → no-photo completion → manager check','manager stage row → approval review','photo composer → location permission → photo review → composer','final stage approval → completed site with material reconciliation','360px employee demo → Gujarati recording, help and language selection'],galleryResponsive:true,localNotesPersist:true,pdfGenerated:true,rendered};
await fs.writeFile('design/test-results/browser-qa.json',JSON.stringify(result,null,2));await fs.writeFile(root+'/browser-qa-summary.json',JSON.stringify({...result,rendered:undefined},null,2));
await browser.close();console.log(JSON.stringify({...result,rendered:undefined},null,2));if(failures.length||consoleErrors.length)process.exitCode=1;
