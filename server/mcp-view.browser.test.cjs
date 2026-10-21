'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {resource,toolResult}=require('./mcp-view.cjs');
const {createService}=require('./service.cjs'),{fixture}=require('./mcp-view.test.cjs');
// Authoring runtime only; never required by the plugin at run time.
const {chromium}=require(process.env.HJHWPX_PLAYWRIGHT||'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
function review(revision=1){
 const page=(n,year)=>`<div class="kordoc-page" data-page="${n}"><svg viewBox="0 0 794 1123" xmlns="http://www.w3.org/2000/svg"><rect width="794" height="1123" fill="white"/><text x="40" y="60">${year}학년도 운영계획 ${n}쪽</text><rect class="change-mark" x="38" y="85" width="150" height="30" fill="#ffe66b"/><text x="40" y="108">변경 문구</text><text x="40" y="150" fill="#b91c1c">개인정보 확인</text></svg></div>`;
 const html=year=>'<html><head><style>body{margin:0;background:#e9e8e6}.kordoc-page{position:relative;margin:12px auto;box-shadow:0 1px 6px #999}.kordoc-page svg{width:100%;height:100%}</style></head><body>'+[1,2,3].map(n=>page(n,year)).join('')+'</body></html>';
 return {summary:{sessionId:'test-session',revision,sourceName:'합성 검증.hwpx',format:'hwpx',pageCount:3,changedCount:revision},snapshot:{before:Buffer.from(html('2026')).toString('base64'),after:Buffer.from(html('2027')).toString('base64'),document:Buffer.from('test-only-not-a-user-document').toString('base64'),assets:[],name:'합성 검증_검토반영_r'+revision+'.hwpx',revision}};
}
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const errors=[],context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:false});
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hjhwpx-mcp-browser-'));let service,sessionId;
 await context.route('**/*',route=>route.abort());await context.setOffline(true);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.setContent('<!doctype html><html><body style="margin:0"></body></html>');
  await page.evaluate(({html})=>{
   window.downloadRequests=[];window.savedFiles=[];window.pickerCalls=[];window.pickerMode='save';window.initialized=false;window.allowDownload=true;window.denyDownload=false;
   window.addEventListener('message',e=>{if(e.source!==window.viewer?.contentWindow)return;const m=e.data;if(m.method==='ui/initialize')e.source.postMessage({jsonrpc:'2.0',id:m.id,result:{protocolVersion:'2026-01-26',hostCapabilities:window.allowDownload?{downloadFile:{}}:{}}},'*');else if(m.method==='ui/notifications/initialized')window.initialized=true;else if(m.method==='ui/download-file'){window.downloadRequests.push(m.params);e.source.postMessage({jsonrpc:'2.0',id:m.id,result:window.denyDownload?{isError:true}:{}},'*');}});
   const frame=document.createElement('iframe');frame.id='viewer';frame.style.cssText='width:100%;height:800px;border:0';frame.sandbox='allow-scripts allow-same-origin';frame.srcdoc=html;window.viewer=frame;document.body.append(frame);
  },{html:resource().text});
  await page.evaluate(()=>{
   window.viewer.contentWindow.showSaveFilePicker=async options=>{
    window.pickerCalls.push(options);
    if(window.pickerMode==='cancel'){const e=Error('cancelled');e.name='AbortError';throw e}
    if(window.pickerMode==='blocked'){const e=Error('blocked');e.name='SecurityError';throw e}
    let chunks=[];
    return {name:options.suggestedName,createWritable:async()=>({write:async bytes=>chunks.push(...bytes),close:async()=>window.savedFiles.push({name:options.suggestedName,bytes:chunks}),abort:async()=>{}})};
   };
  });
  await page.waitForFunction(()=>window.initialized);
  const frame=page.frames().find(f=>f.parentFrame());assert(frame);
  const send=async r=>page.evaluate(r=>window.viewer.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{_meta:{review:r}}},'*'),r);
  await send(review());await frame.locator('#conversionOverlay.done').waitFor({state:'attached'});
  assert.equal(await frame.locator('iframe').count(),0);assert.equal(await frame.locator('#beforePane').isVisible(),false);
  assert(await frame.locator('#sync').isChecked());assert.equal(await frame.locator('#page').inputValue(),'1');
  assert.match(await frame.locator('#after').evaluate(e=>e.shadowRoot.textContent),/2027학년도/);assert.equal(await page.evaluate(()=>window.downloadRequests.length),0);
  await frame.locator('#compare').click();assert(await frame.locator('#beforePane').isVisible());
  assert.equal(await frame.locator('#compare').getAttribute('aria-pressed'),'true');
  await frame.locator('#page').selectOption('3');await page.waitForTimeout(100);
  const scroll=await frame.evaluate(()=>({a:document.getElementById('after').scrollTop,b:document.getElementById('before').scrollTop}));assert(scroll.a>100);assert(Math.abs(scroll.a-scroll.b)<3);
  await frame.locator('#compare').click();await page.waitForTimeout(100);assert.equal(await frame.locator('#page').inputValue(),'3');
  // A synthetic DOM click must not export; Playwright's user input below is routed to a mock host only.
  await frame.evaluate(()=>document.getElementById('download').click());assert.equal(await page.evaluate(()=>window.downloadRequests.length),0);
  await frame.locator('#download').click();await page.waitForFunction(()=>window.savedFiles.length===1);
  const saved=await page.evaluate(()=>window.savedFiles[0]);assert.match(saved.name,/\.hwpx$/);assert.deepEqual(saved.bytes,[...Buffer.from('test-only-not-a-user-document')]);assert.equal(await page.evaluate(()=>window.pickerCalls[0].suggestedName),review().snapshot.name);assert.equal(await page.evaluate(()=>window.downloadRequests.length),0);
  await page.evaluate(()=>{window.pickerMode='cancel'});await frame.locator('#download').click();await frame.locator('#status').filter({hasText:'저장 위치 선택을 취소'}).waitFor();assert.equal(await page.evaluate(()=>window.downloadRequests.length),0);
  await page.evaluate(()=>{window.pickerMode='blocked';delete window.viewer.contentWindow.showSaveFilePicker});await frame.locator('#download').click();await page.waitForFunction(()=>window.downloadRequests.length===1);
  const sent=await page.evaluate(()=>window.downloadRequests[0].contents[0].resource);assert.equal(sent.blob,review().snapshot.document);assert.equal(sent.mimeType,'application/hwp+zip');assert(decodeURIComponent(sent.uri).endsWith('.hwpx'));
  await send(review(2));await frame.waitForFunction(()=>document.querySelector('.key.yellow').textContent.includes('2곳')&&!document.getElementById('download').disabled);
  await send(review(1));await page.waitForTimeout(100);assert.match(await frame.locator('.key.yellow').innerText(),/2곳/);
  await page.evaluate(()=>window.denyDownload=true);await frame.locator('#download').click();await frame.locator('#status').filter({hasText:'취소하거나 거부'}).waitFor();
  for(const width of [375,768,1440]){await page.setViewportSize({width,height:900});await page.waitForTimeout(100);assert(await frame.locator('#compare').isVisible());assert(await frame.locator('#page').isVisible());}
  await frame.locator('#compare').click();await frame.locator('#page').selectOption('1');
  if(process.env.HJHWPX_SCREENSHOT){const out=path.resolve(process.env.HJHWPX_SCREENSHOT);fs.mkdirSync(path.dirname(out),{recursive:true});await page.screenshot({path:out});}
  assert.deepEqual(errors,[]);
  // A host without download support must leave the preview available and the button disabled.
  await page.evaluate(()=>{window.allowDownload=false;window.initialized=false;window.viewer.srcdoc=window.viewer.srcdoc;});
  await page.waitForFunction(()=>window.initialized);await send(review());
  const limited=page.frames().find(f=>f.parentFrame());await limited.locator('#conversionOverlay.done').waitFor({state:'attached'});assert(await limited.locator('#download').isDisabled());assert.match(await limited.locator('#status').innerText(),/지원하지 않습니다/);
  // Render the real HWPX parser/verifier output through the same resource and bridge.
  const source=path.join(temp,'합성 첨부.hwpx'),original=await fixture();fs.writeFileSync(source,original);
  service=await createService();const opened=await service.open({file:source,plan:{replacements:[{from:'2026',to:'2027',expectedCount:1}]}});sessionId=opened.sessionId;
  const actual=toolResult(opened,service.sessions.get(sessionId))._meta.review;
  const legacyHtml=fs.readFileSync(opened.previewPath,'utf8'),legacyPayload=JSON.parse(legacyHtml.match(/const snapshot=(\{.*?\});\s*const bytes/s)[1]);assert.deepEqual(actual.snapshot,legacyPayload);
  await page.evaluate(()=>{window.allowDownload=true;window.initialized=false;window.viewer.srcdoc=window.viewer.srcdoc;});await page.waitForFunction(()=>window.initialized);await send(actual);
  const parsed=page.frames().find(f=>f.parentFrame());await parsed.locator('#conversionOverlay.done').waitFor({state:'attached'});
  assert.match(await parsed.locator('#after').evaluate(e=>e.shadowRoot.textContent),/2027/);assert.match(await parsed.locator('#before').evaluate(e=>e.shadowRoot.textContent),/2026/);assert(await parsed.locator('#after .change-mark').count());
  assert.equal(await parsed.locator('#page option').count(),opened.pageCount);assert(fs.readFileSync(source).equals(original));
  await page.evaluate(()=>window.viewer.contentWindow.postMessage({jsonrpc:'2.0',id:777,method:'ui/resource-teardown',params:{}},'*'));await parsed.waitForFunction(()=>document.getElementById('after').shadowRoot.childElementCount===0);assert(await parsed.locator('#download').isDisabled());
  console.log('PASS: offline sandboxed MCP HTML rendering, Save As picker write/cancel and host fallback, real HWPX/legacy payload parity, no nested frames/network, click-only download/denial, revisions, teardown and responsive sizes');
 }finally{if(service&&sessionId)service.close({sessionId});await context.close();await browser.close();assert(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep));assert(path.basename(temp).startsWith('hjhwpx-mcp-browser-'));fs.rmSync(temp,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
