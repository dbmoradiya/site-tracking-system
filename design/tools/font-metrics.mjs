import fs from 'node:fs/promises';
import {launchDesignBrowser} from './browser.mjs';
// Penpot's shared viewer requires cached text positionData. Measure the exact
// bundled fonts used in the SVGs; character-count estimates distort native text.
export async function fontMetrics(fontCss){
 let css=fontCss;
 for(const match of [...fontCss.matchAll(/url\('\.\.\/fonts\/([^']+)'\)/g)]){const bytes=await fs.readFile('design/assets/fonts/'+match[1]);const mime=match[1].endsWith('.ttf')?'font/ttf':'font/woff2';css=css.replace(match[0],`url('data:${mime};base64,${bytes.toString('base64')}')`);}
 const browser=await launchDesignBrowser();
 const page=await browser.newPage();await page.setContent(`<style>${css}</style>`);await page.evaluate(async()=>{for(const family of ['sourcesanspro','Noto Sans Devanagari','Noto Sans Gujarati'])for(const weight of [400,600,700])await document.fonts.load(`${weight} 16px "${family}"`);await document.fonts.ready;});
 return {async measure(nodes){const texts=nodes.filter(n=>n.type==='text');return page.evaluate(texts=>{const ctx=document.createElement('canvas').getContext('2d'),out={};for(const n of texts){ctx.font=`${n.weight} ${n.size}px "${n.font}"`;ctx.textBaseline='alphabetic';out[n.id]=n.lines.map(line=>{const m=ctx.measureText(line||' ');return {width:Math.max(.01,m.width),height:m.fontBoundingBoxAscent+m.fontBoundingBoxDescent,baselineOffset:-(m.ideographicBaseline||0)};});}return out;},texts);},async close(){await browser.close();}};
}
