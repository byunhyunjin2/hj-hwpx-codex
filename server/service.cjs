'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const core=require('./core.cjs');
const {resolveChatAttachment}=require('./attachment.cjs');
const {downloadChatFile}=require('./chat-file.cjs');
const {writeSnapshot}=require('./snapshot.cjs');
const storageError=e=>Object.assign(new Error('사용자 임시 폴더에 검토 파일을 준비하지 못했습니다.'),{code:'TEMP_STORAGE_ACCESS_DENIED',stage:'temporary-storage',nextAction:'사용자 임시 폴더의 파일 생성·읽기 권한을 확인하고, 필요한 경우 이 임시 파일 작업에 대한 접근 권한을 요청하세요.',cause:e});
async function createService(){
 const sessions=new Map();let tempRoot=null;
 const ensureRoot=()=>{if(tempRoot&&fs.existsSync(tempRoot))return tempRoot;try{const pluginRoot=path.resolve(__dirname,'..'),candidate=fs.mkdtempSync(path.join(os.tmpdir(),'hj-hwpx-codex-'));if(candidate===pluginRoot||candidate.startsWith(pluginRoot+path.sep)){fs.rmdirSync(candidate);throw Object.assign(Error('OS 임시 폴더가 플러그인 설치 폴더와 겹칩니다.'),{code:'TEMP_STORAGE_INVALID'});}tempRoot=candidate;process.once('exit',cleanupAll);return tempRoot;}catch(e){throw storageError(e);}};
 const cleanupDirectory=directory=>{if(!directory)return;const root=tempRoot&&path.resolve(tempRoot),target=path.resolve(directory);if(!root||!target.startsWith(root+path.sep))throw Object.assign(Error('플러그인 관리 범위 밖의 경로는 정리하지 않습니다.'),{code:'TEMP_CLEANUP_PATH_REJECTED',stage:'temporary-cleanup'});try{fs.rmSync(target,{recursive:true,force:true});}catch(e){throw Object.assign(Error('사용자 임시 폴더의 검토 파일을 삭제할 권한이 없습니다.'),{code:'TEMP_CLEANUP_ACCESS_DENIED',stage:'temporary-cleanup',nextAction:'해당 사용자 임시 폴더의 삭제 권한을 확인하고 필요한 권한을 요청하세요.',cause:e});}};
 const cleanupAll=()=>{if(tempRoot){try{fs.rmSync(tempRoot,{recursive:true,force:true});}catch{}tempRoot=null;}};
 return {sessions,async open(args){
  const supplied=[args.file!==undefined,args.attachment!==undefined,args.chatFile!==undefined].filter(Boolean).length;if(supplied!==1)throw Error('로컬 파일 경로, 첨부 전달 정보 또는 ChatGPT 파일 입력 중 하나만 지정하세요.');
  const selected=args.chatFile??args.attachment??args.file,root=ensureRoot();let sessionDirectory,stagedPath,attached;
  try{
   try{sessionDirectory=fs.mkdtempSync(path.join(root,'session-'));}catch(e){throw storageError(e);}
   if(selected&&typeof selected==='object'&&!selected.localPath&&typeof selected.download_url==='string')attached=await downloadChatFile(selected,sessionDirectory);
   else {attached=resolveChatAttachment(selected);stagedPath=path.join(sessionDirectory,attached.name);try{fs.copyFileSync(attached.file,stagedPath,fs.constants.COPYFILE_EXCL);}catch(e){if(['EACCES','EPERM','EROFS'].includes(e.code))throw storageError(e);throw e;}attached={...attached,localPath:stagedPath};}
   stagedPath=attached.localPath;
   const stagedInput=typeof selected==='object'&&selected!==null?{name:attached.name,referenceId:attached.referenceId,localPath:stagedPath}:stagedPath;
   const session=await core.openDocument(stagedInput,sessionDirectory,args.plan||{replacements:[]});
   try{fs.rmSync(stagedPath,{force:true});}catch(e){throw storageError(e);}
   const snapshot=await writeSnapshot(session);session.tempDirectory=sessionDirectory;sessions.set(session.id,session);
   return {...core.safeSummary(session),...snapshot,presentation:{kind:'html-review-only',openOriginalAttachment:false}};
  }catch(e){cleanupDirectory(sessionDirectory);throw e;}
 },async update(args){const session=sessions.get(args.sessionId);if(!session)throw Error('검토 세션이 없습니다.');if(args.expectedRevision!==session.revision)throw Error('이전 변경안입니다. 최신 revision으로 다시 요청하세요.');core.stage(session,args.plan);const snapshot=await writeSnapshot(session);return {...core.safeSummary(session),...snapshot,presentation:{kind:'html-review-only',openOriginalAttachment:false}};},inspect(args){const session=sessions.get(args.sessionId);if(!session)throw Error('검토 세션이 없습니다.');const offset=args.offset||0,limit=Math.min(args.limit||15,30);return {...core.safeSummary(session),totalBlocks:session.blocks.length,blocks:session.blocks.slice(offset,offset+limit).map(b=>({id:b.id,protected:b.protected,characters:b.text.length,text:b.protected?'[개인정보 영역: 원문을 검토 화면에서 확인]':core.redactedText(b.text).slice(0,400)}))};},close(args){const session=sessions.get(args.sessionId);if(!session)return {closed:true,alreadyClosed:true};cleanupDirectory(session.tempDirectory);sessions.delete(args.sessionId);if(tempRoot&&fs.existsSync(tempRoot)){try{if(fs.readdirSync(tempRoot).length===0){fs.rmdirSync(tempRoot);tempRoot=null;}}catch(e){throw Object.assign(Error('사용자 임시 폴더의 세션 디렉터리를 정리할 권한이 없습니다.'),{code:'TEMP_CLEANUP_ACCESS_DENIED',stage:'temporary-cleanup',nextAction:'해당 사용자 임시 폴더의 삭제 권한을 확인하고 필요한 권한을 요청하세요.',cause:e});}}return {closed:true,temporaryFilesRemoved:true};}};
}
module.exports={createService};

