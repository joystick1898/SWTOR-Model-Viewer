import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {bindSaberMesh} from '../src/renderer/live-saber.js';
import {editableBlade,elementDefaults} from '../src/saber-layout.mjs';
import {validateBlade} from '../src/equipment.mjs';

test('crossguard defaults apply to new elements without overwriting saved offsets',()=>{
 const blade=editableBlade({enabled:true});
 for(const side of ['Left','Right']){
  assert.deepEqual(blade.elements['straight'+side].position,[0,2,0]);
  assert.deepEqual(blade.elements['diagonal'+side].position,[0,-.3,0]);
 }
 blade.elements.straightLeft.position=[1,7,3];
 assert.deepEqual(validateBlade(editableBlade(blade)).elements.straightLeft.position,[1,7,3]);
 assert.deepEqual(elementDefaults(blade,'straightLeft').position,[0,2,0]);
});

test('live blade dimensions preserve capsule tips, thickness, and independent offsets without drift',()=>{
 const blade=editableBlade({enabled:true});blade.elements.single.length=100;blade.elements.single.width=2;
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0,.1,0,.001,.001,0,.001,.099,0],3));
 const mesh=new THREE.Mesh(geometry);const identity=new THREE.Matrix4().elements;
 const edit=bindSaberMesh(mesh,{element:'single',matrix:identity,frame:identity,length:100,width:2,radius:.001,radiusFactor:.5,radiusScale:1},blade);
 const next=structuredClone(blade);next.elements.single.length=150;next.elements.single.width=4;next.elements.single.position=[0,2,0];
 edit.update(next);
 const p=geometry.attributes.position;
 assert(Math.abs(p.getY(1)-.15)<1e-7);assert(Math.abs(p.getX(2)-.002)<1e-7);assert(Math.abs(p.getY(2)-.002)<1e-7);assert.equal(mesh.matrix.elements[13],.002);
 edit.update(blade);edit.update(next);assert(Math.abs(p.getY(1)-.15)<1e-7);
 assert.equal(validateBlade(next).elements.single.width,4);
});
