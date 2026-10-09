import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDesigner} from '../src/designer.mjs';
import {validateEquipment} from '../src/equipment.mjs';
import {paletteChannel,appliedPalette} from '../src/renderer/palette-channel.js';

test('native controls survive designer and equipment validation with a wheel swatch',()=>{
 const colors={'*':{primary:'#ff0000',primaryPalette:{hue:.9,saturation:0,brightness:-.032,contrast:1.029}}};
 const expected=structuredClone(colors);expected['*'].primary='#FF0000';
 assert.deepEqual(validateDesigner({colors}).colors,expected);
 assert.deepEqual(validateEquipment([{item:'a'.repeat(24),bone:'@skin',colors}])[0].colors,expected);
 for(const n of [NaN,Infinity,-.1,1.1,'0.9',true])assert.throws(()=>validateDesigner({colors:{'*':{primaryPalette:{hue:n}}}}),/native palette/);
});
test('wheel and reset clear native overrides; fine tuning preserves swatch and other channel',()=>{
 const colors={};const channel=paletteChannel(()=>colors,'*','primary','Primary');
 channel.change('#FF0000');channel.changePalette({hue:.9});
 assert.equal(channel.read(),'#FF0000');assert.deepEqual(channel.readPalette(),{hue:.9});
 colors['*'].secondaryPalette={brightness:.1};
 channel.change('#00FF00');assert.deepEqual(channel.readPalette(),{});
 channel.change(null);assert.deepEqual(colors,{'*':{secondaryPalette:{brightness:.1}}});
});

test('piece editors preserve legacy whole-item appearance and reset without revealing its fallback',()=>{
 const colors={'*':{primary:'#FF0000',secondary:'#00FF00',primaryPalette:{hue:.9}},chest:{}};
 const chest=paletteChannel(()=>colors,'chest','primary','Primary',undefined,'*');
 const shoulder=paletteChannel(()=>colors,'shoulder','primary','Primary',undefined,'*');
 assert.equal(chest.read(),null); // Explicit empty piece record suppresses legacy whole-item colors.
 assert.equal(shoulder.read(),'#FF0000');
 shoulder.change(null);
 assert.equal(shoulder.read(),null);
 assert.deepEqual(colors.shoulder,{secondary:'#00FF00'});
 assert.equal(colors['*'].primary,'#FF0000');
 const secondary=paletteChannel(()=>colors,'shoulder','secondary','Secondary',undefined,'*');
 secondary.change(null);assert.deepEqual(colors.shoulder,{});assert.equal(shoulder.read(),null);
});

test('applied preview palettes distinguish material families and dye channels',()=>{
 const part={nativePalettes:[{family:'Garment',palettes:{1:[.898,0,-.032,1.029],2:[1,.5,0,1]}},{family:'SkinB',palettes:{1:[.2,.4,.1,1.1]}}]};
 assert.deepEqual(appliedPalette(part,'primary'),{hue:.898,saturation:0,brightness:-.032,contrast:1.029});
 assert.deepEqual(appliedPalette([part],'primary','SkinB'),{hue:.2,saturation:.4,brightness:.1,contrast:1.1});
 assert.equal(appliedPalette(part,'secondary').hue,1);
 assert.deepEqual(appliedPalette(null,'primary'),{});
});

test('invalid color dictionaries cannot alter preset object prototypes',()=>{
 for(const colors of [[],{chest:[]},JSON.parse('{"__proto__":{"primary":"#FF0000"}}')])assert.throws(()=>validateDesigner({colors}),/Invalid piece color/);
});
