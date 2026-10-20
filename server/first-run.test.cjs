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
  for(const [input,code] of [['','ATTACHMENT_PATH_REQUIRED'],['source.hwp','ATTACHMENT_PATH_INVALID'],['https://example.invalid/private?sig=SECRET','ATTACHMENT_LOCAL_REQUIRED'],['libfile_example','ATTACHMENT_STAGING_REQUIRED'],['\\\\server\\share\\source.hwp','ATTACHMENT_NETWORK_PATH_REJECTED'],['file://server/share/source.hwpx','ATTACHMENT_NETWORK_PATH_REJECTED'],[path.join(temp,'missing.hwp'),'ATTACHMENT_UNAVAILABLE'],[temp,'ATTACHMENT_NOT_FILE']]){
   assert.throws(()=>resolveAttachment(input),e=>e.code===code&&e.stage===(code==='ATTACHMENT_STAGING_REQUIRED'?'attachment-transfer':'attachment')&&!!e.nextAction&&!e.message.includes('SECRET'));
  }
  const denied=fs.accessSync;fs.accessSync=(f,...args)=>{if(f===file)throw Object.assign(Error(),{code:'EACCES'});return denied(f,...args);};
  try{assert.throws(()=>resolveAttachment(file),e=>e.code==='ATTACHMENT_ACCESS_DENIED');}finally{fs.accessSync=denied;}
  const read=fs.readFileSync;fs.readFileSync=(f,...args)=>{assert.notEqual(f,file,'진단은 본문을 읽으면 안 됩니다.');return read(f,...args);};
  let health;try{health=await checkEnvironment({files:[file,path.join(temp,'missing.hwp')]});}finally{fs.readFileSync=read;}
  assert.equal(health.ready,process.platform==='win32'&&process.arch==='x64');assert.deepEqual(health.missing,[]);assert.equal(health.previewMode,'self-contained-html');assert(!('loopback' in health));assert(health.attachmentHelperRuntime.ready);assert.equal(health.attachmentHelperRuntime.systemPythonUsed,false);assert.equal(health.attachmentHelperRuntime.separateInstallRequired,false);
  assert(health.attachments[0].available);assert.equal(health.attachments[1].code,'ATTACHMENT_UNAVAILABLE');assert.equal(health.attachmentContentsRead,false);assert.equal(health.networkDownloadAttempted,false);
  assert.equal(health.hostToolRegistration,'not-verifiable-from-server');
  assert.equal(health.identity.version,require('../plugin.json').version);assert.match(health.identity.installedFilesSha256,/^[a-f0-9]{64}$/);assert.match(health.identity.skillSha256,/^[a-f0-9]{64}$/);assert.equal(health.identity.attachmentPolicy,'same-attachment-host-staging-allowed');assert.equal(health.identity.hostSelectedSkill,'not-verifiable-from-server');assert(!JSON.stringify(health.identity).includes(temp));
  const exists=fs.existsSync;fs.existsSync=f=>String(f).endsWith('node.exe')?false:exists(f);
  try{const incomplete=await checkEnvironment();assert.equal(incomplete.ready,false);assert(incomplete.missing.includes('runtime/win32-x64/node.exe'));}finally{fs.existsSync=exists;}
  const root=path.resolve(__dirname,'..'),canonical=require('../mcp.json').mcpServers.hjhwpx,compat=require('../.mcp.json').mcpServers.hjhwpx;
  const skill=fs.readFileSync(path.join(root,'skills/hjhwpx/SKILL.md'),'utf8');assert.match(skill,/hjhwpx_check_environment\(\{\}\).*실제 호출/);assert.match(skill,/채팅에 첨부된 HWP·HWPX만/);assert.match(skill,/같은 첨부를 편집기로 전달/);assert.match(skill,/ATTACHMENT_STAGING_REQUIRED/);assert.match(skill,/library\.prepare_materialize.*동일 첨부 원본/);
  for(const key of ['command','args','cwd'])assert.deepEqual(compat[key],canonical[key]);
  for(const manifest of [require('../plugin.json'),require('../.codex-plugin/plugin.json')])assert.equal(manifest.extensions['com.openai'].onboardingSkill,undefined);
  assert.deepEqual(fs.readdirSync(path.join(root,'skills')),['hjhwpx']);assert.match(skill,/hjhwpx setup/);assert(fs.existsSync(path.join(root,'skills/hjhwpx/references/setup.md')));
  const requests=[{id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}},{id:2,method:'tools/list'},{id:3,method:'tools/call',params:{name:'hjhwpx_check_environment',arguments:{files:[file]}}},{id:4,method:'tools/call',params:{name:'hjhwpx_open_document',arguments:{file:path.join(temp,'missing.hwp'),outputDirectory:temp}}},{id:5,method:'tools/call',params:{name:'hjhwpx_open_document',arguments:{attachment:{name:'기존 첨부.hwp',referenceId:'file_existing_attachment'},outputDirectory:temp}}},{id:6,method:'tools/call',params:{name:'hjhwpx_open_document',arguments:{file:'libfile_existing',outputDirectory:temp}}}].map(r=>({...r,jsonrpc:'2.0'}));
  const replies=cp.execFileSync(process.execPath,[path.join(root,'server/mcp.cjs')],{input:requests.map(JSON.stringify).join('\n')+'\n',encoding:'utf8',timeout:20000,windowsHide:true}).trim().split('\n').map(JSON.parse);
  assert.equal(replies.length,6);assert.match(replies[0].result.instructions,/원본 첨부를 뷰어로 열지 않습니다/);assert.equal(replies[0].result.serverInfo.version,require('../plugin.json').version);
  assert(replies[1].result.tools.some(t=>t.name==='hjhwpx_check_environment'));
  const openTool=replies[1].result.tools.find(t=>t.name==='hjhwpx_open_document'),openSchema=openTool.inputSchema;assert(openSchema.properties.attachment);assert(openSchema.properties.chatFile);assert.equal(openSchema.oneOf.length,3);assert.deepEqual(openSchema.properties.attachment.required,['name','referenceId']);assert.deepEqual(openTool._meta['openai/fileParams'],['chatFile']);
  assert(JSON.parse(replies[2].result.content[0].text).attachments[0].available);
  assert.equal(replies[3].result.isError,true);assert.equal(JSON.parse(replies[3].result.content[0].text).code,'ATTACHMENT_UNAVAILABLE');
  assert.equal(JSON.parse(replies[4].result.content[0].text).code,'ATTACHMENT_STAGING_REQUIRED');assert.equal(JSON.parse(replies[4].result.content[0].text).attachment.referenceId,'file_existing_attachment');assert.equal(JSON.parse(replies[5].result.content[0].text).attachment.referenceId,'libfile_existing');
  const receiptFile=path.join(temp,'pending-attachment.json');fs.writeFileSync(receiptFile,JSON.stringify({name:'현재 첨부.hwp',referenceId:'file_cli_attachment'}));
  const cli=cp.spawnSync(process.execPath,[path.join(root,'server/main.cjs'),'--attachment',receiptFile,temp],{encoding:'utf8',timeout:15000,windowsHide:true});
  assert.equal(cli.status,1);const cliError=JSON.parse(cli.stderr.trim());assert.equal(cliError.code,'ATTACHMENT_STAGING_REQUIRED');assert.equal(cliError.attachment.referenceId,'file_cli_attachment');
  console.log('PASS: first-run paths, independent HTML preview diagnostics, missing/denied/remote attachments, onboarding, portable/compat launch parity, MCP/CLI staging identity and structured recovery');
 }finally{assert(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep));assert(path.basename(temp).startsWith('hjhwpx-first-run-'));fs.rmSync(temp,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
