'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
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
  try{
   const opened=await service.open({attachment:receipt,outputDirectory:temp,plan:{replacements:[{from:'2026',to:'2027',expectedCount:1}]}});
   assert.equal(opened.sourceName,selected.name);assert.equal(opened.attachmentReferenceId,selected.referenceId);assert.equal(opened.format,'hwpx');assert(opened.downloadReady);
   assert.deepEqual(opened.previewTarget,{type:'browser',url:opened.previewUrl});assert.deepEqual(opened.presentation,{kind:'html-review-only',openOriginalAttachment:false});
   const updated=await service.update({sessionId:opened.sessionId,expectedRevision:opened.revision,plan:{replacements:[{from:'2026',to:'2027',expectedCount:1}]}});assert.deepEqual(updated.previewTarget,{type:'browser',url:updated.previewUrl});assert.equal(updated.presentation.openOriginalAttachment,false);
   const html=await (await fetch(opened.previewUrl)).text();assert.match(html,/다운로드 · HWPX/);
   assert.match(fs.readFileSync(opened.previewPath,'utf8'),/검토반영_r\d+\.hwpx/);
  }finally{await new Promise(resolve=>service.server.close(resolve));}
  assert(fs.readFileSync(staged).equals(bytes));
  await assert.rejects(()=>core.openDocument({...receipt,name:'잘못된 확장명.hwp'},temp),e=>e.code==='ATTACHMENT_EXTENSION_MISMATCH');
  assert(!fs.readdirSync(temp).some(n=>/\.(hwp|hwpx)$/i.test(n)));
  console.log('PASS: attachment reference -> host staging receipt -> HWPX modification -> verified original extension; missing staging, source identity, extension mismatch and original preservation');
 }finally{assert(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep));assert(path.basename(temp).startsWith('hjhwpx-workflow-'));fs.rmSync(temp,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
