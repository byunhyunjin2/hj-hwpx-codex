'use strict';
const fs=require('node:fs');
const {checkLibraryRuntime,runLibraryHelper}=require('../server/library-runtime.cjs');
async function main(){
 const args=process.argv.slice(2);if(args.length===1&&args[0]==='--self-test'){const result=checkLibraryRuntime();process.stdout.write(JSON.stringify(result)+'\n');if(!result.ready)process.exitCode=1;return;}
 const values={};for(let i=0;i<args.length;i+=2){if(!['--helper','--output','--transfer-json'].includes(args[i])||!args[i+1]||values[args[i]])throw Error('공식 helper·전달 응답 JSON·출력 경로를 각각 한 번 지정하세요.');values[args[i]]=args[i+1];}
 if(Object.keys(values).length!==3)throw Error('사용법: 포함 node.exe scripts/library-transfer.cjs --helper 공식helper절대경로 --transfer-json 전달응답JSON절대경로 --output 원래확장명의로컬절대경로');
 const result=await runLibraryHelper({helperPath:values['--helper'],outputPath:values['--output'],transferBytes:fs.readFileSync(values['--transfer-json'])});
 // Preserve the official helper's completion/metadata report without reinterpretation.
 process.stdout.write(result.stdout);process.stderr.write(result.stderr);
}
main().catch(e=>{process.stderr.write(JSON.stringify({code:e.code||'LIBRARY_HELPER_ARGUMENT_INVALID',stage:e.stage||'attachment-helper-runtime',message:e.message,exitCode:e.exitCode,details:e.details})+'\n');process.exitCode=1;});
