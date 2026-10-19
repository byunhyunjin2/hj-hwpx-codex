'use strict';
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {resolveAttachment}=require('./attachment.cjs');
const {packageIdentity}=require('./identity.cjs');
const root=path.resolve(__dirname,'..');
async function checkEnvironment({files=[]}={}){
 if(!Array.isArray(files)||files.length>10||files.some(f=>typeof f!=='string'))throw Error('files는 호스트가 제공한 파일 경로 10개 이하로 지정하세요.');
 const required=['runtime/win32-x64/node.exe','lib/engine.cjs','lib/preview-renderer.cjs','server/main.cjs','server/mcp.cjs','skills/hjhwpx/SKILL.md'];
 const missing=required.filter(f=>!fs.existsSync(path.join(root,f)));
 const attachments=files.map(file=>{try{resolveAttachment(file);return {available:true};}catch(e){return {available:false,code:e.code,stage:e.stage,message:e.message,nextAction:e.nextAction};}});
 const loopback=await new Promise(resolve=>{
  const server=net.createServer(socket=>socket.end());let client,done=false;
  const finish=(error)=>{
   if(done)return;done=true;clearTimeout(timer);client?.destroy();
   const result=error?{available:false,code:error.code||'LOOPBACK_UNREACHABLE',nextAction:'로컬 미리보기 접속이 거부되었습니다. 앱·관리자 정책을 확인하세요. 보안 설정은 변경하지 마세요.'}:{available:true};
   if(server.listening)server.close(()=>resolve(result));else resolve(result);
  };
  const timer=setTimeout(()=>finish({code:'LOOPBACK_TIMEOUT'}),3000);
  server.once('error',finish);
  server.listen(0,'127.0.0.1',()=>{
   client=net.connect({host:'127.0.0.1',port:server.address().port});
   client.once('connect',()=>finish());client.once('error',finish);
  });
 });
 const ready=process.platform==='win32'&&process.arch==='x64'&&!missing.length&&loopback.available;
 return {version:require('../plugin.json').version,identity:packageIdentity(),platform:process.platform,arch:process.arch,ready,missing,loopback,attachments,attachmentContentsRead:false,networkDownloadAttempted:false,hostToolRegistration:'not-verifiable-from-server',fallbackEntry:'server/main.cjs',nextAction:ready?'첨부가 있으면 현재 수정 작업을 계속하고 previewUrl을 내부 브라우저로 여세요.':'Windows x64 로컬 실행과 패키지 파일 및 로컬 포트 상태를 확인하세요.'};
}
module.exports={checkEnvironment};
