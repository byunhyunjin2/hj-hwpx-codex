'use strict';
const assert=require('node:assert/strict'),net=require('node:net'),http=require('node:http'),cp=require('node:child_process');
const {EventEmitter}=require('node:events');
const {checkEnvironment}=require('./environment.cjs');
const {createService}=require('./service.cjs');
async function main(){
 const create=net.createServer,connect=net.connect,spawn=cp.spawnSync;
 try{
  for(const stage of ['listen','connect']){
   net.createServer=()=>{
    const server=new EventEmitter();server.listening=false;
    server.listen=(_port,_host,callback)=>{process.nextTick(()=>{if(stage==='listen')server.emit('error',Object.assign(Error(),{code:'EACCES',syscall:'listen'}));else{server.listening=true;callback();}});};
    server.address=()=>({port:12345});server.close=callback=>callback();return server;
   };
   net.connect=()=>{const client=new EventEmitter();client.destroy=()=>{};process.nextTick(()=>client.emit('error',Object.assign(Error(),{code:'EPERM',syscall:'connect'})));return client;};
   const result=await checkEnvironment();assert.equal(result.ready,false);assert.equal(result.loopback.stage,stage);assert.equal(result.loopback.syscall,stage);assert.equal(result.loopback.code,stage==='listen'?'EACCES':'EPERM');assert(result.attachmentHelperRuntime.ready);assert.match(result.loopback.nextAction,/정식 권한 승인/);
  }
 }finally{net.createServer=create;net.connect=connect;}
 try{
  cp.spawnSync=()=>({error:{code:'ENOENT'},status:null});
  const result=await checkEnvironment();assert.equal(result.ready,true);assert.equal(result.attachmentHelperRuntime.ready,false);assert.equal(result.attachmentHelperRuntime.systemPythonUsed,false);assert.match(result.nextAction,/로컬 첨부 편집은 가능/);
 }finally{cp.spawnSync=spawn;}
 const createHttp=http.createServer;
 try{
  http.createServer=()=>{const server=new EventEmitter();server.listen=()=>process.nextTick(()=>server.emit('error',Object.assign(Error(),{code:'EACCES'})));return server;};
  await assert.rejects(createService,e=>e.code==='EACCES'&&e.stage==='preview-listen'&&/정식 승인/.test(e.nextAction));
 }finally{http.createServer=createHttp;}
 const health=await checkEnvironment();assert(health.ready);assert(health.attachmentHelperRuntime.ready);
 console.log('PASS: listen/connect denial classification, official approval guidance, Python-independent editor readiness, service error stage, real loopback and bundled Python');
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
