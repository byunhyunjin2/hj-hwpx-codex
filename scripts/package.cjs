'use strict';
const fs=require('node:fs'),path=require('node:path');
const {JSZip}=require('../lib/engine.cjs');
async function main(){const root=path.resolve(__dirname,'..'),manifest=require('../plugin.json'),out=path.resolve(process.argv[2]||path.join(root,'..',`hj-hwpx-codex-${manifest.version}.zip`));
 if(out.startsWith(root+path.sep))throw Error('배포 파일은 소스 폴더 밖에 저장하세요.');const zip=new JSZip();
 const roots=['.codex-plugin','.mcp.json','mcp.json','plugin.json','README.md','CHANGELOG.md','validation.json','assets','lib','licenses','runtime','scripts','server','skills','renderer-fix'];
 function add(relative){const absolute=path.join(root,relative),stat=fs.lstatSync(absolute);if(stat.isSymbolicLink())throw Error('심볼릭 링크는 패키지에 포함하지 않습니다.');if(stat.isDirectory()){for(const entry of fs.readdirSync(absolute))add(path.join(relative,entry));return;}if(/\.(?:test|integration)\.cjs$/.test(relative))return;if(/\.(?:hwp|hwpx|html|zip)$/i.test(relative))throw Error('문서·미리보기 파일은 패키지에 포함할 수 없습니다.');zip.file(relative.replace(/\\/g,'/'),fs.readFileSync(absolute));}
 roots.forEach(add);const data=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:9}});const check=await JSZip.loadAsync(data);if(Object.keys(check.files).some(n=>n.startsWith('.git/')||n.startsWith('.agents/')))throw Error('개발용 메타데이터가 포함되었습니다.');for(const key of ['plugin.json','.codex-plugin/plugin.json','.mcp.json','runtime/win32-x64/node.exe','server/hwp-structure.cjs','server/hwp-mapped-patch.cjs'])if(!check.file(key))throw Error('패키지 필수 파일 누락: '+key);fs.writeFileSync(out,data);console.log(JSON.stringify({path:out,bytes:data.length,files:Object.keys(check.files).length,version:manifest.version}));
}main().catch(e=>{console.error(e.message);process.exitCode=1;});
