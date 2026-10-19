'use strict';
function limits(node){
 const x=+node.getAttribute('x'),y=+node.getAttribute('y'),size=+(node.getAttribute('font-size')||10),original=+node.getAttribute('textLength');
 let table=node.parentNode;while(table&&table.getAttribute?.('data-kordoc-type')!=='table')table=table.parentNode;
 if(!table)return original>0?{width:original,top:y-size,bottom:y+size*.2}:null;
 const lines=Array.from(table.getElementsByTagName('line')),vertical=lines.map(l=>({x:+l.getAttribute('x1'),x2:+l.getAttribute('x2'),a:+l.getAttribute('y1'),b:+l.getAttribute('y2')})).filter(l=>Math.abs(l.x-l.x2)<.05&&Math.min(l.a,l.b)<y&&Math.max(l.a,l.b)>y);
 const right=Math.min(...vertical.filter(l=>l.x>x+.5).map(l=>l.x));
 if(!Number.isFinite(right))return original>0?{width:original,top:y-size,bottom:y+size*.2}:null;
 const horizontal=lines.map(l=>({y:+l.getAttribute('y1'),y2:+l.getAttribute('y2'),a:+l.getAttribute('x1'),b:+l.getAttribute('x2')})).filter(l=>Math.abs(l.y-l.y2)<.05&&Math.min(l.a,l.b)<=x&&Math.max(l.a,l.b)>=x);
 let top=Math.max(...horizontal.filter(l=>l.y<y).map(l=>l.y)),bottom=Math.min(...horizontal.filter(l=>l.y>y).map(l=>l.y));
 if(!Number.isFinite(top)||!Number.isFinite(bottom)){top=y-size;bottom=y+size*.2;}
 // Do not wrap over another paragraph or run in the same cell.
 const neighbors=Array.from(table.getElementsByTagName('text')).filter(t=>t!==node&&+t.getAttribute('x')>=x-.5&&+t.getAttribute('x')<right&&+t.getAttribute('y')>top&&+t.getAttribute('y')<bottom);
 const next=neighbors.filter(t=>Math.abs(+t.getAttribute('y')-y)<size*.5&&+t.getAttribute('x')>x).map(t=>+t.getAttribute('x'));
 const width=Math.min(right-2,...next.map(n=>n-1))-x;
 if(neighbors.length){top=y-size;bottom=y+size*.2;}
 return width>0?{width,top,bottom}:null;
}
function attributes(node){const b=limits(node);return b?` data-hj-fit-width="${b.width}" data-hj-fit-top="${b.top}" data-hj-fit-bottom="${b.bottom}"`:'';}
// Runs only inside the preview; original document font/layout records are untouched.
function fitChangedText(){
 const ns='http://www.w3.org/2000/svg';
 document.querySelectorAll('text[data-hj-fit-width]').forEach(text=>{
  if(!text.querySelector('.change-mark'))return;
  const width=+text.dataset.hjFitWidth,size=+(text.getAttribute('font-size')||10),x=+text.getAttribute('x'),top=+text.dataset.hjFitTop,bottom=+text.dataset.hjFitBottom;
  text.removeAttribute('textLength');text.removeAttribute('lengthAdjust');
  if(text.getComputedTextLength()<=width+.1){text.dataset.hjLayout='natural';return;}
  const original=Array.from(text.childNodes).map(n=>n.cloneNode(true)),characters=[];
  for(const n of original){if(n.nodeType===3)for(const char of n.textContent)characters.push({char});else if(n.tagName==='tspan'){const value=Array.from(n.childNodes).filter(c=>c.nodeName!=='title').map(c=>c.textContent).join('');for(const char of value)characters.push({char,style:n});}}
  const maxLines=Math.max(1,Math.floor((bottom-top-2)/(size*1.15))),measure=document.createElementNS(ns,'tspan');text.replaceChildren(measure);
  const lines=[];let line=[],at=0;const tokens=characters.map(c=>c.char).join('').match(/\S+\s*|\s+/g)||[];for(const token of tokens){const items=characters.slice(at,at+token.length);at+=token.length;measure.textContent=line.map(c=>c.char).join('')+token;if(line.length&&measure.getComputedTextLength()>width){lines.push(line);line=[];}line.push(...items);}if(line.length)lines.push(line);
  const wrap=lines.length>1&&lines.length<=maxLines&&lines.every(row=>{measure.textContent=row.map(c=>c.char).join('');return measure.getComputedTextLength()<=width+.1}),rows=wrap?lines:[characters];text.replaceChildren();
  rows.forEach((row,i)=>{const outer=document.createElementNS(ns,'tspan');outer.setAttribute('x',x);outer.setAttribute('y',wrap?top+size+1+i*size*1.15:text.getAttribute('y'));let at=0;while(at<row.length){let end=at+1;while(end<row.length&&row[end].style===row[at].style)end++;const value=row.slice(at,end).map(c=>c.char).join('');if(row[at].style){const run=row[at].style.cloneNode(false);run.textContent=value;outer.appendChild(run);}else outer.appendChild(document.createTextNode(value));at=end;}text.appendChild(outer);if(!wrap){outer.setAttribute('textLength',width);outer.setAttribute('lengthAdjust','spacingAndGlyphs');}});
  text.dataset.hjLayout=wrap?'wrapped':'fitted';
 });
}
module.exports={limits,attributes,script:'('+fitChangedText.toString()+')();'};
