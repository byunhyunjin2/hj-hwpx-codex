'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const {pathToFileURL}=require('node:url');
const {resolveAttachment}=require('./attachment.cjs');
const {checkEnvironment}=require('./environment.cjs');
async function main(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hjhwpx-first-run-'));
 try{
  const file=path.join(temp,'한글 공백 (첨부).hwp');fs.writeFileSync(file,Buffer.from('test-only'));
  assert.equal(resolveAttachment(file),file);
  assert.equal(resolveAttachment(pathToFileURL(file).href),file);
  for(const [input,code] of [['','ATTACHMENT_PATH_REQUIRED'],['source.hwp','ATTACHMENT_PATH_INVALID'],['https://example.invalid/private?sig=SECRET','ATTACHMENT_LOCAL_REQUIRED'],['libfile_example','ATTACHMENT_LOCAL_REQUIRED'],['\\\\server\\share\\source.hwp','ATTACHMENT_NETWORK_PATH_REJECTED'],['file://server/share/source.hwpx','ATTACHMENT_NETWORK_PATH_REJECTED'],[path.join(temp,'missing.hwp'),'ATTACHMENT_UNAVAILABLE'],[temp,'ATTACHMENT_NOT_FILE']]){
   assert.throws(()=>resolveAttachment(input),e=>e.code===code&&e.stage==='attachment'&&!!e.nextAction&&!e.message.includes('SECRET'));
  }
  const denied=fs.accessSync;fs.accessSync=(f,...args)=>{if(f===file)throw Object.assign(Error(),{code:'EACCES'});return denied(f,...args);};
  try{assert.throws(()=>resolveAttachment(file),e=>e.code==='ATTACHMENT_ACCESS_DENIED');}finally{fs.accessSync=denied;}
  const read=fs.readFileSync;fs.readFileSync=(f,...args)=>{assert.notEqual(f,file,'진단은 본문을 읽으면 안 됩니다.');return read(f,...args);};
  let health;try{health=await checkEnvironment({files:[file,path.join(temp,'missing.hwp')]});}finally{fs.readFileSync=read;}
  assert.equal(health.ready,process.platform==='win32'&&process.arch==='x64');assert.deepEqual(health.missing,[]);assert(health.loopback.available);
  assert(health.attachments[0].available);assert.equal(health.attachments[1].code,'ATTACHMENT_UNAVAILABLE');assert.equal(health.attachmentContentsRead,false);assert.equal(health.networkDownloadAttempted,false);
  assert.equal(health.hostToolRegistration,'not-verifiable-from-server');
  const exists=fs.existsSync;fs.existsSync=f=>String(f).endsWith('node.exe')?false:exists(f);
  try{const incomplete=await checkEnvironment();assert.equal(incomplete.ready,false);assert(incomplete.missing.includes('runtime/win32-x64/node.exe'));}finally{fs.existsSync=exists;}
  const root=path.resolve(__dirname,'..'),canonical=require('../mcp.json').mcpServers.hjhwpx,compat=require('../.mcp.json').mcpServers.hjhwpx;
  const skill=fs.readFileSync(path.join(root,'skills/hjhwpx/SKILL.md'),'utf8');assert.match(skill,/hjhwpx_check_environment\(\{\}\).*실제 호출/);assert.match(skill,/채팅에 첨부된 HWP·HWPX만/);assert.match(skill,/온라인 원본 가져오기.*네트워크 공유 원본 읽기.*수행하지 않는다/);
  for(const key of ['command','args','cwd'])assert.deepEqual(compat[key],canonical[key]);
  for(const manifest of [require('../plugin.json'),require('../.codex-plugin/plugin.json')])assert(fs.existsSync(path.join(root,manifest.extensions['com.openai'].onboardingSkill)));
  const requests=[{id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}},{id:2,method:'tools/list'},{id:3,method:'tools/call',params:{name:'hjhwpx_check_environment',arguments:{files:[file]}}},{id:4,method:'tools/call',params:{name:'hjhwpx_open_document',arguments:{file:path.join(temp,'missing.hwp'),outputDirectory:temp}}}].map(r=>({...r,jsonrpc:'2.0'}));
  const replies=cp.execFileSync(process.execPath,[path.join(root,'server/mcp.cjs')],{input:requests.map(JSON.stringify).join('\n')+'\n',encoding:'utf8',timeout:20000,windowsHide:true}).trim().split('\n').map(JSON.parse);
  assert.equal(replies.length,4);assert.equal(replies[0].result.serverInfo.version,require('../plugin.json').version);
  assert(replies[1].result.tools.some(t=>t.name==='hjhwpx_check_environment'));
  assert(JSON.parse(replies[2].result.content[0].text).attachments[0].available);
  assert.equal(replies[3].result.isError,true);assert.equal(JSON.parse(replies[3].result.content[0].text).code,'ATTACHMENT_UNAVAILABLE');
  console.log('PASS: first-run paths, file URLs, missing/denied/remote attachments, content-free diagnostics, onboarding, portable/compat launch parity, MCP diagnostics and structured recovery');
 }finally{assert(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep));assert(path.basename(temp).startsWith('hjhwpx-first-run-'));fs.rmSync(temp,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
