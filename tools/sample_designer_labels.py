import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from runtime_paths import DATA, PROJECT, setting
import bpy,json,colorsys,numpy as np
from pathlib import Path
p=(DATA/'designer/labels.json');data=json.loads(p.read_text());cache={}
colors={'Black':'171717','White':'eeeeee','Gray':'888888','Dark brown':'493025','Brown':'815335','Tan':'b99068','Beige':'d7bb98','Peach':'edb09c','Red':'c33d3d','Orange':'cf8135','Gold':'c8b046','Green':'448e48','Teal':'398b80','Blue':'437ab8','Violet':'8865b8','Pink':'c887a6'}
def rgb(h):return [int(h[i:i+2],16)/255 for i in (0,2,4)]
for e in data.values():
 if 'paletteMap' not in e:continue
 file=e['paletteMap']
 if file not in cache:
  image=bpy.data.images.load(file,check_existing=True);pixels=np.array(image.pixels[:]).reshape(-1,4);cache[file]=np.median(pixels,axis=0)
 m=cache[file];h,s,b,c=e['palette'];skin=e['family']=='SkinB'
 if skin:h=(h-.5+m[1])%1;s=np.clip(m[2]+.5-s,0,1);light=m[3]
 else:h=(h+m[1]*(.706-.3137)+.3137-.41176)%1;s=(1-s)*max(.00001,m[2]*.5882)**s;light=m[3]*.70588
 base=c*max(0,light)**c;light=np.clip(base*(1-b)+b,0,1)
 linear=colorsys.hls_to_rgb(h,float(light),float(np.clip(s,0,1)));color=[float(np.clip(12.92*v if v<=.0031308 else 1.055*v**(1/2.4)-.055,0,1)) for v in linear]
 e['swatch']='#'+''.join(f'{round(v*255):02X}' for v in color)
 label=min(colors,key=lambda k:sum((a-z)**2 for a,z in zip(color,rgb(colors[k]))))
 e['label']=label+' Â· '+e['label'];e['swatchMethod']='Representative native palette-map sample; approximate texture color'
p.write_text(json.dumps(data),encoding='utf-8');print('SAMPLED',sum('swatch' in e for e in data.values()))
