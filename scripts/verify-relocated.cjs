'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {JSZip}=require('../lib/engine.cjs');
async function main(){
 const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'hjhwpx-relocated-'));
 try{
  const archive=process.argv[2]?path.resolve(process.argv[2]):path.join(temp,'candidate.zip'),dest=path.join(temp,'별도 설치 공백 경로');
  if(!process.argv[2])cp.execFileSync(process.execPath,[path.join(root,'scripts/package.cjs'),archive],{windowsHide:true});
  const zip=await JSZip.loadAsync(fs.readFileSync(archive));
  assert.deepEqual(Object.keys(zip.files).filter(n=>/^skills\/[^/]+\/SKILL\.md$/.test(n)),['skills/hjhwpx/SKILL.md']);
  assert(zip.file('skills/hjhwpx/references/setup.md'));assert(!zip.file('skills/setup/SKILL.md'));
  for(const [name,entry] of Object.entries(zip.files)){
   const target=path.resolve(dest,name);assert(target.startsWith(dest+path.sep));
   if(entry.dir){fs.mkdirSync(target,{recursive:true});continue;}
   fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,await entry.async('nodebuffer'));
  }
  const env={...process.env,PATH:'',NODE_PATH:'',NODE_OPTIONS:'',PYTHONHOME:path.join(temp,'missing-python'),PYTHONPATH:path.join(temp,'missing-modules')};
  const node=path.join(dest,'runtime/win32-x64/node.exe');
  const health=JSON.parse(cp.execFileSync(node,[path.join(dest,'scripts/check-environment.cjs')],{env,encoding:'utf8',windowsHide:true}));
  assert(health.ready);assert(health.attachmentHelperRuntime.ready);assert.equal(health.attachmentHelperRuntime.systemPythonUsed,false);
  // Test fixtures remain outside the archive; resolve their imports against the extracted package.
  for(const file of ['attachment-workflow.test.cjs','library-runtime.test.cjs','mcp-view.test.cjs']){
   const test=path.join(dest,'server',file);fs.copyFileSync(path.join(root,'server',file),test);
   process.stdout.write(cp.execFileSync(node,[test],{env,encoding:'utf8',windowsHide:true,timeout:60000}));
  }
  console.log('PASS: candidate ZIP contents, single hjhwpx command, relocated bundled runtimes, empty PATH, HWPX edit/preview and Library contract');
 }finally{
  assert(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep));assert(path.basename(temp).startsWith('hjhwpx-relocated-'));fs.rmSync(temp,{recursive:true,force:true});
 }
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
