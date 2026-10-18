'use strict';
// Development only: install kordoc@4.22.11 and esbuild@0.28.1 locally first.
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
async function main(){
 const root=path.resolve(__dirname,'..'),vendorEntry=require.resolve('kordoc'),vendorRequire=createRequire(vendorEntry),vendorDir=path.dirname(vendorEntry),target=path.join(root,'.renderer-build');
 if(require('kordoc').VERSION!=='4.22.11')throw Error('Build requires kordoc 4.22.11.');
 for(const file of fs.readdirSync(vendorDir).filter(f=>f.endsWith('.map'))){const map=JSON.parse(fs.readFileSync(path.join(vendorDir,file),'utf8'));map.sources.forEach((source,i)=>{if(!source.startsWith('../src/')||!map.sourcesContent?.[i])return;const relative=source.slice(3);if(relative.includes('..'))throw Error('Unsafe source path');const output=path.join(target,relative);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,map.sourcesContent[i]);});}
 for(const file of ['hwp5-scene.ts','object-anchor.ts','para-model.ts','reflow-tables.ts'])fs.copyFileSync(path.join(root,'renderer-fix',file),path.join(target,'src/render',file));
 const parser=path.join(target,'src/hwp5/parser.ts');fs.writeFileSync(parser,fs.readFileSync(parser,'utf8').replace('import { createRequire } from "module"\nconst require = createRequire(import.meta.url)\nconst CFB: CfbModule = require("cfb")','import CFB from "cfb"'));
 const entry=path.join(target,'preview-entry.ts');fs.writeFileSync(entry,"import {renderHwp5Pages} from './src/render/hwp5-scene.js';\nimport {renderSceneToHtml} from './src/render/html.js';\nexport const scene=(bytes:Uint8Array)=>renderHwp5Pages(bytes,{reflow:true});\nexport async function render(bytes:Uint8Array){const result=scene(bytes);return {html:renderSceneToHtml(result.scene,result.pageSvgs,{title:'hj-hwpx-codex'}),pages:result.scene.pages.length,warnings:result.scene.warnings.map(w=>w.message)}}\nexport {hwp5CellAnchorUnpushed,hwp5PictureViewport} from './src/render/hwp5-scene.js';\n");
 await require('esbuild').build({entryPoints:[entry],bundle:true,platform:'node',format:'cjs',minify:true,alias:{jszip:vendorRequire.resolve('jszip'),'@xmldom/xmldom':vendorRequire.resolve('@xmldom/xmldom'),cfb:vendorRequire.resolve('cfb')},outfile:path.join(root,'lib/preview-renderer.cjs')});
 console.log('Preview renderer built. Runtime requires no node_modules.');
}main().catch(e=>{console.error(e.message);process.exitCode=1;});
