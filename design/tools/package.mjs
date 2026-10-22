import fs from 'node:fs/promises';
import path from 'node:path';
import {zipSync} from 'fflate';
const root=path.resolve('design/deliverables'),files={};
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else files['fieldwork-client-review/'+path.relative(root,file)]=new Uint8Array(await fs.readFile(file));}}
await walk(root);await fs.mkdir('design/releases',{recursive:true});const output='design/releases/fieldwork-client-review.zip';await fs.writeFile(output,zipSync(files,{level:6}));console.log(output+' · '+Object.keys(files).length+' files · '+((await fs.stat(output)).size/1024/1024).toFixed(1)+' MB');
