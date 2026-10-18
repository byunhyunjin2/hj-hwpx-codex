'use strict';
const fs=require('node:fs'),path=require('node:path');
const core=require('./core.cjs'),{writeSnapshot}=require('./snapshot.cjs');
async function main(){const file=process.argv[2],output=process.argv[3];if(!file||!output)throw Error('사용법: node preview.cjs 문서절대경로 결과폴더절대경로 [계획JSON]');const plan=process.argv[4]?JSON.parse(fs.readFileSync(path.resolve(process.argv[4]),'utf8')):{replacements:[]};const session=await core.openDocument(file,output,plan);console.log(JSON.stringify({...core.safeSummary(session),...await writeSnapshot(session)}));}
main().catch(e=>{console.error(e.message);process.exitCode=1});
