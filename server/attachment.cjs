'use strict';
const fs=require('node:fs'),path=require('node:path');
const {fileURLToPath}=require('node:url');
function failure(code,message,nextAction){return Object.assign(new Error(message),{code,stage:'attachment',nextAction});}
function resolveAttachment(input){
 if(typeof input!=='string'||!input.trim())throw failure('ATTACHMENT_PATH_REQUIRED','첨부 원본의 로컬 경로가 전달되지 않았습니다.','호스트의 첨부 목록에서 사용자가 지정한 파일의 로컬 경로를 가져오세요. 첨부 누락으로 단정하지 마세요.');
 let file=input;
 if(/^https?:|^(?:libfile_|file_)/i.test(file))throw failure('ATTACHMENT_LOCAL_REQUIRED','이 플러그인은 채팅에 첨부된 로컬 HWP·HWPX만 처리합니다.','호스트가 제공한 해당 첨부의 로컬 경로를 사용하세요. 외부에서 파일을 가져오거나 원본 위치를 다시 묻지 마세요.');
 if(/^[\\/]{2}/.test(file)||/^file:\/\/(?!\/|localhost\/)/i.test(file))throw failure('ATTACHMENT_NETWORK_PATH_REJECTED','네트워크 공유 원본은 지원하지 않습니다.','채팅에 첨부된 로컬 HWP·HWPX만 사용하세요. 네트워크 원본을 탐색하거나 내려받지 마세요.');
 if(/^file:/i.test(file)){try{file=fileURLToPath(file);}catch{throw failure('ATTACHMENT_PATH_INVALID','첨부 파일 주소 형식이 올바르지 않습니다.','호스트가 제공한 원본 로컬 절대경로를 사용하세요.');}}
 if(!path.isAbsolute(file))throw failure('ATTACHMENT_PATH_INVALID','첨부 원본은 로컬 절대경로여야 합니다.','현재 폴더를 추측하지 말고 호스트가 제공한 원본 로컬 절대경로를 사용하세요.');
 const absolute=path.resolve(file);
 try{
  if(!fs.statSync(absolute).isFile())throw failure('ATTACHMENT_NOT_FILE','첨부 경로가 파일이 아닙니다.','사용자가 지정한 HWP/HWPX 원본 파일 경로를 사용하세요.');
  fs.accessSync(absolute,fs.constants.R_OK);
 }catch(error){
  if(error.stage)throw error;
  if(error.code==='ENOENT')throw failure('ATTACHMENT_UNAVAILABLE','현재 실행 환경에서 채팅 첨부파일에 접근할 수 없습니다.','호스트가 전달한 해당 첨부 경로를 확인하고 첨부파일 접근 실패로 보고하세요. 첨부 누락으로 단정하거나 원본 위치를 다시 묻거나 다른 폴더를 탐색하지 마세요.');
  throw failure('ATTACHMENT_ACCESS_DENIED','첨부 원본을 읽을 권한이 없습니다.','현재 실행 환경의 파일 접근 권한을 확인하세요. 보호 기능을 해제하거나 다른 폴더를 탐색하지 마세요.');
 }
 if(!['.hwp','.hwpx'].includes(path.extname(absolute).toLowerCase()))throw failure('ATTACHMENT_FORMAT_UNSUPPORTED','HWP 또는 HWPX 원본을 지정하세요.','지원되는 원본 첨부 파일을 사용하세요. 확장자만 바꾸지 마세요.');
 return absolute;
}
module.exports={resolveAttachment};
