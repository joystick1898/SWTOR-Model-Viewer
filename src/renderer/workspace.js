// Move existing controls into a stable workspace without changing their IDs or model behavior.
import {resizableAnimation} from './animation-panels.js';
export function organizeWorkspace(){
 const $=id=>document.getElementById(id),library=document.querySelector('.library'),inspector=document.querySelector('.inspector');
 const animation=document.createElement('section');animation.id='characterAnimation';animation.className='animationList';animation.setAttribute('aria-label','Character animations');
 const heading=document.createElement('h3');heading.textContent='Animations';animation.append(heading);
 for(const node of [$('search').previousElementSibling,$('search'),$('count'),$('clips'),$('clips').nextElementSibling])animation.append(node);
 const parts=$('parts').parentElement;const gear=$('gear');
 $('characterLibrary').replaceChildren($('designerPanel'));$('designerPanel').append(parts);
 const dock=document.createElement('section');dock.id='animationDock';dock.setAttribute('aria-label','Animation and pose');
 const browserAnimation=document.createElement('section');browserAnimation.id='browserAnimation';browserAnimation.className='animationList';browserAnimation.hidden=true;
 const browserHeading=document.createElement('h3');browserHeading.textContent='Animations';browserAnimation.append(browserHeading);
 for(const node of [$('assetAnimationSearch').previousElementSibling,$('assetAnimationSearch'),$('assetAnimationCount'),$('assetAnimation').previousElementSibling,$('assetAnimation')])browserAnimation.append(node);
 const playback=document.createElement('div');playback.className='animationPlayback';
 const settings=document.querySelector('.advancedPose');settings.id='designerAnimationSettings';
 playback.append(document.querySelector('.transport'),$('expressionPanel'),settings);
 dock.append(animation,browserAnimation,playback);document.querySelector('main').append(dock);
 const original=$('equipmentDialog'),columns=original.querySelector('.equipmentColumns'),catalog=columns.firstElementChild;
 const picker=document.createElement('section');picker.id='equipmentPicker';picker.hidden=true;
 const pickerHeader=document.createElement('div');pickerHeader.className='pickerHeader';
 const pickerHeading=document.createElement('h3');pickerHeading.id='equipmentPickerTitle';pickerHeading.textContent='Find equipment';
 $('equipmentClose').textContent='Back';pickerHeader.append(pickerHeading,$('equipmentClose'));picker.append(pickerHeader,catalog);library.append(picker);
 const panel=document.createElement('section');panel.id='equipmentDialog';panel.className='equipmentPanel';
 const panelHeader=original.querySelector('.equipmentHeader');$('equipmentOpen').textContent='Add item';panelHeader.append($('equipmentOpen'));
 const slotList=document.createElement('div');slotList.id='equipmentSlots';slotList.setAttribute('aria-label','Equipment slots');
 const attachments=document.createElement('div');attachments.id='attachmentItems';
 const selected=document.createElement('h3');selected.id='equipmentSelected';selected.textContent='Item details';
 const revert=document.createElement('button');revert.id='equipmentRevert';revert.textContent='Revert changes';revert.type='button';
 original.querySelector('.equipmentFooter').append(revert);
 panel.append(panelHeader,$('equipmentSummary'),gear,slotList,attachments,selected,$('equipmentLayers'),original.querySelector('.equipmentHelp'),original.querySelector('.equipmentFooter'));
 original.replaceWith(panel);inspector.append(panel);
 const live=document.createElement('details');live.id='liveAdjustments';const summary=document.createElement('summary');summary.textContent='Viewport adjustments';live.append(summary,$('equipmentLive'));panel.insertBefore(live,panel.querySelector('.equipmentHelp'));
 document.body.dataset.workspace='designer';
 resizableAnimation(dock);
}
