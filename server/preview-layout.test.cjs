'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),{DOMParser}=require('../lib/engine.cjs'),layout=require('./preview-layout.cjs');
const doc=new DOMParser().parseFromString('<svg><g data-kordoc-type="table"><line x1="100" x2="100" y1="20" y2="50"/><line x1="0" x2="200" y1="20" y2="20"/><line x1="0" x2="200" y1="50" y2="50"/><text x="10" y="38" font-size="10" textLength="140">original</text></g></svg>','image/svg+xml');
const text=doc.getElementsByTagName('text')[0];assert.deepEqual(layout.limits(text),{width:88,top:20,bottom:50});
const neighbor=doc.createElement('text');neighbor.setAttribute('x','70');neighbor.setAttribute('y','38');text.parentNode.appendChild(neighbor);assert.deepEqual(layout.limits(text),{width:59,top:28,bottom:40});
new vm.Script(layout.script);assert.match(layout.script,/spacingAndGlyphs/);assert.match(layout.script,/maxLines/);
console.log('PASS: cell boundaries, neighboring text, wrap capacity and script syntax');
