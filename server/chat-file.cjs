'use strict';
const fs=require('node:fs'),path=require('node:path');
const MAX_BYTES=100*1024*1024,ALLOWED_HOST='oaiusercontent.com';
function fail(message,nextAction){return Object.assign(new Error(message),{code:'ATTACHMENT_DOWNLOAD_FAILED',stage:'attachment-transfer',nextAction});}
function checkedUrl(value){let url;try{url=new URL(value);}catch{throw fail('ChatGPT가 전달한 첨부 다운로드 주소를 읽을 수 없습니다.','현재 채팅에 첨부된 파일의 공식 다운로드 참조를 다시 확인하세요.');}if(url.protocol!=='https:'||url.username||url.password||!(url.hostname===ALLOWED_HOST||url.hostname.endsWith('.'+ALLOWED_HOST)))throw fail('ChatGPT 첨부의 공식 HTTPS 다운로드 주소가 아닙니다.','호스트가 제공한 첨부 파일 입력을 확인하세요.');return url;}
function safeName(value){if(typeof value!=='string'||!value||value!==path.basename(value)||/[\\/\r\n]/.test(value)||value.length>240)throw fail('첨부 파일명을 확인할 수 없습니다.','채팅에 첨부한 HWP/HWPX의 파일명을 확인하세요.');return value;}
async function downloadChatFile(file,directory){
 if(!file||typeof file!=='object'||Array.isArray(file)||typeof file.file_id!=='string'||!file.file_id.trim()||file.file_id.length>200||typeof file.download_url!=='string')throw fail('ChatGPT 첨부 파일 참조가 올바르지 않습니다.','같은 첨부 파일의 공식 ChatGPT 파일 참조로 다시 시도하세요.');
 let url=checkedUrl(file.download_url),response;
 try{
  for(let redirects=0;redirects<=4;redirects++){
   response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(30000)});
   if(response.status>=300&&response.status<400){const location=response.headers.get('location');if(!location||redirects===4)throw fail('첨부 파일 다운로드가 허용된 경로로 완료되지 않았습니다.','대학 내부망에서 ChatGPT 첨부 다운로드 도메인에 대한 접근 권한을 확인하세요.');url=checkedUrl(new URL(location,url).href);continue;}
   break;
  }
 }catch(e){if(e.code==='ATTACHMENT_DOWNLOAD_FAILED')throw e;throw fail('ChatGPT 첨부 파일을 사용자 임시 폴더로 가져오지 못했습니다.','대학 내부망에서 ChatGPT 첨부 다운로드 도메인에 대한 접근 권한을 확인하거나 호스트의 로컬 첨부 전달 기능을 사용하세요. 다운로드 주소와 인증정보는 로그에 남기지 않았습니다.');}
 if(!response?.ok)throw fail('ChatGPT 첨부 파일 다운로드에 실패했습니다 (HTTP '+(response?.status||'오류')+').','대학 내부망에서 ChatGPT 첨부 다운로드 도메인에 대한 접근 권한을 확인하거나 호스트의 로컬 첨부 전달 기능을 사용하세요.');
 const declared=Number(response.headers.get('content-length')||0);if(declared>MAX_BYTES)throw fail('문서는 100MB 이하여야 합니다.','100MB 이하의 HWP/HWPX 문서를 첨부하세요.');
 let bytes;try{const chunks=[];let total=0;for await(const chunk of response.body){total+=chunk.length;if(total>MAX_BYTES){await response.body.cancel().catch(()=>{});throw fail('문서는 100MB 이하여야 합니다.','100MB 이하의 HWP/HWPX 문서를 첨부하세요.');}chunks.push(Buffer.from(chunk));}bytes=Buffer.concat(chunks,total);}catch(e){if(e.code==='ATTACHMENT_DOWNLOAD_FAILED')throw e;throw fail('ChatGPT 첨부 데이터를 읽지 못했습니다.','동일 첨부의 공식 파일 전달을 다시 시도하세요.');}
 const format=bytes.subarray(0,2).toString()==='PK'?'hwpx':bytes.subarray(0,8).equals(Buffer.from('d0cf11e0a1b11ae1','hex'))?'hwp':null;if(!format)throw fail('첨부 내용이 HWP 5.x 또는 HWPX 형식이 아닙니다.','HWP/HWPX 원본을 채팅에 직접 첨부하세요.');
 const name=file.file_name?safeName(file.file_name):'첨부문서.'+format;if(path.extname(name).toLowerCase()!=='.'+format)throw Object.assign(fail('첨부 파일명 확장자와 실제 문서 형식이 다릅니다.','원래 HWP/HWPX 파일명과 실제 첨부 형식을 확인하세요. 확장자를 자동으로 바꾸지 않았습니다.'),{code:'ATTACHMENT_EXTENSION_MISMATCH',stage:'attachment'});
 const target=path.join(directory,name);try{fs.writeFileSync(target,bytes,{flag:'wx'});}catch(e){if(['EACCES','EPERM','EROFS'].includes(e.code))throw Object.assign(fail('사용자 임시 폴더에 첨부를 저장할 권한이 없습니다.','사용자 임시 폴더의 파일 생성 권한을 허용하거나 필요한 권한을 요청하세요.'),{code:'TEMP_STORAGE_ACCESS_DENIED',stage:'temporary-storage'});throw fail('사용자 임시 폴더에 첨부 사본을 만들지 못했습니다.','임시 저장 공간의 여유와 접근 권한을 확인하세요.');}
 return {name,referenceId:file.file_id,localPath:target};
}
module.exports={downloadChatFile};
