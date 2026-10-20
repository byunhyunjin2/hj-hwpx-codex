'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const {resolveChatAttachment}=require('./attachment.cjs'),core=require('./core.cjs'),engine=require('../lib/engine.cjs');
const {createService}=require('./service.cjs');
async function main(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hjhwpx-workflow-'));
 try{
  const selected={referenceId:'file_selected_fixture',name:'첨부 운영계획.hwpx'};
  assert.throws(()=>resolveChatAttachment(selected),e=>e.code==='ATTACHMENT_STAGING_REQUIRED'&&e.attachment.referenceId===selected.referenceId&&e.stage==='attachment-transfer');
  assert.throws(()=>resolveChatAttachment({...selected,localPath:path.join(temp,'expired-host-copy.hwp')}),e=>e.code==='ATTACHMENT_STAGING_REQUIRED'&&e.attachment.name===selected.name);
  const zip=new engine.JSZip();
  zip.file('mimetype','application/hwp+zip');
  zip.file('META-INF/container.xml','<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/></rootfiles></container>');
  zip.file('Contents/content.hpf','<opf:package xmlns:opf="http://www.idpf.org/2007/opf/" version="3.0"><opf:manifest><opf:item id="header" href="header.xml" media-type="application/xml"/><opf:item id="section0" href="section0.xml" media-type="application/xml"/></opf:manifest><opf:spine><opf:itemref idref="section0"/></opf:spine></opf:package>');
  zip.file('version.xml','<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" major="5" minor="1" micro="0" buildNumber="1"/>');
  zip.file('Contents/header.xml','<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" version="1.5" secCnt="1"><hh:refList/></hh:head>');
  zip.file('Contents/section0.xml','<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"><hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t>2026학년도 운영계획</hp:t></hp:run></hp:p></hs:sec>');
  const bytes=await zip.generateAsync({type:'nodebuffer'}),staged=path.join(temp,'host-staged-original.bin');fs.writeFileSync(staged,bytes);assert((await engine.validateHwpx(bytes)).ok);
  const receipt={...selected,localPath:staged};assert.equal(resolveChatAttachment(receipt).file,staged);
  assert.throws(()=>resolveChatAttachment({...receipt,name:'../다른 파일.hwpx'}),e=>e.code==='ATTACHMENT_RECEIPT_INVALID');
  const session=await core.openDocument(receipt,temp);
  assert.equal(session.sourceName,selected.name);assert.equal(session.attachmentReferenceId,selected.referenceId);assert.equal(session.format,'hwpx');
  core.stage(session,{replacements:[{from:'2026',to:'2027',expectedCount:1}]});
  const patched=await core.verifiedBytes(session);assert.equal(patched.data.subarray(0,2).toString(),'PK');assert((await engine.parseHwpx(patched.data,{layoutTables:'keep',ocr:false})).markdown.includes('2027'));
  const service=await createService();
  const opened=await service.open({attachment:receipt,outputDirectory:temp,plan:{replacements:[{from:'2026',to:'2027',expectedCount:1}]}});
   assert.equal(opened.sourceName,selected.name);assert.equal(opened.attachmentReferenceId,selected.referenceId);assert.equal(opened.format,'hwpx');assert(opened.downloadReady);
   assert.equal(opened.previewKind,'self-contained-html');assert(!opened.previewUrl);assert(!opened.previewTarget);assert.deepEqual(opened.presentation,{kind:'html-review-only',openOriginalAttachment:false});assert(path.resolve(opened.previewPath).startsWith(path.resolve(os.tmpdir())+path.sep));assert(!path.resolve(opened.previewPath).startsWith(path.resolve(__dirname,'..')+path.sep));
   const updated=await service.update({sessionId:opened.sessionId,expectedRevision:opened.revision,plan:{replacements:[{from:'2026',to:'2027',expectedCount:1}]}});assert.equal(updated.previewKind,'self-contained-html');assert(!updated.previewUrl);assert(!updated.previewTarget);assert.equal(updated.presentation.openOriginalAttachment,false);
   const html=fs.readFileSync(updated.previewPath,'utf8');assert.match(html,/다운로드 · HWPX/);assert.match(html,/iframe/);assert.match(html,/비교보기/);assert.match(html,/함께 스크롤/);assert(!html.includes('fetch('));
   const embedded=JSON.parse(html.match(/const snapshot=(\{.*?\});\s*const bytes/s)[1]);const before=Buffer.from(embedded.before,'base64').toString(),after=Buffer.from(embedded.after,'base64').toString();assert.match(before,/2026/);assert.match(after,/2027/);assert.match(after,/change-mark/);assert(embedded.document);
   assert.match(html,/검토반영_r\d+\.hwpx/);assert.notEqual(opened.previewPath,updated.previewPath);assert(!fs.existsSync(path.join(path.dirname(updated.previewPath),'host-staged-original.bin')));
  const closed=service.close({sessionId:opened.sessionId});assert.equal(closed.temporaryFilesRemoved,true);assert(!fs.existsSync(updated.previewPath));
  const realFetch=global.fetch;global.fetch=async url=>{assert.equal(new URL(url).hostname,'files.oaiusercontent.com');return new Response(bytes,{status:200,headers:{'content-length':String(bytes.length)}});};
  try{const direct=await service.open({chatFile:{download_url:'https://files.oaiusercontent.com/test-fixture',file_id:'file_chat_attachment_fixture',file_name:selected.name},plan:{replacements:[]}});assert.equal(direct.sourceName,selected.name);assert.equal(direct.attachmentReferenceId,'file_chat_attachment_fixture');assert(path.resolve(direct.previewPath).startsWith(path.resolve(os.tmpdir())+path.sep));assert.deepEqual(fs.readdirSync(path.dirname(direct.previewPath)).map(path.extname),['.html']);assert(service.close({sessionId:direct.sessionId}).temporaryFilesRemoved);assert(!fs.existsSync(direct.previewPath));}finally{global.fetch=realFetch;}
  const receiptPath=path.join(temp,'attachment-receipt.json');fs.writeFileSync(receiptPath,JSON.stringify(receipt));
  const cli=cp.spawnSync(path.resolve(__dirname,'../runtime/win32-x64/node.exe'),[path.resolve(__dirname,'main.cjs'),'--attachment',receiptPath,temp],{input:JSON.stringify({id:1,method:'shutdown'})+'\n',encoding:'utf8',windowsHide:true,timeout:30000});
  assert.equal(cli.status,0,cli.stderr);const cliResult=JSON.parse(cli.stdout.trim().split(/\r?\n/)[0]);assert.equal(cliResult.previewKind,'self-contained-html');assert(!cliResult.previewUrl);assert(path.resolve(cliResult.previewPath).startsWith(path.resolve(os.tmpdir())+path.sep));assert(!fs.existsSync(cliResult.previewPath));
  assert(fs.readFileSync(staged).equals(bytes));
  await assert.rejects(()=>core.openDocument({...receipt,name:'잘못된 확장명.hwp'},temp),e=>e.code==='ATTACHMENT_EXTENSION_MISMATCH');
  assert(!fs.readdirSync(temp).some(n=>/\.(hwp|hwpx)$/i.test(n)));
 console.log('PASS: ChatGPT attachment file handoff -> user-temp staging and cleanup; host staging receipt -> HWPX modification -> verified original extension; source identity, extension mismatch and original preservation');
 }finally{assert(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep));assert(path.basename(temp).startsWith('hjhwpx-workflow-'));fs.rmSync(temp,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
