'use strict';
const assert=require('node:assert/strict'),net=require('node:net'),http=require('node:http'),cp=require('node:child_process');
const {checkEnvironment}=require('./environment.cjs');
const {createService}=require('./service.cjs');
async function main(){
 const create=net.createServer,connect=net.connect,createHttp=http.createServer,spawn=cp.spawnSync;
 try{
  net.createServer=()=>{throw Object.assign(Error('loopback is denied'),{code:'EACCES'});};
  net.connect=()=>{throw Object.assign(Error('loopback is denied'),{code:'EACCES'});};
  http.createServer=()=>{throw Object.assign(Error('HTTP preview server must not be created'),{code:'EACCES'});};
  const result=await checkEnvironment();assert.equal(result.ready,process.platform==='win32'&&process.arch==='x64');assert.equal(result.previewMode,'self-contained-html');assert(!('loopback' in result));assert(result.attachmentHelperRuntime.ready);
  const service=await createService();assert.equal(service.server,undefined);assert.equal(service.origin,undefined);
 }finally{net.createServer=create;net.connect=connect;http.createServer=createHttp;}
 try{
  cp.spawnSync=()=>({error:{code:'ENOENT'},status:null});
  const result=await checkEnvironment();assert.equal(result.ready,true);assert.equal(result.attachmentHelperRuntime.ready,false);assert.equal(result.attachmentHelperRuntime.systemPythonUsed,false);assert.match(result.nextAction,/로컬 첨부 편집은 가능/);
 }finally{cp.spawnSync=spawn;}
 const health=await checkEnvironment();assert(health.ready);assert(health.attachmentHelperRuntime.ready);
 console.log('PASS: static HTML preview has no loopback dependency, Python-independent editor readiness and bundled Python');
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
