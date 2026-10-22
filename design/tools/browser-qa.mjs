import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:4173',root='design/deliverables';
const manifest=JSON.parse(await fs.readFile(root+'/review-manifest.json','utf8'));
await fs.mkdir('design/test-results',{recursive:true});await fs.mkdir(root+'/previews',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1500,height:1100},deviceScaleFactor:1});
const failures=[],rendered=[],consoleErrors=[];page.on('pageerror',e=>consoleErrors.push(e.message));
const samples=new Set(['A02','A05','A07','A22','A25','A38','A48','A65','M04','M10','M11','M17','M35','M45','M46','M47']);
for(const s of manifest.screens){
 await page.goto(base+'/screens/'+s.id+'.svg');await page.evaluate(()=>document.fonts.ready);
 const result=await page.evaluate(()=>{const svg=document.querySelector('svg'),vb=svg.viewBox.baseVal,issues=[];for(const e of svg.querySelectorAll('text')){const b=e.getBBox(),w=Number(e.dataset.boxWidth);if(b.width>w+4)issues.push({type:'text-overflow',text:e.textContent,actual:b.width,allowed:w});if(b.x<-2||b.y<-2||b.x+b.width>vb.width+3||b.y+b.height>vb.height+3)issues.push({type:'out-of-board',text:e.textContent,x:b.x,y:b.y,width:b.width,height:b.height});}return {issues,textCount:svg.querySelectorAll('text').length,width:vb.width,height:vb.height,fonts:[...document.fonts].map(f=>({family:f.family,status:f.status}))};});
 for(const issue of result.issues)failures.push({screen:s.id,...issue});rendered.push({screen:s.id,textCount:result.textCount,fonts:result.fonts});
 if(samples.has(s.id))await page.locator('svg').screenshot({path:root+'/previews/'+s.id+'.png'});
}
// Exercise real SVG hotspots, not just the declarative navigation graph.
await page.goto(base+'/#M10');await page.locator('#stage svg').waitFor();
await page.locator('#stage a[data-to="M11"]').click();await page.waitForFunction(()=>document.querySelector('#current-title')?.textContent.startsWith('M11 /'));
await page.locator('#stage a[data-to="M14"]').click();await page.waitForFunction(()=>document.querySelector('#current-title')?.textContent.startsWith('M14 /'));
await page.locator('#stage a[data-to="M10"]').click();await page.waitForFunction(()=>document.querySelector('#current-title')?.textContent.startsWith('M10 /'));
await page.locator('#note').fill('QA: photo addition location is clear.');await page.locator('#save-note').click();assert.ok(await page.evaluate(()=>localStorage.getItem('fieldwork-review-notes').includes('photo addition location')));
await page.goto(base+'/#A65');await page.locator('#stage a[data-to="A52"]').click();await page.waitForFunction(()=>document.querySelector('#current-title')?.textContent.startsWith('A52 /'));
assert.match(await page.locator('#stage').innerText(),/Materials still visible/);
await page.setViewportSize({width:390,height:844});await page.goto(base+'/#M46');await page.locator('#stage svg').waitFor();await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:root+'/previews/review-mobile.png',fullPage:true});
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'Review gallery horizontal overflow');
await page.setViewportSize({width:1500,height:1100});await page.goto(base+'/#A02');await page.locator('#stage svg').waitFor();await page.screenshot({path:root+'/previews/review-desktop.png',fullPage:true});
await page.goto(base+'/print.html',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await page.pdf({path:root+'/design-review.pdf',format:'A4',landscape:true,printBackground:true,preferCSSPageSize:true});
const result={sourceSha256:manifest.sourceSha256,screensRendered:rendered.length,textNodesMeasured:rendered.reduce((n,r)=>n+r.textCount,0),failures,consoleErrors,flowsTested:['photo composer → location permission → photo review → composer','final stage approval → completed site with material reconciliation'],galleryResponsive:true,localNotesPersist:true,pdfGenerated:true,rendered};
await fs.writeFile('design/test-results/browser-qa.json',JSON.stringify(result,null,2));await fs.writeFile(root+'/browser-qa-summary.json',JSON.stringify({...result,rendered:undefined},null,2));
await browser.close();console.log(JSON.stringify({...result,rendered:undefined},null,2));if(failures.length||consoleErrors.length)process.exitCode=1;
