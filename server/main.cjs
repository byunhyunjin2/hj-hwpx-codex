'use strict';
const fs=require('node:fs'),readline=require('node:readline');
const {createService}=require('./service.cjs');
async function main(){
 const receiptMode=process.argv[2]==='--attachment',file=receiptMode?JSON.parse(fs.readFileSync(process.argv[3],'utf8')):process.argv[2],outputDirectory=process.argv[receiptMode?4:3],planPath=process.argv[receiptMode?5:4];if(!file||!outputDirectory)throw Error('사용법: node main.cjs 문서절대경로 결과폴더절대경로 [계획JSON] 또는 main.cjs --attachment 첨부전달정보JSON 결과폴더 [계획JSON]');
 const service=await createService();
 try{
  const plan=planPath?JSON.parse(fs.readFileSync(planPath,'utf8')):{replacements:[]};
  const opened=await service.open({file,outputDirectory,plan});console.log(JSON.stringify(opened));
  // Inspect/update the same in-memory source when the host has no registered MCP tools.
  let queue=Promise.resolve();const input=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
  input.on('line',line=>{queue=queue.then(async()=>{
   let request;
   try{
    if(Buffer.byteLength(line)>1024*1024)throw Error('명령 입력 제한 초과');
    request=JSON.parse(line);let result;
    if(request.method==='inspect')result=service.inspect({sessionId:opened.sessionId,offset:request.offset,limit:request.limit});
    else if(request.method==='update')result=await service.update({sessionId:opened.sessionId,expectedRevision:request.expectedRevision,plan:request.plan});
    else if(request.method==='shutdown'){input.close();service.server.close();result={closed:true};}
    else throw Error('지원되는 명령은 inspect, update, shutdown입니다.');
    console.log(JSON.stringify({id:request.id,result}));
   }catch(e){console.log(JSON.stringify({id:request?.id,error:{code:e.code||'REVIEW_FAILED',stage:e.stage||'review',message:e.message,nextAction:e.nextAction}}));}
  });});
 }catch(e){service.server.close();throw e;}
}
main().catch(e=>{console.error(JSON.stringify({code:e.code||'PREVIEW_START_FAILED',stage:e.stage||'preview',message:e.message,attachment:e.attachment,nextAction:e.nextAction||'로컬 실행·포트와 변경 계획을 확인하세요.'}));process.exitCode=1});
