'use strict';
const assert=require('node:assert/strict'),{verifyControls}=require('./hwp-mapped-patch.cjs');
const before=Buffer.from('date / venue\r','utf16le'),after=Buffer.from('date /\nvenue\r','utf16le');
assert.doesNotThrow(()=>verifyControls(before,after,'date / venue','date /\nvenue'));
assert.throws(()=>verifyControls(before,after,'date / venue','date / venue'),/보존 검증/);
assert.throws(()=>verifyControls(after,before,'date /\nvenue','date / venue'),/보존 검증/);
assert.throws(()=>verifyControls(before,Buffer.from('date /\nvenue','utf16le'),'date / venue','date /\nvenue'),/보존 검증/);
console.log('PASS: explicit HWP line-break addition, unchanged control records and rejected missing/unplanned breaks');
