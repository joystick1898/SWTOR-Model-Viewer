import fs from 'node:fs/promises';
import {convert,defaultState,designerOptions} from '../src/backend.mjs';
const options=await designerOptions({species:'rattataki',body:'bfa'});const designer=options.designer;
if(options.groups.appSlotHead?.[13])designer.choices.appSlotHead=options.groups.appSlotHead[13].id;
const state={...defaultState,version:2,character:'native-designer',designer,clip:'cb_2saber_attack_right_1.jba'};
const preview=await convert(state);await fs.writeFile('reports/stretch-pipeline-smoke.json',JSON.stringify({results:[{id:'rattataki-bfa',exported:{state}}],source:preview.sourceAnimationProfile,parts:preview.parts.length},null,2));console.log(preview.sourceAnimationProfile,preview.parts.length);
