'use strict';
const fs=require('node:fs'),path=require('node:path');
const {resolveAttachment}=require('./attachment.cjs');
const {packageIdentity}=require('./identity.cjs');
const {checkLibraryRuntime}=require('./library-runtime.cjs');
const root=path.resolve(__dirname,'..');
async function checkEnvironment({files=[]}={}){
 if(!Array.isArray(files)||files.length>10||files.some(f=>typeof f!=='string'))throw Error('files는 호스트가 제공한 파일 경로 10개 이하로 지정하세요.');
 const required=['runtime/win32-x64/node.exe','lib/engine.cjs','lib/preview-renderer.cjs','server/main.cjs','server/mcp.cjs','skills/hjhwpx/SKILL.md','runtime/python-runtime.json','runtime/python-win32-x64/python.exe','scripts/library-transfer.cjs'];
 const missing=required.filter(f=>!fs.existsSync(path.join(root,f)));
 const attachments=files.map(file=>{try{resolveAttachment(file);return {available:true};}catch(e){return {available:false,code:e.code,stage:e.stage,message:e.message,nextAction:e.nextAction};}});
 const attachmentHelperRuntime=checkLibraryRuntime();
 const editorMissing=missing.filter(f=>!f.startsWith('runtime/python')&&f!=='scripts/library-transfer.cjs');
 const ready=process.platform==='win32'&&process.arch==='x64'&&!editorMissing.length;
 return {version:require('../plugin.json').version,identity:packageIdentity(),platform:process.platform,arch:process.arch,ready,missing,attachmentHelperRuntime,libraryHelperSource:'host-provided-not-verified-by-environment-check',attachments,attachmentContentsRead:false,networkDownloadAttempted:false,hostToolRegistration:'not-verifiable-from-server',previewMode:'self-contained-html',fallbackEntry:'server/main.cjs',nextAction:ready?(attachmentHelperRuntime.ready?'첨부가 있으면 현재 수정 작업을 계속하고 생성된 previewPath의 독립 HTML을 내부 브라우저로 여세요. 로컬 포트 권한은 필요하지 않습니다.':'로컬 첨부 편집은 가능합니다. 공식 Library helper가 필요한 첨부 전달은 포함 Python 오류를 먼저 해결해야 합니다.'):'Windows x64 로컬 실행기와 패키지 파일을 확인하세요.'};
}
module.exports={checkEnvironment};
