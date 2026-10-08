import {panelLayout} from './panel-layout.mjs';
export function resizablePanels(){
 const main=document.querySelector('main'),left=document.querySelector('.library'),right=document.querySelector('.inspector');
 let sizes={left:260,right:310};try{const saved=JSON.parse(localStorage.getItem('panelWidths'));for(const side of ['left','right'])if(Number.isFinite(saved?.[side]))sizes[side]=saved[side];}catch{}
 const handles={};
 function layout(){
  const {left:l,right:r}=panelLayout(main.clientWidth,sizes);
  main.style.gridTemplateColumns=`${l}px 6px minmax(240px,1fr) 6px ${r}px`;
  for(const [side,value] of [['left',l],['right',r]]){handles[side]?.setAttribute('aria-valuenow',Math.round(value));}
 }
 for(const [side,panel] of [['left',left],['right',right]]){
  const handle=document.createElement('div');handle.className='panelDivider';handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-label',`Resize ${side} panel`);handle.title='Drag to resize · double-click to reset';handle.setAttribute('aria-valuemin',side==='left'?200:220);handles[side]=handle;
  handle.dataset.side=side;
  if(side==='left')panel.after(handle);else panel.before(handle);
  function resize(value){const other=side==='left'?'right':'left';sizes[side]=Math.max(side==='left'?200:220,Math.min(value,main.clientWidth-332-panelLayout(main.clientWidth,sizes)[other]));layout();}
  function save(){try{localStorage.setItem('panelWidths',JSON.stringify(sizes));}catch{}}
  handle.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();handle.setPointerCapture(e.pointerId);const start=e.clientX,width=panel.getBoundingClientRect().width;handle.classList.add('dragging');handle.onpointermove=m=>resize(width+(m.clientX-start)*(side==='left'?1:-1));};
  handle.onlostpointercapture=handle.onpointerup=handle.onpointercancel=()=>{handle.onpointermove=null;handle.classList.remove('dragging');save();};
  handle.ondblclick=()=>{sizes[side]=side==='left'?260:310;layout();save();};
  handle.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home'].includes(e.key))return;e.preventDefault();if(e.key==='Home')sizes[side]=side==='left'?260:310;else resize(panel.clientWidth+(e.key==='ArrowRight'?20:-20)*(side==='left'?1:-1));layout();save();};
 }
 new ResizeObserver(layout).observe(main);layout();
}
