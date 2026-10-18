'use strict';
const zlib=require('node:zlib');
function records(bytes){
 const result=[];let offset=0;const stack=[];
 while(offset<bytes.length){
  if(offset+4>bytes.length)throw Error('HWP 레코드 헤더가 잘렸습니다.');
  const header=bytes.readUInt32LE(offset),tag=header&1023,level=(header>>>10)&1023;let size=header>>>20,start=offset+4;
  if(size===4095){if(start+4>bytes.length)throw Error('HWP 확장 헤더가 잘렸습니다.');size=bytes.readUInt32LE(start);start+=4;}
  if(start+size>bytes.length)throw Error('HWP 레코드가 잘렸습니다.');
  while(stack.length&&result[stack.at(-1)].level>=level)stack.pop();
  const record={index:result.length,tag,level,parent:stack.at(-1)??null,offset,start,end:start+size,data:bytes.subarray(start,start+size)};
  result.push(record);stack.push(record.index);offset=record.end;
 }
 return result;
}
function textTokens(data){
 if(data.length%2)throw Error('HWP 텍스트 길이가 잘못되었습니다.');const tokens=[];
 for(let offset=0;offset<data.length;){const code=data.readUInt16LE(offset);let units=code>=1&&code<=9||code===11||code===12||code>=14&&code<=23?8:1;
  if(code===10&&offset+18<=data.length&&data.readUInt16LE(offset+2)===11)units=9;
  if(offset+units*2>data.length)throw Error('HWP 제어 코드가 잘렸습니다.');
  tokens.push({offset,end:offset+units*2,code,plain:code>=32,kind:code===10&&units===1?'forced-line-break':code===13?'paragraph-end':code<32?'control':'text'});offset+=units*2;
 }return tokens;
}
function structure(bytes,engine){
 const cfb=engine.CFB.parse(bytes),fileHeader=engine.CFB.find(cfb,'/FileHeader');
 if(!fileHeader?.content||fileHeader.content.length<40)throw Error('HWP 헤더가 없습니다.');
 const flags=Buffer.from(fileHeader.content).readUInt32LE(36),compressed=!!(flags&1),sections=[];
 for(const name of cfb.FullPaths.filter(n=>/\/BodyText\/Section\d+$/.test(n)).sort((a,b)=>Number(a.match(/\d+$/)[0])-Number(b.match(/\d+$/)[0]))){
  const stream=Buffer.from(engine.CFB.find(cfb,name).content),body=compressed?zlib.inflateRawSync(stream):stream,items=records(body),tables=[],tableByRecord=new Map(),paragraphs=[];
  const nearest=(item,tag)=>{for(let p=item.parent;p!==null;p=items[p].parent)if(items[p].tag===tag)return items[p];return null;};
  for(const item of items){
   if(item.tag!==71||item.data.length<4||item.data.subarray(0,4).toString('ascii')!==' lbt')continue;
   let parent=null;for(let p=item.parent;p!==null;p=items[p].parent)if(tableByRecord.has(p)){parent=tableByRecord.get(p);break;}
   const table={id:`s${sections.length}:t${item.index}`,record:item.index,parentTable:parent?.id??null,rows:0,cols:0,cells:[],currentCell:null};tables.push(table);tableByRecord.set(item.index,table);
  }
  // Resolve parents after all table controls are known.
  for(const table of tables){let p=items[table.record].parent;for(;p!==null;p=items[p].parent)if(tableByRecord.has(p)){table.parentTable=tableByRecord.get(p).id;break;}}
  for(const item of items){
   let table=null;for(let p=item.parent;p!==null;p=items[p].parent)if(tableByRecord.has(p)){table=tableByRecord.get(p);break;}
   if(item.tag===77&&table&&item.parent===table.record&&item.data.length>=8){table.rows=item.data.readUInt16LE(4);table.cols=item.data.readUInt16LE(6);}
   if(item.tag===72&&table&&item.parent===table.record&&item.data.length>=30){
    const col=item.data.readUInt16LE(8),row=item.data.readUInt16LE(10),colSpan=item.data.readUInt16LE(12),rowSpan=item.data.readUInt16LE(14);
    if(row<table.rows&&col<table.cols&&colSpan&&rowSpan){const cell={id:`${table.id}:r${row}c${col}`,row,col,rowSpan,colSpan,record:item.index,paragraphs:[]};table.cells.push(cell);table.currentCell=cell;}
   }
   if(item.tag===66){const paragraph={id:`s${sections.length}:p${item.index}`,record:item.index,tableId:table?.id??null,cellId:table?.currentCell?.id??null,textRecords:[],breaks:[]};paragraphs.push(paragraph);if(table?.currentCell)table.currentCell.paragraphs.push(paragraph.id);}
   if(item.tag===67){const parent=nearest(item,66),paragraph=parent&&paragraphs.find(p=>p.record===parent.index);if(paragraph)paragraph.textRecords.push(item.index);}
  }
  for(const table of tables)delete table.currentCell;
  sections.push({name,body,records:items,tables,paragraphs});
 }
 return {cfb,flags,compressed,sections};
}
function buildSourceMap(bytes,parsedBlocks,reviewBlocks,engine){
 const map=structure(bytes,engine),access=engine.hwpSourceAccess;
 if(!access)throw Error('HWP 원본 위치 어댑터가 없습니다.');
 const flat=access.flattenBlocks(parsedBlocks),reviewByParsed=new Map();let cursor=0;
 for(const part of flat){
  const text=part.raw.trimEnd();let index=reviewBlocks.findIndex((b,i)=>i>=cursor&&b.text===text);
  if(index<0)continue;cursor=index+1;const ids=reviewByParsed.get(part.blockIdx)||[];ids.push(reviewBlocks[index].id);reviewByParsed.set(part.blockIdx,ids);
 }
 const top=map.sections.flatMap(s=>s.tables.filter(t=>!t.parentTable)),parsedTables=parsedBlocks.map((block,index)=>({block,index})).filter(v=>v.block.type==='table');
 if(top.length!==parsedTables.length)throw Error('원본 표 개수와 파싱 결과가 다릅니다.');
 const roots=new Map();for(let i=0;i<top.length;i++){
  const table=top[i],parsed=parsedTables[i];if(table.rows!==parsed.block.table.rows||table.cols!==parsed.block.table.cols)throw Error('원본 표 좌표와 파싱 결과가 다릅니다.');
  roots.set(table.id,reviewByParsed.get(parsed.index)||[]);
 }
 const allTables=new Map(map.sections.flatMap(s=>s.tables.map(t=>[t.id,t])));
 for(let sectionIndex=0;sectionIndex<map.sections.length;sectionIndex++){
  const section=map.sections[sectionIndex],scan=access.scan(section.body,sectionIndex,map.compressed),paras=new Map(scan.paras.map(p=>[p.headerIdx,p]));
  for(const paragraph of section.paragraphs){
   const source=paras.get(paragraph.record);if(!source)continue;
   paragraph.text=source.rawText;paragraph.sectionIndex=sectionIndex;paragraph.source=source;paragraph.blockIds=[];
   if(paragraph.tableId){let table=allTables.get(paragraph.tableId);while(table?.parentTable)table=allTables.get(table.parentTable);paragraph.blockIds=roots.get(table?.id)||[];}
   else if(source.rawText.trim()){
    const candidates=parsedBlocks.map((block,index)=>({block,index})).filter(v=>(v.block.type==='paragraph'||v.block.type==='heading')&&v.block.text?.trim()===source.rawText.trim());
    if(candidates.length===1)paragraph.blockIds=reviewByParsed.get(candidates[0].index)||[];
   }
   // A forced line break lives in PARA_TEXT; a new paragraph has a different record ID.
   paragraph.breaks=[];for(const recordId of paragraph.textRecords){const record=section.records[recordId];for(const token of textTokens(record.data))if(token.kind==='forced-line-break'||token.kind==='paragraph-end')paragraph.breaks.push({kind:token.kind,record:recordId,byteOffset:token.offset});}
  }
 }
 return map;
}
function summary(map){const tables=map.sections.flatMap(s=>s.tables);return {sections:map.sections.length,tables:tables.length,topLevelTables:tables.filter(t=>!t.parentTable).length,nestedTables:tables.filter(t=>t.parentTable).length,paragraphs:map.sections.reduce((n,s)=>n+s.paragraphs.length,0),forcedLineBreaks:map.sections.reduce((n,s)=>n+s.paragraphs.reduce((m,p)=>m+p.breaks.filter(b=>b.kind==='forced-line-break').length,0),0)};}
module.exports={records,structure,buildSourceMap,summary,textTokens};
