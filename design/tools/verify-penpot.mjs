import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base='http://localhost:9001',root='design/deliverables';
const manifest=JSON.parse(await fs.readFile(root+'/review-manifest.json'));
const artifactSha256=createHash('sha256').update(await fs.readFile(root+'/fieldwork-designs.penpot')).digest('hex');
const name=manifest.exportName||'FIELDWORK · Site tracking · Client review v0.2';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 const context=await browser.newContext({storageState:'design/.runtime/penpot-browser.json'});
 let previous=null;try{previous=JSON.parse(await fs.readFile(root+'/penpot-verification.json'));}catch{}
 if(previous?.importedFileId&&previous.artifactSha256!==artifactSha256){const renamed=await context.request.post(base+'/api/main/methods/rename-file',{data:{id:previous.importedFileId,name:'Validation draft · superseded by final client review'}});assert.equal(renamed.status(),200);}
 await context.request.post(base+'/api/main/methods/update-profile-props',{data:{props:{'onboarding-viewed':true,'onboarding-questions-answered':true,'release-notes-viewed':'2.18'}}});
 const page=await context.newPage({viewport:{width:1700,height:1100}});
 await page.goto(base);await page.waitForTimeout(1500);
 if(!await page.getByText(name,{exact:true}).count()){
  await page.locator('input[type=file]').first().setInputFiles(root+'/fieldwork-designs.penpot');
  await page.locator('input[type=button][value="Continue"]').click();
  await page.getByText('1 file has been imported successfully.',{exact:true}).waitFor({timeout:60000});
  await page.locator('[class*="dashboard_import__modal-close-btn"]').click();
  await page.reload();await page.getByText(name,{exact:true}).first().waitFor();
 }
 await page.getByText(name,{exact:true}).first().dblclick();await page.waitForURL(/workspace/, {timeout:20000});
 await page.getByText('00 · Foundations & components',{exact:true}).first().waitFor({timeout:30000});
 const editorURL=page.url(),fileId=new URLSearchParams(editorURL.split('?')[1]).get('file-id');
 const response=await context.request.post(base+'/api/main/methods/get-file',{headers:{Accept:'application/json'},data:{id:fileId}});assert.equal(response.status(),200);const file=await response.json();
 const pages=Object.values(file.data.pagesIndex),all=pages.flatMap(p=>Object.values(p.objects));
 const frames=all.filter(s=>s.type==='frame'&&s.id!=='00000000-0000-0000-0000-000000000000');
 assert.equal(pages.length,4);assert.equal(frames.length,manifest.totalBoards);
 for(const s of manifest.screens){const frame=frames.find(f=>f.name.startsWith(s.id+' · '));assert.ok(frame,'Missing imported screen '+s.id);assert.equal(frame.width,s.width);assert.equal(frame.height,s.height);}
 const nativeFlows=pages.reduce((n,p)=>n+Object.keys(p.flows||{}).length,0);assert.equal(nativeFlows,7);
 assert.equal(Object.keys(file.data.components).length,6);
 const cards=all.filter(s=>s.type==='rect'&&s.name.startsWith('Card /'));assert.ok(cards.length>0);for(const card of cards)assert.equal(card.r1,13,'Native card radius mismatch');
 assert.equal(file.name,name,'Unexpected imported artifact');
 for(const t of all.filter(s=>s.type==='text'))assert.ok(t.positionData?.length,'Imported text has no viewer positions: '+t.name);
 const ids=new Set(all.map(s=>s.id));let links=0;for(const s of all)for(const i of s.interactions||[]){if(i.actionType==='navigate'){assert.ok(ids.has(i.destination),'Broken imported link');links++;}}
 const admin=pages.find(p=>p.name.startsWith('01')),mobile=pages.find(p=>p.name.startsWith('02'));
 const edit=new URL(editorURL);const query=new URLSearchParams(edit.hash.split('?')[1]);
 for(const [p,id,out]of [[admin,'A02','penpot-manager'],[mobile,'M46','penpot-gujarati'],[admin,'A08','penpot-stages'],[mobile,'M06','penpot-workspace'],[mobile,'M10','penpot-update-sheet']]){
  query.set('page-id',p.id);await page.goto(base+'/#/workspace?'+query);await page.getByText(p.name,{exact:true}).first().waitFor();
  const board=frames.find(f=>f.name.startsWith(id+' · '));await page.getByText(board.name,{exact:true}).last().click();await page.keyboard.press('Shift+2');await page.waitForTimeout(2500);await page.screenshot({path:root+'/previews/'+out+'.png'});
 }
 const share=await context.request.post(base+'/api/main/methods/create-share-link',{headers:{Accept:'application/json'},data:{fileId,pages:pages.map(p=>p.id),whoComment:'team',whoInspect:'team'}});
 const shareData=share.status()===200?await share.json():null;
 const ordered=p=>p.objects['00000000-0000-0000-0000-000000000000'].shapes.map(id=>p.objects[id]).filter(s=>s?.type==='frame').reverse();
 const startIndex=ordered(admin).findIndex(s=>s.name.startsWith('A02 ·'));
 const viewerURL=shareData?.id?base+'/#/view?file-id='+fileId+'&page-id='+admin.id+'&share-id='+shareData.id+'&index='+startIndex:null;
 let publicViewVerified=false,nativeVoiceFlowVerified=false;
 if(viewerURL){const guest=await browser.newContext();const view=await guest.newPage({viewport:{width:1600,height:1100}});await view.goto(viewerURL);await view.getByText('A clear view of today',{exact:true}).filter({visible:true}).first().waitFor({timeout:20000});assert.ok(!view.url().includes('/auth/'));publicViewVerified=true;await view.screenshot({path:root+'/previews/penpot-viewer.png'});
 const mobileURL=new URL(viewerURL),mobileQuery=new URLSearchParams(mobileURL.hash.split('?')[1]);mobileQuery.set('page-id',mobile.id);mobileQuery.set('index',String(ordered(mobile).findIndex(s=>s.name.startsWith('M15 ·'))));await view.goto(base+'/#/view?'+mobileQuery);await view.getByText('Tell your manager',{exact:true}).filter({visible:true}).first().waitFor({timeout:20000});await view.getByText('Tap to record',{exact:true}).filter({visible:true}).last().click();await view.getByText('Recording your voice…',{exact:true}).filter({visible:true}).first().waitFor({timeout:10000});await view.getByText('Stop recording',{exact:true}).filter({visible:true}).last().click();await view.getByText('Your voice note is ready',{exact:true}).filter({visible:true}).first().waitFor({timeout:10000});nativeVoiceFlowVerified=true;await view.screenshot({path:root+'/previews/penpot-voice-flow.png'});await guest.close();}
 const result={status:'passed',importedArtifactName:name,penpotVersion:'2.18.3',sourceSha256:manifest.sourceSha256,artifactSha256,importedFileId:fileId,importedScreens:manifest.screens.length,importedBoards:frames.length,pages:pages.map(p=>({name:p.name,shapes:Object.keys(p.objects).length,flows:Object.keys(p.flows||{}).length})),editableTextShapes:all.filter(s=>s.type==='text').length,prototypeLinks:links,components:6,flows:nativeFlows,publicViewVerified,nativeVoiceFlowVerified,editorURL,viewerURL,scope:'Actual import into a loopback-only local Penpot instance. No hosted cloud workspace or external client URL has been published.'};
 await fs.writeFile(root+'/penpot-verification.json',JSON.stringify(result,null,2));await fs.writeFile('design/.runtime/editor-location.json',JSON.stringify({url:editorURL}));await context.storageState({path:'design/.runtime/penpot-browser.json'});console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
