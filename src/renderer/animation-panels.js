export function resizableAnimation(dock){
 const sizes={height:innerHeight<=800?175:205,width:innerWidth<=1200?260:310};
 const defaults={...sizes};
 try{const saved=JSON.parse(localStorage.getItem('animationPanelSizes'));for(const key of Object.keys(sizes))if(Number.isFinite(saved?.[key]))sizes[key]=saved[key];}catch{}
 const handles={};
 const limits=()=>({height:[140,Math.max(140,innerHeight-document.querySelector('header').offsetHeight-220)],width:[200,Math.max(200,dock.clientWidth-300)]});
 function layout(){
  const bounds=limits();
  for(const key of Object.keys(sizes)){
   const [min,max]=bounds[key],value=Math.max(min,Math.min(max,sizes[key]));
   dock.style.setProperty(key==='height'?'--animation-height':'--animation-width',value+'px');
   handles[key].setAttribute('aria-valuemin',min);handles[key].setAttribute('aria-valuemax',max);handles[key].setAttribute('aria-valuenow',Math.round(value));
  }
 }
 function save(){try{localStorage.setItem('animationPanelSizes',JSON.stringify(sizes));}catch{}}
 for(const key of Object.keys(sizes)){
  const vertical=key==='height',handle=document.createElement('div');handles[key]=handle;
  handle.className='animationDivider '+(vertical?'animationHeightDivider':'animationWidthDivider');handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-orientation',vertical?'horizontal':'vertical');handle.setAttribute('aria-label',vertical?'Resize animation bar':'Resize animation list');handle.title='Drag to resize · double-click to reset';
  if(vertical)dock.before(handle);else dock.querySelector('.animationPlayback').before(handle);
  const change=value=>{const [min,max]=limits()[key];sizes[key]=Math.max(min,Math.min(max,value));layout();};
  handle.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();handle.setPointerCapture(e.pointerId);const start=vertical?e.clientY:e.clientX,value=Number(handle.getAttribute('aria-valuenow'));handle.classList.add('dragging');handle.onpointermove=m=>change(value+(vertical?start-m.clientY:m.clientX-start));};
  handle.onlostpointercapture=handle.onpointerup=handle.onpointercancel=()=>{handle.onpointermove=null;handle.classList.remove('dragging');save();};
  handle.ondblclick=()=>{change(defaults[key]);save();};
  handle.onkeydown=e=>{const decrease=vertical?'ArrowDown':'ArrowLeft',increase=vertical?'ArrowUp':'ArrowRight';if(![decrease,increase,'Home'].includes(e.key))return;e.preventDefault();change(e.key==='Home'?defaults[key]:Number(handle.getAttribute('aria-valuenow'))+(e.key===increase?20:-20));save();};
 }
 new ResizeObserver(layout).observe(dock);addEventListener('resize',layout);layout();
}
