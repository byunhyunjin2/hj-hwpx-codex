'use strict';
const {checkEnvironment}=require('../server/environment.cjs');
checkEnvironment({files:process.argv.slice(2)}).then(result=>{console.log(JSON.stringify(result));if(!result.ready||result.attachments.some(f=>!f.available))process.exitCode=1;}).catch(e=>{console.error(JSON.stringify({code:e.code||'ENVIRONMENT_CHECK_FAILED',message:e.message}));process.exitCode=1;});
