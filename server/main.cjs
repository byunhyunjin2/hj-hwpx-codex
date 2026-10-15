'use strict';
const fs=require('node:fs'),path=require('node:path');
const {createService}=require('./service.cjs');
async function main(){const file=process.argv[2],outputDirectory=process.argv[3];if(!file||!outputDirectory)throw Error('사용법: node main.cjs 문서절대경로 결과폴더절대경로 [계획JSON]');const service=await createService();try{const plan=process.argv[4]?JSON.parse(fs.readFileSync(path.resolve(process.argv[4]),'utf8')):{replacements:[]};const result=await service.open({file,outputDirectory,plan});delete result.previewUrl;console.log(JSON.stringify(result));}finally{service.server.close();}}
main().catch(e=>{console.error(e.message);process.exitCode=1});
