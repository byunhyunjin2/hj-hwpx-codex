'use strict';
const ui=require('./ui.cjs');
const URI='ui://hjhwpx/review-v1.html',MIME='text/html;profile=mcp-app';
function resource(){
 const session={sourceName:'',format:'hwp',pages:0,changes:[],held:[],blocks:[],plan:{protectedBlockIds:[]},warnings:[],revision:0};
 return {uri:URI,mimeType:MIME,text:ui(session,'',null,{mcp:true}),_meta:{ui:{prefersBorder:true,csp:{connectDomains:[],resourceDomains:[],frameDomains:[]}}}};
}
function toolResult(summary,session){
 const data={...summary,previewKind:'mcp-html',previewResourceUri:URI};delete data.previewPath;
 return {content:[{type:'text',text:JSON.stringify(data)}],_meta:{review:{summary:data,snapshot:session.reviewPayload}}};
}
module.exports={URI,MIME,resource,toolResult};
