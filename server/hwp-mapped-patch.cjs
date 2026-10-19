'use strict';
const roster=require('./roster-metadata.cjs');
const {textTokens}=require('./hwp-structure.cjs');
function verifyControls(before,after,beforeText,afterText){const tokens=data=>textTokens(data),controls=data=>tokens(data).filter(t=>!t.plain&&t.kind!=='forced-line-break').map(t=>data.subarray(t.offset,t.end).toString('hex'));const breaks=data=>tokens(data).filter(t=>t.kind==='forced-line-break').length,added=(afterText.match(/\n/g)||[]).length-(beforeText.match(/\n/g)||[]).length;if(added<0||breaks(after)!==breaks(before)+added||JSON.stringify(controls(before))!==JSON.stringify(controls(after)))throw Error('줄바꿈·제어 코드 보존 검증 실패');}
function patchMapped(session,engine,replaceText,countMatches){
 const map=session.hwpSourceMap,access=engine.hwpSourceAccess;
 if(!map||!access)throw Error('HWP 원본 위치 정보가 없습니다.');
 if(map.flags&(2|4|256))throw Error('보호된 HWP는 지원하지 않습니다.');
 const counts=new Map(),edits=[],protectedIds=new Set(session.plan.protectedBlockIds);
 for(const section of map.sections)for(const paragraph of section.paragraphs){
  if(!paragraph.source||!paragraph.blockIds.length)continue;
  // A split/caption block requires a unique owner before any edit can be made.
  if(paragraph.blockIds.length!==1)continue;
  const block=session.blocks.find(b=>b.id===paragraph.blockIds[0]);if(!block||protectedIds.has(block.id)||(block.protected&&!roster.permitsParagraph(block,paragraph,map)))continue;
  let text=paragraph.text;const replacements=[];
  for(const replacement of session.plan.replacements){
   if(replacement.blockIds&&!replacement.blockIds.includes(block.id))continue;
   const change=session.changes.find(c=>c.blockId===block.id&&c.from===replacement.from&&c.to===replacement.to);if(!change)continue;
   const n=countMatches(text,replacement.from);if(!n)continue;
   const key=JSON.stringify([block.id,replacement.from,replacement.to]);counts.set(key,(counts.get(key)||0)+n);
   text=replaceText(text,replacement.from,replacement.to);replacements.push(replacement);
  }
  if(text!==paragraph.text)edits.push({paragraph,text,replacements});
 }
 for(const change of session.changes){const actual=counts.get(JSON.stringify([change.blockId,change.from,change.to]))||0;if(actual!==change.count){const error=Error('셀의 원본 수정 위치를 확정하지 못했습니다. 줄바꿈 또는 블록 범위를 확인해 주세요.');error.code='HWP_SOURCE_LOCATION_UNRESOLVED';error.location={blockId:change.blockId,expected:change.count,actual};throw error;}}
 const scans=map.sections.map((section,index)=>access.scan(section.body,index,map.compressed));
 for(const {paragraph,text} of edits){const scan=scans[paragraph.sectionIndex],source=scan.paras.find(p=>p.headerIdx===paragraph.record),reasons=[];
  if(!source||source.rawText!==paragraph.text)throw Error('원본 문단 위치가 변경되었습니다.');
  const applied=access.edit(scan,source,text,reason=>{reasons.push(reason);return 0;},paragraph.text);
  if(applied!==1||reasons.length){const error=Error('원본 문단을 보존하며 수정할 수 없습니다: '+reasons.join(' · '));error.code='HWP_PARAGRAPH_UNSUPPORTED';error.location={paragraphId:paragraph.id,tableId:paragraph.tableId,cellId:paragraph.cellId};throw error;}
  if(source.textIdx>=0){const before=scan.records[source.textIdx].data,after=scan.repl.get(source.textIdx)||before;verifyControls(before,after,paragraph.text,text);}
 }
 let data=Buffer.from(session.bytes);const zlib=require('node:zlib');
 for(let i=0;i<scans.length;i++){const scan=scans[i];if(!scan.repl.size&&!scan.inserts.size)continue;
  if(scan.inserts.size)throw Error('문단 구조 변경은 이 수정 경로에서 지원하지 않습니다.');
  for(const [recordId] of scan.repl)if(![66,67,68,69].includes(scan.records[recordId].tagId))throw Error('표·개체 구조 보존 검증 실패');
  const body=access.encode(scan.records,scan.repl,scan.inserts);data=access.replaceStream(data,map.sections[i].name.replace(/^Root Entry/,''),map.compressed?zlib.deflateRawSync(body):body);}
 return {success:true,data,skipped:[],mapping:{paragraphs:edits.length,locations:edits.map(e=>({paragraphId:e.paragraph.id,tableId:e.paragraph.tableId,cellId:e.paragraph.cellId}))}};
}
module.exports={patchMapped,verifyControls};
