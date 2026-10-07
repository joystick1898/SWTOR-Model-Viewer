export function hexToHsl(hex){
  if(!/^#[\da-f]{6}$/i.test(hex))throw Error('Enter a six-digit hex color, such as #8040C0');
  const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;
  let h=0;if(d)h=((max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4)/6);
  return [h,d?d/(1-Math.abs(2*l-1)):0,l];
}
export function hueToHex(h){
  const channel=n=>{const k=(n+h*12)%12;return Math.round(255*(.5-.5*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');};
  return '#'+channel(0)+channel(8)+channel(4);
}
