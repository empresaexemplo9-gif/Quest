import test from 'node:test';
import assert from 'node:assert/strict';
import {renderSize, filterTexture} from '../mods/GraphicsQuest.js';

test('8K draws 7680x4320 on full-HD and Retina windows without enlarging the UI', () => {
 for (const dpr of [1,2,3]) assert.deepEqual(renderSize({width:1920,height:1080,dpr}),{width:7680,height:4320});
});
test('4K and light profiles reduce real framebuffer work', () => {
 assert.deepEqual(renderSize({width:1920,height:1080,preset:'4k'}),{width:3840,height:2160});
 assert.deepEqual(renderSize({width:1920,height:1080,preset:'light'}),{width:1920,height:1080});
});
test('GPU texture, renderbuffer and independent viewport limits are respected', () => {
 assert.deepEqual(renderSize({width:1920,height:1080,limit:4096}),{width:4096,height:2304});
 const limited=renderSize({width:1920,height:1080,viewport:[8192,2048]});
 assert.ok(limited.width<=8192 && limited.height<=2048);
 assert.ok(Math.abs(limited.width/limited.height-16/9)<.001);
});
test('ultrawide and portrait scenes keep their aspect ratio inside the 8K envelope', () => {
 assert.deepEqual(renderSize({width:2560,height:1080}),{width:7680,height:3240});
 assert.deepEqual(renderSize({width:1080,height:1920}),{width:2430,height:4320});
});
test('mobile caps the 8K request to the 4K pixel budget', () => {
 const size=renderSize({width:1920,height:1080,mobile:true});
 assert.deepEqual(size,{width:3840,height:2160});
});
test('a slower machine can reduce resolution without changing the UI or requested preset', () => {
 assert.deepEqual(renderSize({width:1920,height:1080,adaptiveScale:.5}),{width:3840,height:2160});
});
test('empty windows always produce valid nonzero dimensions', () => {
 const size=renderSize({width:0,height:0,limit:1});
 assert.deepEqual(size,{width:1,height:1});
});
function fakeGL(max=8,available=true) {
 const calls=[]; const ext={TEXTURE_MAX_ANISOTROPY_EXT:90,MAX_TEXTURE_MAX_ANISOTROPY_EXT:91};
 return {calls,TEXTURE_2D:1,TEXTURE_MAG_FILTER:2,TEXTURE_MIN_FILTER:3,LINEAR:4,LINEAR_MIPMAP_LINEAR:5,TEXTURE_MAX_LEVEL:6,
 texParameteri:(...a)=>calls.push(['int',...a]),generateMipmap:(...a)=>calls.push(['mips',...a]),
 texParameterf:(...a)=>calls.push(['float',...a]),getParameter:()=>max,getExtension:()=>available?ext:null};
}
test('world filtering uses trilinear mipmaps and clamps anisotropy to the device limit', () => {
 const gl=fakeGL(8); filterTexture(gl);
 assert.ok(gl.calls.some(c=>c.join(',')==='int,1,3,5'));
 assert.ok(gl.calls.some(c=>c.join(',')==='float,1,90,8'));
 assert.ok(gl.calls.some(c=>c[0]==='mips'));
});
test('strong devices are capped at 16x and ground atlas mip levels avoid distant tile bleeding', () => {
 const gl=fakeGL(32); filterTexture(gl,true,true);
 assert.ok(gl.calls.some(c=>c.join(',')==='float,1,90,16'));
 assert.ok(gl.calls.some(c=>c.join(',')==='int,1,6,3'));
});
test('devices without anisotropic filtering still render with standard filtering', () => {
 const gl=fakeGL(1,false); assert.doesNotThrow(()=>filterTexture(gl));
 assert.equal(gl.calls.filter(c=>c[0]==='float').length,0);
});
