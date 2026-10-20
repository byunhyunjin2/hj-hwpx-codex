'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),readline=require('node:readline'),vm=require('node:vm');
const {JSZip}=require('../lib/engine.cjs'),view=require('./mcp-view.cjs');
async function fixture(){
 const zip=new JSZip();zip.file('mimetype','application/hwp+zip');
 zip.file('META-INF/container.xml','<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/></rootfiles></container>');
 zip.file('Contents/content.hpf','<opf:package xmlns:opf="http://www.idpf.org/2007/opf/" version="3.0"><opf:manifest><opf:item id="header" href="header.xml" media-type="application/xml"/><opf:item id="section0" href="section0.xml" media-type="application/xml"/></opf:manifest><opf:spine><opf:itemref idref="section0"/></opf:spine></opf:package>');
 zip.file('version.xml','<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" major="5" minor="1" micro="0" buildNumber="1"/>');
 zip.file('Contents/header.xml','<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" version="1.5" secCnt="1"><hh:refList/></hh:head>');
 zip.file('Contents/section0.xml','<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"><hp:p id="0" paraPrIDRef="0" styleIDRef="0"><hp:run charPrIDRef="0"><hp:t>2026학년도 운영계획</hp:t></hp:run></hp:p></hs:sec>');
 return zip.generateAsync({type:'nodebuffer'});
}
function client(){
 const child=cp.spawn(process.execPath,[path.join(__dirname,'mcp.cjs')],{windowsHide:true,stdio:['pipe','pipe','pipe']});let id=0;const pending=new Map();let stderr='';child.stderr.on('data',b=>stderr+=b);
 readline.createInterface({input:child.stdout}).on('line',line=>{const m=JSON.parse(line),p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);p.resolve(m);}});
 child.on('exit',()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(stderr||'MCP process exited'));}pending.clear();});
 return {child,async request(method,params={}){const key=++id;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(key);reject(Error('MCP timeout'));},20000);pending.set(key,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:key,method,params})+'\n');});},async stop(){child.stdin.end();await new Promise(resolve=>child.once('exit',resolve));}};
}
async function main(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hjhwpx-mcp-view-')),c=client();
 try{
  const bytes=await fixture(),file=path.join(temp,'시험 첨부.hwpx');fs.writeFileSync(file,bytes);
  let result=await c.request('initialize',{protocolVersion:'2025-06-18',capabilities:{extensions:{'io.modelcontextprotocol/ui':{mimeTypes:[view.MIME]}}}});assert(result.result.capabilities.resources);
  const listed=(await c.request('tools/list')).result.tools;
  for(const name of ['hjhwpx_open_document','hjhwpx_update_review'])assert.equal(listed.find(t=>t.name===name)._meta.ui.resourceUri,view.URI);
  assert(!listed.find(t=>t.name==='hjhwpx_inspect_review')._meta);
  assert.equal((await c.request('resources/list')).result.resources[0].uri,view.URI);
  const resource=(await c.request('resources/read',{uri:view.URI})).result.contents[0];
  assert.equal(resource.mimeType,view.MIME);assert(!resource.text.includes('<iframe'));assert(!resource.text.includes('2026학년도'));new vm.Script(resource.text.match(/<script>([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(resource._meta.ui.csp,{connectDomains:[],resourceDomains:[],frameDomains:[]});
  assert.equal((await c.request('resources/read',{uri:'file:///C:/private.hwp'})).error.code,-32002);
  const opened=(await c.request('tools/call',{name:'hjhwpx_open_document',arguments:{file,plan:{replacements:[{from:'2026',to:'2027',expectedCount:1}]}}})).result;
  const summary=JSON.parse(opened.content[0].text);assert.equal(summary.previewKind,'mcp-html');assert.equal(summary.previewPath,undefined);assert.equal(summary.previewResourceUri,view.URI);assert.equal(summary.changedCount,1);
  const payload=opened._meta.review.snapshot;assert(payload.document);assert(!opened.content[0].text.includes(payload.document));assert.match(Buffer.from(payload.after,'base64').toString(),/2027/);
  const updated=(await c.request('tools/call',{name:'hjhwpx_update_review',arguments:{sessionId:summary.sessionId,expectedRevision:summary.revision,plan:{replacements:[]}}})).result;
  assert.equal(updated._meta.review.summary.revision,summary.revision+1);assert.notEqual(payload.document,updated._meta.review.snapshot.document);
  const stale=(await c.request('tools/call',{name:'hjhwpx_update_review',arguments:{sessionId:summary.sessionId,expectedRevision:summary.revision,plan:{replacements:[]}}})).result;assert(stale.isError);assert(!stale._meta);
  await c.request('tools/call',{name:'hjhwpx_close_review',arguments:{sessionId:summary.sessionId}});
  assert(fs.readFileSync(file).equals(bytes));
  await c.request('initialize',{protocolVersion:'2025-06-18',capabilities:{}});
  assert(!(await c.request('tools/list')).result.tools.find(t=>t.name==='hjhwpx_open_document')._meta.ui);
  const legacy=(await c.request('tools/call',{name:'hjhwpx_open_document',arguments:{file}})).result;const old=JSON.parse(legacy.content[0].text);assert.equal(old.previewKind,'self-contained-html');assert(fs.existsSync(old.previewPath));assert(!legacy._meta);
  await c.request('tools/call',{name:'hjhwpx_close_review',arguments:{sessionId:old.sessionId}});assert(!fs.existsSync(old.previewPath));
  console.log('PASS: MCP Apps handshake/discovery/resource, private payload, HWPX revision/parity/source preservation, stale revision and legacy fallback');
 }finally{await c.stop();assert(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep));assert(path.basename(temp).startsWith('hjhwpx-mcp-view-'));fs.rmSync(temp,{recursive:true,force:true});}
}
module.exports={fixture};if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
