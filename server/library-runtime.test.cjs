'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),cp=require('node:child_process'),crypto=require('node:crypto');
const {runLibraryHelper,checkLibraryRuntime,decodeTransfer}=require('./library-runtime.cjs');
const root=path.resolve(__dirname,'..'),python=path.join(root,'runtime/python-win32-x64/python.exe'),cli=path.join(root,'scripts/library-transfer.cjs');
const helperCode=`import sys,json,pathlib,urllib.request,hashlib\npayload=json.load(sys.stdin)\nassert sys.argv[1]=='materialize'\nassert sys.flags.isolated==1\noutput=pathlib.Path(sys.argv[2])\nwith urllib.request.urlopen(payload['download_url'],timeout=10) as response:\n    data=response.read()\noutput.parent.mkdir(parents=True,exist_ok=True)\noutput.write_bytes(data)\nmetadata={'library_file_id':payload['library_file_id'],'current_version_number':payload['current_version_number'],'sha256':hashlib.sha256(data).hexdigest()}\noutput.with_suffix(output.suffix+'.library.json').write_text(json.dumps(metadata,ensure_ascii=False),encoding='utf-8')\nrequest=urllib.request.Request(payload['completion_url'],data=json.dumps(metadata).encode('utf-8'),headers={'Content-Type':'application/json','X-Test-Token':payload['completion_token']},method='POST')\nwith urllib.request.urlopen(request,timeout=10) as response:\n    assert response.status==200\nprint(json.dumps(metadata,ensure_ascii=False))\n`;
function child(file,args,options={}){return new Promise((resolve,reject)=>{const c=cp.spawn(file,args,{...options,stdio:['pipe','pipe','pipe'],windowsHide:true});let stdout='',stderr='';c.stdout.on('data',b=>stdout+=b);c.stderr.on('data',b=>stderr+=b);c.on('error',reject);c.on('close',status=>resolve({status,stdout,stderr}));c.stdin.end();});}
async function main(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hjhwpx-no-system-python-'));let server;
 try{
  const fake=path.join(temp,'가짜 시스템 별칭'),poison=path.join(temp,'외부 모듈');fs.mkdirSync(fake);fs.mkdirSync(poison);
  fs.writeFileSync(path.join(fake,'python.cmd'),'@echo Python \r\n@exit /b 1\r\n');fs.writeFileSync(path.join(fake,'py.cmd'),'@exit /b 1\r\n');
  fs.writeFileSync(path.join(poison,'json.py'),'raise RuntimeError("SYSTEM_MODULE_MUST_NOT_LOAD")\n');
  const env={...process.env,PATH:fake,PYTHONHOME:path.join(temp,'잘못된 Python'),PYTHONPATH:poison,PYTHONSTARTUP:path.join(poison,'json.py')};
  const alias=cp.spawnSync(path.join(process.env.SystemRoot,'System32/cmd.exe'),['/d','/c','python'],{env,encoding:'utf8',windowsHide:true});assert.equal(alias.status,1);assert.equal(alias.stdout.trim(),'Python');
  const helper=path.join(temp,'공식 도우미 실행 계약 시험.py');
  // Contract fixture only: the host's actual Library helper is not available here.
  fs.writeFileSync(helper,helperCode,'utf8');
  const helperHash=crypto.createHash('sha256').update(fs.readFileSync(helper)).digest('hex');
  const content=Buffer.concat([Buffer.from('d0cf11e0a1b11ae1','hex'),Buffer.from('원래 첨부 바이트','utf8')]);let completions=0;
  server=http.createServer(async(req,res)=>{if(req.url==='/attachment'&&req.method==='GET'){res.end(content);return;}if(req.url==='/complete'&&req.method==='POST'){assert.equal(req.headers['x-test-token'],'test-token-not-real');let body='';for await(const b of req)body+=b;assert.equal(JSON.parse(body).library_file_id,'libfile_fixture_only');completions++;res.end('{}');return;}res.writeHead(404);res.end();});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  const payload={library_file_id:'libfile_fixture_only',current_version_number:0,download_url:origin+'/attachment',completion_url:origin+'/complete',completion_token:'test-token-not-real'},text=JSON.stringify(payload),transfer=path.join(temp,'전달 응답.json');
  fs.writeFileSync(transfer,Buffer.concat([Buffer.from([255,254]),Buffer.from(text,'utf16le')]));assert.deepEqual(decodeTransfer(fs.readFileSync(transfer)).value,payload);assert.deepEqual(decodeTransfer(Buffer.from('\uFEFF'+text)).value,payload);
  const baseline=path.join(temp,'기준.hwp'),base=await new Promise((resolve,reject)=>{const c=cp.spawn(python,['-I','-X','utf8',helper,'materialize',baseline],{env,windowsHide:true});let stdout='',stderr='';c.stdout.on('data',b=>stdout+=b);c.stderr.on('data',b=>stderr+=b);c.on('error',reject);c.on('close',status=>resolve({status,stdout,stderr}));c.stdin.end(text);});assert.equal(base.status,0,base.stderr);
  for(const [name,testEnv] of [['별칭',env],['빈 PATH',{...env,PATH:''}]]){
   const out=path.join(temp,name+'.hwp'),result=await child(process.execPath,[cli,'--helper',helper,'--transfer-json',transfer,'--output',out],{env:testEnv});
   assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,base.stdout);assert(fs.readFileSync(out).equals(content));assert.equal(fs.readFileSync(out+'.library.json','utf8'),fs.readFileSync(baseline+'.library.json','utf8'));
  }
  assert.equal(completions,3);
  const fail=path.join(temp,'실패 도우미.py');fs.writeFileSync(fail,'import sys,json\np=json.load(sys.stdin)\nprint(p["completion_token"],p["download_url"],file=sys.stderr)\nsys.exit(7)\n');
  await assert.rejects(()=>runLibraryHelper({helperPath:fail,outputPath:path.join(temp,'실패.hwp'),transferBytes:Buffer.from(text)}),e=>e.code==='LIBRARY_HELPER_FAILED'&&e.exitCode===7&&!e.details.includes(payload.completion_token)&&!e.details.includes(origin));
  await assert.rejects(()=>runLibraryHelper({helperPath:helper,outputPath:baseline,transferBytes:Buffer.from(text)}),e=>e.code==='LIBRARY_OUTPUT_EXISTS');
  const noCopy=path.join(temp,'파일 미생성.py');fs.writeFileSync(noCopy,'print("{}")\n');await assert.rejects(()=>runLibraryHelper({helperPath:noCopy,outputPath:path.join(temp,'미생성.hwp'),transferBytes:Buffer.from(text)}),e=>e.code==='LIBRARY_LOCAL_COPY_MISSING');
  const slow=path.join(temp,'대기.py');fs.writeFileSync(slow,'import time\ntime.sleep(20)\n');await assert.rejects(()=>runLibraryHelper({helperPath:slow,outputPath:path.join(temp,'대기.hwp'),transferBytes:Buffer.from(text),timeoutMs:100}),e=>e.code==='LIBRARY_HELPER_TIMEOUT');
  assert.throws(()=>decodeTransfer(Buffer.from('not json')),e=>e.code==='LIBRARY_TRANSFER_INVALID');
  await assert.rejects(()=>runLibraryHelper({helperPath:path.join(temp,'missing-helper.py'),outputPath:path.join(temp,'없는 파일.hwp'),transferBytes:Buffer.from(text)}),e=>e.code==='LIBRARY_HELPER_UNAVAILABLE');
  const read=fs.readFileSync;fs.readFileSync=(file,...args)=>String(file).endsWith('python314.dll')?Buffer.from('test corruption'):read(file,...args);try{assert.equal(checkLibraryRuntime().ready,false);}finally{fs.readFileSync=read;}
  const health=checkLibraryRuntime();assert(health.ready);assert.equal(health.systemPythonUsed,false);assert.equal(health.version,'3.14.8');
  assert.equal(helperHash,crypto.createHash('sha256').update(fs.readFileSync(helper)).digest('hex'));
  console.log('PASS: no system Python, poisoned alias/environment, official-helper invocation contract, UTF-16 transfer JSON, byte/metadata/report parity, completion callbacks, failures/secrets/overwrite/timeout guards (fixture, not actual host helper)');
 }finally{if(server)await new Promise(resolve=>server.close(resolve));assert(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep));assert(path.basename(temp).startsWith('hjhwpx-no-system-python-'));fs.rmSync(temp,{recursive:true,force:true});}
}
module.exports={helperCode};
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
