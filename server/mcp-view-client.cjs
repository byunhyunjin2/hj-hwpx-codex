'use strict';
// Serialized into the MCP HTML resource. No remote scripts, frames or HTTP server.
function runtime(){
 let nextId=0,hostCapabilities={},initialized=false,closed=false,boundSession=null,revision=0;
 const pending=new Map();let renderQueue=Promise.resolve();
 function notify(method,params){window.parent.postMessage({jsonrpc:'2.0',method,params},'*');}
 function request(method,params){return new Promise((resolve,reject)=>{
  const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(Error('호스트 응답 시간이 초과됐습니다.'));},15000);
  pending.set(id,{resolve,reject,timer});window.parent.postMessage({jsonrpc:'2.0',id,method,params},'*');
 });}
 function problem(message){document.getElementById('download').disabled=true;const status=document.getElementById('status');status.textContent=message;status.style.color='#b91c1c';document.getElementById('conversionOverlay').classList.add('done');}
 function panel(element){
  const root=element.attachShadow({mode:'open'}),container=document.createElement('div');container.style.cssText='position:relative;display:flow-root;min-height:100%';root.append(container);
  // Adapt existing page/scroll logic without a nested iframe (blocked by MCP hosts).
  const doc={querySelector:s=>container.querySelector(s),querySelectorAll:s=>container.querySelectorAll(s),fonts:document.fonts};
  return {element,contentDocument:doc,dataset:element.dataset,get clientWidth(){return element.clientWidth;},
   contentWindow:{get scrollY(){return element.scrollTop;},scrollTo:(x,y)=>element.scrollTo(x,y),addEventListener:(...args)=>element.addEventListener(...args)},
   addEventListener:(...args)=>element.addEventListener(...args),
   set srcdoc(html){
    const parsed=new DOMParser().parseFromString(html,'text/html');
    parsed.querySelectorAll('script,iframe,object,embed,base,link,meta').forEach(n=>n.remove());
    for(const node of parsed.querySelectorAll('*'))for(const attr of [...node.attributes])if(/^on/i.test(attr.name))node.removeAttribute(attr.name);
    const styles=[...parsed.querySelectorAll('style')];
    for(const style of styles)style.textContent=style.textContent.replace(/(^|[},]\s*)(?:html|body)(?=\s*[{,.#:])/g,'$1:host');
    container.replaceChildren(...styles,...parsed.body.childNodes);
    requestAnimationFrame(()=>element.dispatchEvent(new Event('load')));
   }
  };
 }
 async function receive(result){
  if(closed)return;
  if(result?.isError){problem('미리보기 준비에 실패했습니다. 도구 오류를 확인하세요.');return;}
  const review=result?._meta?.review;if(!review)return;
  const s=review.summary;
  if(!s||!review.snapshot||!Number.isInteger(s.revision)||s.revision<1||s.revision!==review.snapshot.revision)return;
  if(boundSession&&s.sessionId!==boundSession)return;
  if(s.revision<=revision)return;
  boundSession=s.sessionId;revision=s.revision;
  await renderReview(review);
 }
 window.addEventListener('message',event=>{
  if(event.source!==window.parent||event.data?.jsonrpc!=='2.0')return;
  const m=event.data;
  if(m.id!==undefined&&!m.method){const entry=pending.get(m.id);if(!entry)return;pending.delete(m.id);clearTimeout(entry.timer);m.error?entry.reject(Error(m.error.message||'호스트 요청 실패')):entry.resolve(m.result);return;}
  if(!initialized||closed)return;
  if(m.method==='ui/notifications/tool-result')renderQueue=renderQueue.then(()=>receive(m.params)).catch(()=>problem('미리보기 데이터를 표시하지 못했습니다.'));
  else if(m.method==='ui/notifications/tool-cancelled'){document.getElementById('download').disabled=true;problem('미리보기 작업이 취소됐습니다.');}
  else if(m.method==='ui/resource-teardown'){closed=true;
   document.getElementById('download').disabled=true;document.getElementById('download').onclick=null;
   for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('검토 화면 종료'));}pending.clear();
   before.element.shadowRoot.replaceChildren();after.element.shadowRoot.replaceChildren();
   window.parent.postMessage({jsonrpc:'2.0',id:m.id,result:{}},'*');
  }
 });
 async function download(snapshot){
  if(!hostCapabilities.downloadFile)throw Error('현재 호스트는 MCP 파일 다운로드를 지원하지 않습니다. 다운로드를 완료하지 않았습니다.');
  const result=await request('ui/download-file',{contents:[{type:'resource',resource:{uri:'file:///'+encodeURIComponent(snapshot.name),mimeType:snapshot.name.endsWith('.hwpx')?'application/hwp+zip':'application/x-hwp',blob:snapshot.document}}]});
  if(result?.isError)throw Error('호스트에서 다운로드를 취소하거나 거부했습니다.');
 }
 function connect(){
  document.getElementById('download').disabled=true;
  request('ui/initialize',{protocolVersion:'2026-01-26',appInfo:{name:'hj-hwpx-codex-review',version:'1.0.0'},appCapabilities:{availableDisplayModes:['inline','fullscreen']}}).then(result=>{
   hostCapabilities=result.hostCapabilities||{};initialized=true;notify('ui/notifications/initialized',{});
   notify('ui/notifications/size-changed',{width:document.documentElement.clientWidth,height:window.innerHeight||760});
  }).catch(()=>problem('MCP HTML 호스트 연결에 실패했습니다. 지원 여부를 확인하세요.'));
 }
 return {panel,download,connect,closed:()=>closed,canDownload:()=>!!hostCapabilities.downloadFile};
}
module.exports='('+runtime.toString()+')()';
