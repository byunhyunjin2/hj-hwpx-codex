'use strict';
const assert=require('node:assert/strict');
const core=require('./core.cjs');

const markdown='행사일: 2026. 12. 12. (토)\n\n별도 안내';
const blocks=core.splitBlocks(markdown).map(b=>({...b,protected:false,normalized:b.text.replace(/\s/g,'')}));
const page=(number,text)=>`<div class="kordoc-page" data-page="${number}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 900"><g data-kordoc-type="paragraph"><text x="0" y="20">${text}</text></g></svg></div>`;
const session={id:'review-test',format:'hwpx',markdown,blocks,before:`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="style-src 'unsafe-inline';"><style>body{}</style></head><body>${page(1,'일정 안내')}${page(2,'행사일: 2026. 12. 12. (토)')}<div id="toolbar"></div></body></html>`,pages:2,warnings:[],revision:0};

core.stage(session,{replacements:[{from:'2026. 12. 12. (토)',to:'2027. 12. 12. (일)',blockIds:['b1'],expectedCount:1}],reviewNotes:[{page:2,targetText:'2027. 12. 12. (일)',text:'변경한 행사 날짜와 일정이 확정된 내용인지 확인하세요.'}]});
assert.equal((session.after.match(/class="page-note"/g)||[]).length,1);
assert.match(session.after,/data-note-page="2"/);
assert.doesNotMatch(session.after,/data-note-page="1"/);
assert.match(session.after,/class="review-mark"[^>]*>[\s\S]*?2027\. 12\. 12\. \(일\)/);
assert.equal(session.visualCounts.reviewMarked,1);
assert.equal(session.visualCounts.changed,1);

const base={replacements:[{from:'2026. 12. 12. (토)',to:'2027. 12. 12. (일)'}]};
assert.throws(()=>core.stage({...session,revision:0},{replacements:[{...base.replacements[0],to:'2027. 12. 12. (월)'}]}),/요일이 맞지 않습니다/);
assert.throws(()=>core.stage({...session,revision:0},{replacements:[{...base.replacements[0],to:'2027.12.12.(일)'}]}),/표기 형식/);
assert.throws(()=>core.stage({...session,revision:0},{replacements:[{from:'2026',to:'2027'}]}),/전체 날짜/);
assert.throws(()=>core.stage({...session,revision:0},{reviewNotes:[{page:1,targetText:'별도 안내',text:'다른 쪽 내용 확인'}]}),/한 곳으로 특정/);

const privateMarkdown='개인정보동의: 주민등록번호 원문 확인';
const privateBlocks=core.splitBlocks(privateMarkdown).map(b=>({...b,protected:core.privacy(b.text),normalized:b.text.replace(/\s/g,'')}));
const privateSession={id:'private-review-test',format:'hwpx',markdown:privateMarkdown,blocks:privateBlocks,before:`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="style-src 'unsafe-inline';"><style>body{}</style></head><body>${page(1,'<tspan>개인정보동의: </tspan><tspan>주민등록번호 원문 확인</tspan>')}<div id="toolbar"></div></body></html>`,pages:1,warnings:[],revision:0};
core.stage(privateSession,{replacements:[]});
assert.match(privateSession.after,/<tspan class="review-mark" fill="#b91c1c"><title>확인 필요 · 개인정보 포함 문단 원문 확인<\/title><tspan>개인정보동의: <\/tspan><tspan>주민등록번호 원문 확인<\/tspan><\/tspan>/);
assert.match(privateSession.after,/개인정보·이력서·식별번호: 원래 값 유지/);

const contactMarkdown='담당자: 홍길동 (02-1234-5678, example@example.com)\n주소: 서울시 테스트로 1';
const contactBlock=core.splitBlocks(contactMarkdown).map(b=>({...b,protected:core.privacy(b.text),normalized:b.text.replace(/\s/g,'')}));
assert.equal(contactBlock.length,1);
assert.equal(contactBlock[0].protected,true);
assert.equal(core.privacy('전화 053-123-4567'),true);
assert.equal(core.privacy('예시 example@example.com'),true);
const contactSession={id:'contact-review-test',format:'hwpx',markdown:contactMarkdown,blocks:contactBlock,before:`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="style-src 'unsafe-inline';"><style>body{}</style></head><body>${page(1,'<tspan>담당자: 홍길동 (02-1234-5678, example@example.com)</tspan>')}<div id="toolbar"></div></body></html>`,pages:1,warnings:[],revision:0};
core.stage(contactSession,{replacements:[]});
assert.match(contactSession.after,/<tspan class="review-mark" fill="#b91c1c"><title>확인 필요 · 개인정보 포함 문단 원문 확인<\/title><tspan>담당자: 홍길동 \(02-1234-5678, example@example\.com\)<\/tspan><\/tspan>/);
assert.match(contactSession.after,/확인 필요/);
console.log('PASS: page-specific notes, exact red target mark, date style and weekday checks');
