'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),version=require('../plugin.json').version;
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
function packageIdentity(){
 const files=['plugin.json','.codex-plugin/plugin.json','mcp.json','.mcp.json','runtime/python-runtime.json','scripts/library-transfer.cjs',...fs.readdirSync(path.join(root,'server')).filter(n=>n.endsWith('.cjs')&&!/\.(?:test|integration)\.cjs$/.test(n)).map(n=>'server/'+n),'skills/hjhwpx/SKILL.md','skills/hjhwpx/references/setup.md'].sort();
 const hashes=files.map(name=>[name,fs.existsSync(path.join(root,name))?hash(fs.readFileSync(path.join(root,name))):null]);
 return {version,installedFilesSha256:hash(JSON.stringify(hashes)),skillSha256:hashes.find(([n])=>n==='skills/hjhwpx/SKILL.md')[1],attachmentPolicy:'same-attachment-host-staging-allowed',previewPolicy:'plugin-html-review',hostSelectedSkill:'not-verifiable-from-server'};
}
module.exports={packageIdentity};
