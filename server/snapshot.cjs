'use strict';
const fs=require('node:fs'),path=require('node:path');
const core=require('./core.cjs'),ui=require('./ui.cjs');
async function writeSnapshot(session){
 const revision=session.revision;
 let candidate=null,error=null,diagnostic=null;
 try{candidate=await core.verifiedBytes(session);}catch(e){error=e.message;diagnostic={code:e.code||'SAVE_VERIFICATION_FAILED',location:e.location};}
 if(revision!==session.revision)throw Error('미리보기 생성 중 변경안이 갱신되었습니다.');
 const stem=path.basename(session.sourceName,path.extname(session.sourceName));
 const assets=[],assetIds=new Map();
 const compact=html=>html.replace(/data:image\/[^"'\s<>]+/g,url=>{let id=assetIds.get(url);if(id===undefined){id=assets.length;assetIds.set(url,id);assets.push(url);}return 'hjasset:'+id;});
 const before=compact(session.before),after=compact(session.after);
 const payload={assets,before:Buffer.from(before).toString('base64'),after:Buffer.from(after).toString('base64'),document:candidate?Buffer.from(candidate.data).toString('base64'):null,name:stem+'_검토반영_r'+revision+'.'+session.format,error,diagnostic,revision};
 const html=ui(session,'',payload);
 fs.mkdirSync(session.outputDirectory,{recursive:true});
 const previewPath=path.join(session.outputDirectory,stem+'_비교미리보기_'+session.id.slice(0,8)+'_r'+revision+'.html');
 fs.writeFileSync(previewPath,html,{flag:'wx'});
 return {previewPath,previewKind:'self-contained-html',downloadReady:!!candidate,downloadError:error,documentSaved:false};
}
module.exports={writeSnapshot};
