'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),directory=path.join(root,'runtime/python-win32-x64'),executable=path.join(directory,'python.exe');
const probeCode='import sys,json,struct,ssl,urllib.request,hashlib,pathlib,argparse,tempfile\nprint(json.dumps({"version":sys.version.split()[0],"bits":struct.calcsize("P")*8,"isolated":sys.flags.isolated,"utf8":sys.flags.utf8_mode}))';
function error(code,message,extra={}){return Object.assign(Error(message),{code,stage:'attachment-helper-runtime',...extra});}
function checkLibraryRuntime(){
 const base={kind:'bundled-embedded-python',systemPythonUsed:false,separateInstallRequired:false};
 if(process.platform!=='win32'||process.arch!=='x64')return {...base,ready:false,code:'LIBRARY_RUNTIME_PLATFORM_UNSUPPORTED'};
 try{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'runtime/python-runtime.json'),'utf8'));
  for(const item of manifest.files){if(path.basename(item.name)!==item.name)throw Error();const data=fs.readFileSync(path.join(directory,item.name));if(crypto.createHash('sha256').update(data).digest('hex')!==item.sha256)throw Error();}
  const result=cp.spawnSync(executable,['-I','-X','utf8','-c',probeCode],{encoding:'utf8',timeout:15000,maxBuffer:32768,windowsHide:true});
  if(result.error||result.status!==0)return {...base,ready:false,code:'LIBRARY_RUNTIME_START_FAILED',exitCode:result.status};
  const info=JSON.parse(result.stdout);if(info.version!==manifest.pythonVersion||info.bits!==64||info.isolated!==1||info.utf8!==1)throw Error();
  return {...base,ready:true,version:info.version,architecture:'x64',isolated:true,utf8:true,integrityVerified:true};
 }catch{return {...base,ready:false,code:'LIBRARY_RUNTIME_INVALID'};}
}
function absoluteFile(value,label){if(typeof value!=='string'||!path.isAbsolute(value)||/^[\\/]{2}/.test(value))throw error('LIBRARY_HELPER_ARGUMENT_INVALID',label+'는 호스트가 제공한 로컬 절대경로여야 합니다.');return path.resolve(value);}
function decodeTransfer(bytes){if(bytes.length>1024*1024)throw error('LIBRARY_TRANSFER_TOO_LARGE','전달 정보 크기가 제한을 넘었습니다.');const text=bytes[0]===255&&bytes[1]===254?bytes.subarray(2).toString('utf16le'):bytes.toString('utf8').replace(/^\uFEFF/,'');let value;try{value=JSON.parse(text);}catch{throw error('LIBRARY_TRANSFER_INVALID','호스트의 전달 응답 JSON을 읽을 수 없습니다.');}if(!value||typeof value!=='object'||Array.isArray(value))throw error('LIBRARY_TRANSFER_INVALID','호스트의 전달 응답 객체가 필요합니다.');return {text,value};}
function redactedDetails(text,value){
 const secrets=[];function visit(v,key=''){if(typeof v==='string'&&/token|url|authorization|cookie|secret/i.test(key))secrets.push(v);else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v))visit(x,k);}visit(value);
 let out=String(text||'');for(const secret of secrets.filter(Boolean).sort((a,b)=>b.length-a.length))out=out.split(secret).join('[가림]');return out.replace(/https?:\/\/[^\s"'<>]+/gi,'[URL 가림]').replace(/Bearer\s+[^\s"']+/gi,'Bearer [가림]').slice(0,4000);
}
async function runLibraryHelper({helperPath,outputPath,transferBytes,timeoutMs=120000}){
 const runtime=checkLibraryRuntime();if(!runtime.ready)throw error(runtime.code,'포함된 첨부 전달 실행기를 사용할 수 없습니다. 시스템 Python으로 대체하지 않습니다.');
 const helper=absoluteFile(helperPath,'공식 helper 경로'),output=absoluteFile(outputPath,'첨부 전달 대상');
 try{if(!/\.py$/i.test(helper)||!fs.statSync(helper).isFile())throw Error();}catch{throw error('LIBRARY_HELPER_UNAVAILABLE','호스트가 제공한 공식 Library helper 파일이 필요합니다.');}
 if(!/\.(hwp|hwpx)$/i.test(output))throw error('LIBRARY_HELPER_ARGUMENT_INVALID','첨부의 원래 HWP/HWPX 확장명을 사용하세요.');
 if(fs.existsSync(output))throw error('LIBRARY_OUTPUT_EXISTS','기존 원본이나 전달 파일은 덮어쓰지 않습니다.');
 const transfer=decodeTransfer(Buffer.from(transferBytes));
 const result=await new Promise((resolve,reject)=>{
  const child=cp.spawn(executable,['-I','-X','utf8',helper,'materialize',output],{cwd:path.dirname(helper),stdio:['pipe','pipe','pipe'],windowsHide:true,shell:false});
  const stdout=[],stderr=[];let count=0,settled=false;
  const timer=setTimeout(()=>{child.kill();finish(error('LIBRARY_HELPER_TIMEOUT','공식 helper 실행 시간이 초과됐습니다.'));},timeoutMs);
  function finish(err,status){if(settled)return;settled=true;clearTimeout(timer);err?reject(err):resolve({stdout:Buffer.concat(stdout),stderr:Buffer.concat(stderr),status});}
  child.on('error',()=>finish(error('LIBRARY_RUNTIME_START_FAILED','포함된 첨부 전달 실행기 시작에 실패했습니다.')));
  for(const [stream,parts] of [[child.stdout,stdout],[child.stderr,stderr]])stream.on('data',chunk=>{count+=chunk.length;if(count>1024*1024){child.kill();finish(error('LIBRARY_HELPER_OUTPUT_LIMIT','helper 응답 크기가 제한을 넘었습니다.'));}else parts.push(chunk);});
  child.on('close',status=>finish(null,status));child.stdin.on('error',()=>{});child.stdin.end(transfer.text,'utf8');
 });
 if(result.status!==0)throw error('LIBRARY_HELPER_FAILED','공식 Library helper 실행이 실패했습니다.',{exitCode:result.status,details:redactedDetails(result.stderr.toString('utf8')||result.stdout.toString('utf8'),transfer.value)});
 if(!fs.existsSync(output)||!fs.statSync(output).isFile())throw error('LIBRARY_LOCAL_COPY_MISSING','helper는 종료됐지만 원본의 로컬 사본이 확인되지 않습니다. 완료로 처리하지 않습니다.');
 return {...result,runtime};
}
module.exports={checkLibraryRuntime,runLibraryHelper,decodeTransfer,redactedDetails};
