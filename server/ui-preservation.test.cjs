'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const ui=fs.readFileSync(require.resolve('./ui.cjs'));
assert.equal(crypto.createHash('sha256').update(ui).digest('hex'),'329a5833ca0c29a067d571e3ab429796a4d0a6e2112aad689a22916d83bbf35f');
console.log('PASS: UI is byte-identical to version 2.0.6');
