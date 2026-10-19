'use strict';
// Only operational cells before a roster's identifying columns are editable.
// Explicitly protected blocks and all personal rows remain protected.
const plain=s=>s.replace(/<[^>]*>/g,'').replace(/\s/g,'');
function fields(html){
 if((html.match(/<table\b/gi)||[]).length!==1)return [];
 const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
 const header=rows.findIndex(r=>/학번/.test(plain(r[1]))&&/이름|성명/.test(plain(r[1])));
 if(header<0||!rows.slice(0,header).some(r=>/참석자명단|참가자명단/.test(plain(r[1]))))return [];
 const result=[];
 for(let row=0;row<header;row++){
  const r=rows[row],cells=[...r[1].matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi)];let col=0;
  for(let i=0;i<cells.length;i++){
   const c=cells[i],label=i?plain(cells[i-1][3]):'',value=plain(c[3]);
   if((c[1].toLowerCase()==='th'&&/참석자명단|참가자명단/.test(value))||/^(교육기간|참여인원|프로그램명)$/.test(label)){
    const start=r.index+r[0].indexOf(r[1])+c.index+c[0].indexOf('>')+1;
    result.push({start,end:start+c[3].length,text:c[3],normalized:value,row,col});
   }
   col+=+(c[2].match(/colspan=["'](\d+)["']/i)?.[1]||1);
  }
 }
 return result;
}
function transform(html,fn){const safe=fields(html);let at=0,out='';for(const f of safe){out+=html.slice(at,f.start)+fn(f.text);at=f.end;}return out+html.slice(at);}
function permitsText(html,text){const n=plain(text);return !!n&&fields(html).some(f=>f.normalized===n);}
function permitsParagraph(block,paragraph,map){
 const cell=map.sections.flatMap(s=>s.tables).flatMap(t=>t.cells).find(c=>c.id===paragraph.cellId);
 return !!cell&&fields(block.text).some(f=>f.row===cell.row&&f.col===cell.col);
}
module.exports={fields,transform,permitsText,permitsParagraph};
