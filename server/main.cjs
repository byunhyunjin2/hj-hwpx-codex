'use strict';
const fs=require('node:fs'),path=require('node:path');
const {createService}=require('./service.cjs');
async function main(){const file=process.argv[2],outputDirectory=process.argv[3];if(!file||!outputDirectory)throw Error('사용법: node main.cjs 문서절대경로 결과폴더절대경로 [계획JSON]');const service=await createService();try{const plan=process.argv[4]?JSON.parse(fs.readFileSync(path.resolve(process.argv[4]),'utf8')):{replacements:[]};console.log(JSON.stringify(await service.open({file,outputDirectory,plan})));}catch(e){service.server.close();throw e;}}
main().catch(e=>{console.error(e.message);process.exitCode=1});
