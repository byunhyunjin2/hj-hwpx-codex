const assert=require('node:assert/strict'),vm=require('node:vm'),ui=require('./ui.cjs');
const session={sourceName:'test.hwp',format:'hwp',pages:2,changes:[],held:[],blocks:[],plan:{protectedBlockIds:[]},warnings:[],revision:2};
for(const snapshot of [null,{before:'',after:'',document:'AA==',name:'test.hwp'}]){
 const html=ui(session,'test-token',snapshot);new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
 for(const id of ['compare','download','page','sync','before','after'])assert(html.includes('id="'+id+'"'));
 assert.match(html,/frame.clientWidth<40/);assert.match(html,/function settle\(p\)/);
 assert.match(html,/onchange=e=>settle/);assert.match(html,/previousElementSibling/);
}
console.log('PASS: live/snapshot controls, scripts, hidden-pane and page-position guards');
const mcpHtml=ui(session,'',null,{mcp:true}),legacyHtml=ui(session,'',{before:'',after:'',document:'AA==',name:'test.hwp'});
new vm.Script(mcpHtml.match(/<script>([\s\S]*?)<\/script>/)[1]);
assert(!mcpHtml.includes('<iframe'));assert.match(mcpHtml,/frame-src 'none'/);assert.match(mcpHtml,/connect-src 'none'/);
const styles=html=>[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]);
assert.equal(styles(mcpHtml).at(-1),styles(legacyHtml).at(-1),'Shared toolbar/layout/color/default styles must be identical');
for(const id of ['compare','download','page','sync','before','after'])assert(mcpHtml.includes('id="'+id+'"'));
