'use strict';
const assert=require('node:assert/strict');
const {records,structure,textTokens}=require('./hwp-structure.cjs');
function record(tag,level,data){const h=Buffer.alloc(data.length>=4095?8:4);h.writeUInt32LE(((data.length>=4095?4095:data.length)<<20|level<<10|tag)>>>0);if(h.length===8)h.writeUInt32LE(data.length,4);return Buffer.concat([h,data]);}
const tableBody=Buffer.alloc(22);tableBody.writeUInt16LE(1,4);tableBody.writeUInt16LE(1,6);
const cell=Buffer.alloc(34);cell.writeUInt16LE(1,12);cell.writeUInt16LE(1,14);
const ctrl=level=>record(71,level,Buffer.from(' lbt'));
const header=Buffer.alloc(40),paragraph=record(66,2,Buffer.alloc(22));
function map(body){const cfb={FullPaths:['Root Entry/BodyText/Section0']};return structure(Buffer.alloc(0),{CFB:{parse:()=>cfb,find:(_,name)=>({content:name==='/FileHeader'?header:body})}});}
const flat=Buffer.concat([ctrl(1),record(77,2,tableBody),record(72,2,cell),paragraph,record(67,3,Buffer.from('표 글자\n다음 줄\r','utf16le'))]);
assert.equal(map(flat).sections[0].tables.length,1);assert.equal(map(flat).sections[0].tables[0].parentTable,null);
const nested=Buffer.concat([flat,ctrl(3),record(77,4,tableBody),record(72,4,cell),record(66,4,Buffer.alloc(22)),record(67,5,Buffer.from('안쪽 표\r','utf16le'))]);
const result=map(nested).sections[0];assert.equal(result.tables.length,2);assert.equal(result.tables[1].parentTable,result.tables[0].id);assert.equal(result.paragraphs[1].tableId,result.tables[1].id);
assert.equal(textTokens(Buffer.from('글자\n다음\r','utf16le')).filter(t=>t.kind==='forced-line-break').length,1);
const field=Buffer.alloc(16);field.writeUInt16LE(3);Buffer.from(' lbt').copy(field,2);field.writeUInt16LE(3,14);
assert.equal(textTokens(field).length,1);assert.equal(textTokens(field)[0].plain,false);
const ext=record(67,0,Buffer.alloc(5000));assert.equal(records(ext)[0].data.length,5000);
assert.throws(()=>records(flat.subarray(0,flat.length-1)));assert.throws(()=>textTokens(Buffer.from([3,0])));
console.log('PASS: original table ancestry, flat table, nested table, paragraph/cell IDs, forced breaks, binary controls, extended/truncated records');
