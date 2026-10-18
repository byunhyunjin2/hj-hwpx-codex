'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const core=require('./core.cjs'),engine=require('../lib/engine.cjs'),{summary}=require('./hwp-structure.cjs');
async function main(){
 const [file,scenariosPath,reportPath]=process.argv.slice(2);if(!file||!scenariosPath)throw Error('문서와 시험 계획 JSON 경로를 지정하세요.');
 const scenarios=JSON.parse(fs.readFileSync(scenariosPath,'utf8')),session=await core.openDocument(path.resolve(file),path.dirname(path.resolve(scenariosPath))),results=[];
 for(const scenario of scenarios){
  core.stage(session,scenario.plan);const original=Buffer.from(session.bytes),baseline=await engine.patchHwp(session.bytes,session.revised,{verify:true});
  try{const result=await core.verifiedBytes(session);assert(!scenario.expectedError,'미지원 변경이 허용되었습니다.');assert.equal(result.unchanged,session.edits.length===0);assert(session.bytes.equals(original));
   results.push({id:scenario.id,passed:true,changed:session.changes.reduce((n,c)=>n+c.count,0),held:session.held.reduce((n,c)=>n+c.count,0),paragraphs:result.mapping?.paragraphs,legacySkipped:baseline.skipped.length});
  }catch(error){if(!scenario.expectedError)throw error;assert.equal(error.code,scenario.expectedError);assert(error.location);assert(session.bytes.equals(original));results.push({id:scenario.id,passed:true,blocked:true,code:error.code});}
 }
 core.stage(session,{replacements:[]});const unchanged=await core.verifiedBytes(session);assert(unchanged.data.equals(session.bytes));
 const report={version:require('../plugin.json').version,sourceStructure:summary(session.hwpSourceMap),pages:session.pages,scenarios:results,noDocumentFilesWritten:true,originalBytesUnchanged:true};
 if(reportPath)fs.writeFileSync(path.resolve(reportPath),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
