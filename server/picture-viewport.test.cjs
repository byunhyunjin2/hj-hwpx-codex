'use strict';
const assert=require('node:assert/strict');
const {hwp5PictureViewport}=require('../lib/preview-renderer.cjs');
function picture(dimW,dimH,clip){const p=Buffer.alloc(91);p.writeUInt32LE(dimW,82);p.writeUInt32LE(dimH,86);clip.forEach((v,i)=>p.writeInt32LE(v,44+i*4));return p;}
const full=hwp5PictureViewport(picture(35100,4140,[0,0,35100,4140]),46800,5580);
assert.equal(full.width,35100);assert.equal(full.height,4140);
assert(full.clip.includes('right="35100"'));assert(full.clip.includes('bottom="4140"'));
const cropped=hwp5PictureViewport(picture(1000,400,[100,50,700,300]),2000,800);
assert(cropped.clip.includes('left="100"'));assert(cropped.clip.includes('right="700"'));assert(cropped.clip.includes('bottom="300"'));
const legacy=hwp5PictureViewport(picture(1000,400,[10,20,800,350]).subarray(0,73),2000,800);
assert.equal(legacy.width,2000);assert.equal(legacy.height,800);assert(legacy.clip.includes('right="800"'));
assert.equal(hwp5PictureViewport(null,2000,800).clip,'');
assert.equal(hwp5PictureViewport(picture(0,0,[0,0,0,0]),2000,800).width,2000);
assert.equal(hwp5PictureViewport(picture(1000,400,[700,50,100,300]),2000,800).clip,'');
console.log('PASS: original image dimensions, absolute crop edges, resized uncropped logos, intentional cropping, legacy and invalid metadata');
