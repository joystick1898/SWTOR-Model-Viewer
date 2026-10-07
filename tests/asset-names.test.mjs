import test from 'node:test';
import assert from 'node:assert/strict';
import {nameAsset,filterAssets} from '../src/asset-names.mjs';
import {assetIndex,searchAssets} from '../src/asset-index.mjs';
import {config} from '../src/backend.mjs';

test('asset aliases preserve identity, filename search, categories and paging',()=>{
  const assets=Array.from({length:82},(_,i)=>nameAsset({id:`art/weapon/model_${i}.gr2`,name:`model_${i}`,category:'weapon'},{[`art/weapon/model_${i}.gr2`]:['First saber','Other saber']}));
  const page=filterAssets(assets,{query:'other saber',offset:80});
  assert.equal(page.total,82);assert.equal(page.items.length,2);assert.equal(page.items[0].name,'Other saber');
  assert.equal(page.items[0].fileName,'model_80');assert.equal(page.items[0].id,assets[80].id);
  assert.equal(filterAssets(assets,{query:'model_81'}).total,1);
  assert.equal(filterAssets(assets,{category:'creature'}).total,0);
  assert.equal(nameAsset({id:'art/unknown.gr2',name:'unknown'},{}).name,'unknown');
});

test('local asset names join Malgus and Senya without dropping models',async()=>{
  const all=await assetIndex(config.resources);
  assert.equal(new Set(all.map(a=>a.id)).size,all.length);
  const malgus=await searchAssets(config.resources,{query:'Darth Malgus'});
  assert.ok(malgus.items.some(a=>a.id.includes('bms_malgus')));
  const pike=await searchAssets(config.resources,{query:"Senya's Lightsaber Pike"});
  assert.ok(pike.items.some(a=>a.id.includes('dualsaber_mtx03_a02_v01')));
  for(const asset of pike.items)assert.ok(asset.fileName&&asset.aliases.includes("Senya's Lightsaber Pike"));
});
