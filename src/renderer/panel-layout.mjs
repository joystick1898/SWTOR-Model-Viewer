export function panelLayout(width,requested){
 const budget=Math.max(420,width-332);
 const safe=(value,fallback)=>Number.isFinite(value)?Math.max(0,Math.min(value,10000)):fallback;
 let left=Math.max(200,safe(requested.left,260)),right=Math.max(220,safe(requested.right,310));
 if(left+right>budget){
  const extra=Math.max(0,budget-420),weight=left-200+right-220;
  left=200+(weight?extra*(left-200)/weight:extra/2);right=budget-left;
 }
 return {left,right};
}
