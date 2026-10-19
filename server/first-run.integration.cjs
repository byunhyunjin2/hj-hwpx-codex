'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),readline=require('node:readline'),crypto=require('node:crypto');
async function main(){
 const [file,out,pluginRoot=path.resolve(__dirname,'..')]=process.argv.slice(2);if(!file||!out)throw Error('원본 첨부와 시험 결과 폴더를 지정하세요.');
 fs.mkdirSync(out,{recursive:true});
 const root=path.resolve(pluginRoot),runtime=path.join(root,'runtime/win32-x64/node.exe');
 const originalHash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 const receiptPath=process.env.HJHWPX_TEST_RECEIPT,receipt=receiptPath?JSON.parse(fs.readFileSync(receiptPath,'utf8')):null;
 const child=cp.spawn(runtime,[path.join(root,'server/main.cjs'),...(receiptPath?['--attachment',receiptPath,out]:[file,out])],{cwd:os.tmpdir(),env:{...process.env,PATH:'',NODE_PATH:'',NODE_OPTIONS:''},stdio:['pipe','pipe','pipe'],windowsHide:true});
 const replies=[],pending=[];let stderr='',closed=false;
 child.stderr.on('data',b=>{stderr+=b;});
 const lines=readline.createInterface({input:child.stdout});lines.on('line',line=>{try{const r=JSON.parse(line);const p=pending.shift();p?p.resolve(r):replies.push(r);}catch(e){pending.shift()?.reject(e);}});
 child.on('exit',()=>{closed=true;for(const p of pending.splice(0))p.reject(Error('실행기 종료: '+stderr));});
 const next=()=>replies.length?Promise.resolve(replies.shift()):new Promise((resolve,reject)=>{if(closed)return reject(Error(stderr));const timer=setTimeout(()=>reject(Error('준비 시간 초과: '+stderr)),45000);pending.push({resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});});
 const send=async r=>{child.stdin.write(JSON.stringify(r)+'\n');return next();};
 try{
  const opened=await next();assert.match(opened.previewUrl,/^http:\/\/127\.0\.0\.1:\d+\/review\/[a-f0-9]+\/$/);assert(opened.downloadReady);assert(!opened.documentSaved);
  if(receipt){assert.equal(opened.sourceName,receipt.name);assert.equal(opened.attachmentReferenceId,receipt.referenceId);}
  assert.equal('.'+opened.format,path.extname(receipt?.name||file).toLowerCase());
  const inspected=await send({id:1,method:'inspect',offset:0,limit:7});assert(inspected.result.blocks.length>0);
  const fullPlan=process.env.HJHWPX_TEST_PLAN?JSON.parse(fs.readFileSync(process.env.HJHWPX_TEST_PLAN,'utf8')):{replacements:[{from:'2026학년도',to:'2027학년도',expectedCount:3}]};
  const updated=await send({id:2,method:'update',expectedRevision:opened.revision,plan:fullPlan});
  assert(!updated.error,JSON.stringify(updated.error));assert.equal(updated.result.changedCount,+(process.env.HJHWPX_EXPECT_CHANGES||3));assert(updated.result.downloadReady);
  const stale=await send({id:3,method:'update',expectedRevision:opened.revision,plan:{replacements:[]}});assert(stale.error);
  const forbidden=await send({id:4,method:'export'});assert(forbidden.error);
  const response=await fetch(opened.previewUrl);assert.equal(response.status,200);const html=await response.text();assert.match(html,/iframe/);assert.match(html,/다운로드/);
  const after=await (await fetch(opened.previewUrl+'after')).text();assert.match(after,/2027/);assert.match(after,/change-mark/);
  const before=await (await fetch(opened.previewUrl+'before')).text();assert.match(before,/2026/);
  const rejected=await fetch(opened.previewUrl+'export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:updated.result.revision})});assert.equal(rejected.status,403);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),originalHash);
  assert(!fs.readdirSync(out).some(f=>/\.(hwp|hwpx)$/i.test(f)));
  const report={version:require(path.join(root,'plugin.json')).version,passed:true,isolatedLaunch:{cwdOutsidePlugin:true,systemNodeNotUsed:true,emptyPath:true},sourcePages:opened.pageCount,changedCount:updated.result.changedCount,attachmentReceiptUsed:!!receipt,originalExtensionRetained:true,httpPreview:true,sameMemorySession:true,staleRevisionBlocked:true,agentExportBlocked:true,unauthorizedDownloadBlocked:true,sourceHashUnchanged:true,noDocumentFileWritten:true,previewUrl:opened.previewUrl};
  fs.writeFileSync(path.join(out,'integration-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  if(process.env.HJHWPX_KEEP_PREVIEW==='1'){
   console.log('미리보기 확인용 서버 유지 중');
   process.on('SIGINT',()=>{child.stdin.write(JSON.stringify({method:'shutdown'})+'\n');child.stdin.end();});
   return;
  }
  await send({id:5,method:'shutdown'});child.stdin.end();
 }catch(e){child.kill();throw e;}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
