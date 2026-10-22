import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';

// Explicit override is useful for CI. Fall back to an installed Playwright shell
// when the local Chrome installation cannot start its automation pipe.
export async function launchDesignBrowser(){
 const requested=process.env.DESIGN_BROWSER_PATH;
 if(requested)return chromium.launch({headless:true,executablePath:requested});
 try{return await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',timeout:10000});}
 catch(chromeError){
  const cache=path.join(os.homedir(),'Library/Caches/ms-playwright');
  const revisions=(await fs.readdir(cache).catch(()=>[])).filter(n=>/^chromium_headless_shell-\d+$/.test(n)).sort((a,b)=>Number(b.split('-').at(-1))-Number(a.split('-').at(-1)));
  for(const revision of revisions){const executable=path.join(cache,revision,'chrome-headless-shell-mac-arm64/chrome-headless-shell');try{await fs.access(executable);return await chromium.launch({headless:true,executablePath:executable,timeout:10000});}catch{}}
  throw chromeError;
 }
}
