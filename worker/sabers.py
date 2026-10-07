"""Portable saber blades using native GR2 attachment transforms."""
import struct,re,math,hashlib,xml.etree.ElementTree as ET
from functools import lru_cache
from pathlib import Path
import bpy,numpy as np
from mathutils import Matrix,Vector,Euler

def sockets(file,all_names=False):
 b=file.read_bytes();v=struct.unpack_from('<I',b,4)[0]
 count=struct.unpack_from('<H',b,30)[0];wide=v==5
 off=struct.unpack_from('<Q' if wide else '<I',b,112 if wide else 100)[0]
 stride=80 if wide else 72;ptr=8 if wide else 4;result=[]
 if off+count*stride>len(b):raise ValueError('Invalid GR2 attachment table')
 for i in range(count):
  p=off+i*stride;n=struct.unpack_from('<Q' if wide else '<I',b,p)[0]
  name=b[n:b.index(0,n)].decode('ascii')
  if all_names or re.fullmatch(r'fx_saber(?:_?\d+|_right|_left|_guard_[a-z])?',name):
   values=struct.unpack_from('<16f',b,p+ptr*2)
   result.append((name,Matrix([values[j:j+4] for j in range(0,16,4)]).transposed()))
 return result

@lru_cache(maxsize=1)
def effect_files(root):
 return sorted((root/'art/fx/fxspec').rglob('*.fxspec'))

@lru_cache(maxsize=512)
def matching_effects(root,stem):
 return tuple(p for p in effect_files(root) if p.stem==stem or p.stem.endswith('_'+stem))

@lru_cache(maxsize=512)
def effect_rows(file):
 return tuple({f.get('name'):f.text or '' for f in e.findall('f')} for e in ET.fromstring(file.read_bytes()).iter('e'))

@lru_cache(maxsize=512)

def emitters(file,category,root):
 points=sockets(file);names={n for n,m in points};scales={}
 candidates=matching_effects(root,file.stem)
 for p in candidates:
  for d in effect_rows(p):
   name=d.get('_fxAttachBone');resource=d.get('_fxResourceName','').lower()
   if name in names and 'saber' in resource and ('core' in resource or 'blade_alpha' in resource) and ('guard' in name or d.get('_fxStartFxName') in ('lightsaber_loop','lightsaber_instant_on')):
    scale=[float(v) for v in d.get('_fxScale','(1,1,1)').strip('()').split(',')]
    scales[name]=min(scales.get(name,1),scale[1])
 if scales:
  main=next((m for n,m in points if n in scales and 'guard' not in n),None)
  if main is not None:
   axis=(main.to_3x3()@Vector((0,1,0))).normalized()
   guard_scale=next((v for n,v in scales.items() if 'guard' in n),.15)
   for n,m in points:
    # Some dual-hilt FX files name only one pair; retain the other authored transverse emitters.
    if category=='dualsaber' and 'guard' in n and n not in scales and abs(axis.dot((m.to_3x3()@Vector((0,1,0))).normalized()))<.9:scales[n]=guard_scale
  return [(n,m,scales[n]) for n,m in points if n in scales]
 # Duplicate legacy aliases coexist with corrected numbered sockets in newer GR2s.
 if category=='dualsaber':
  preferred=['fx_saber_01','fx_saber_02'] if {'fx_saber_01','fx_saber_02'}<=names else ['fx_saber01','fx_saber02']
  if set(preferred)<=names:points=[(n,m) for n,m in points if n in preferred or 'guard' in n]
 elif 'fx_saber' in names:points=[(n,m) for n,m in points if n=='fx_saber' or 'guard' in n]
 return [(n,m,.15 if 'guard' in n else 1) for n,m in points]

@lru_cache(maxsize=512)
def effect_components(file,root):
 """Assemble persistent native weapon FX meshes at their extended pose."""
 result=[];seen=set();attachments=dict(sockets(file,all_names=True))
 for p in matching_effects(root,file.stem):
  rows=effect_rows(p)
  nodes={d['_fxName']:dict(d) for d in rows if d.get('_fxName') and d.get('_fxResourceName')}
  for d in rows:
   if 'shaft_extend' not in d.get('_fxStartFxName',''):continue
   target=nodes.get(d.get('_fxAssetName'))
   if target is None:continue
   for field in ['Position','Rotation','Scale']:
    if d.get('_trIgnore'+field)=='false' and d.get('_trTarget'+field):target['_fxAttach'+field if field!='Scale' else '_fxScale']=d['_trTarget'+field]
  def vec(value,default):return [float(x) for x in (value or default).strip('()').split(',')]
  def transform(name,visited=()):
   if name in visited:raise ValueError('Cyclic weapon effect attachment')
   d=nodes[name];parent=d.get('_fxAttachTo');base=transform(parent,visited+(name,)) if parent in nodes else attachments.get(d.get('_fxAttachBone'),Matrix.Identity(4))
   position=Matrix.Translation(vec(d.get('_fxAttachPosition'),'(0,0,0)'))
   rotation=Euler([math.radians(x) for x in vec(d.get('_fxAttachRotation'),'(0,0,0)')],'XYZ').to_matrix().to_4x4()
   scale=Matrix.Diagonal(vec(d.get('_fxScale'),'(1,1,1)')+[1])
   return base@position@rotation@scale
  for name,d in nodes.items():
   relative=d['_fxResourceName'].replace('\\','/').lstrip('/')
   if not relative.endswith('.gr2') or not Path(relative).stem.startswith(file.stem+'_'):continue
   if '..' in Path(relative).parts or not (root/relative).is_file():continue
   matrix=transform(name)
   # Mirrored emitters reuse one mesh at distinct placements. Deduplicate only
   # identical instances repeated by the loop/instant-on effect definitions.
   instance=(relative,tuple(round(v,7) for row in matrix for v in row))
   if instance in seen:continue
   seen.add(instance);result.append((relative,matrix))
 return result

@lru_cache(maxsize=512)
def native_effect(file,root):
 for p in matching_effects(root,file.stem):
  if 'unstable_saber' in p.read_text(encoding='utf-16-le'):return 'unstable'
 return 'standard'

def material(pipeline,color,channel,effect,intensity=1.5):
 key='saber-v3-'+channel+'-'+color[1:]+'-'+effect+'-'+str(intensity);folder=pipeline.cache/key;folder.mkdir(exist_ok=True)
 files={k:folder/(key+'-'+k+'.png') for k in ['base','normal','emission']}
 w,h=8,8;alpha=np.ones((h,w),dtype=np.float32)
 rgb=np.array([int(color[i:i+2],16)/255 for i in (1,3,5)])
 for kind,file in files.items():
  if not file.exists():
   a=np.ones((h,w,4),dtype=np.float32);a[:,:,:3]=[.5,.5,1] if kind=='normal' else rgb;a[:,:,3]=1 if kind=='normal' else alpha
   im=bpy.data.images.new(key+kind,width=w,height=h,alpha=True);im.pixels.foreach_set(a.ravel());im.filepath_raw=str(file);im.file_format='PNG';im.save();bpy.data.images.remove(im)
 mat=bpy.data.materials.new('Saber '+channel+' '+color+' '+effect);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');links=mat.node_tree.links
 for kind,socket in [('base','Base Color'),('emission','Emission Color')]:
  tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(files[kind]),check_existing=True);links.new(tex.outputs['Color'],bs.inputs[socket])
  if kind=='base':links.new(tex.outputs['Alpha'],bs.inputs['Alpha'])
 tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(files['normal']),check_existing=True);tex.image.colorspace_settings.name='Non-Color';normal=mat.node_tree.nodes.new('ShaderNodeNormalMap');links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bs.inputs['Normal'])
 bs.inputs['Emission Strength'].default_value=intensity;bs.inputs['Specular IOR Level'].default_value=0;bs.inputs['Roughness'].default_value=1;mat['saberIntensity']=intensity
 mat.surface_render_method='DITHERED';mat.use_backface_culling=False;mat['gltf_alpha_mode']='BLEND' if channel=='glow' else 'OPAQUE'
 pipeline.materials[key]=mat;pipeline.records.append(dict(name=mat.name,family='Saber',textures={k:str(v) for k,v in files.items()},alphaMode='blend' if channel=='glow' else 'opaque',saberChannel=channel,saberEffect=effect,saberIntensity=intensity,roughness=1,specular=0,alphaCutoff=0))
 return mat

def estimated_emitters(hilt,category):
 # Geometry-only legacy hilts use X, Y or Z as their long axis.
 # Keep estimates in mesh-local space, as with native attachment matrices.
 bounds=[(min(v.co[i] for v in hilt.data.vertices),max(v.co[i] for v in hilt.data.vertices)) for i in range(3)]
 axis=max(range(3),key=lambda i:bounds[i][1]-bounds[i][0])
 center=Vector([(lo+hi)/2 for lo,hi in bounds])
 points=[]
 for name,end,sign in [('estimated_front',bounds[axis][0],-1)]+([('estimated_back',bounds[axis][1],1)] if category=='dualsaber' else []):
  position=center.copy();position[axis]=end
  direction=Vector((0,0,0));direction[axis]=sign
  rotation=Vector((0,1,0)).rotation_difference(direction).to_matrix().to_4x4()
  points.append((name,Matrix.Translation(position)@rotation,1))
 return points

def manual_emitters(hilt,points,settings):
 """Explicit layouts on every hilt; offsets use the main emitter's XYZ frame."""
 main=next((m for n,m,s in points if 'guard' not in n),None)
 if main is None:main=estimated_emitters(hilt,'saber')[0][1]
 frame=Matrix.Translation(main.translation)@main.to_quaternion().to_matrix().to_4x4()
 inverse=frame.inverted();vertices=[inverse@v.co for v in hilt.data.vertices]
 bottom_y=min(v.y for v in vertices)
 half_width=max(.001,min(.005,max(abs(v.z) for v in vertices)))
 guard_y=-min(.005,abs(bottom_y)*.2)
 bases={'single':(Vector((0,0,0)),Vector((0,1,0))), 'dual':(Vector((0,bottom_y,0)),Vector((0,-1,0)))}
 # Native rear emitters are useful starting positions, but never gate a toggle.
 for n,m,s in points:
  direction=(inverse.to_3x3()@m.to_3x3()@Vector((0,1,0))).normalized()
  if 'guard' not in n and direction.y<-.9:
   bases['dual']=(inverse@m.translation,Vector((0,-1,0)));break
 for group in ['straight','diagonal']:
  for side,sign in [('Left',-1),('Right',1)]:
   direction=Vector((0,math.tan(math.radians(30)) if group=='diagonal' else 0,-sign)).normalized()
   bases[group+side]=(Vector((0,guard_y,-sign*half_width)),direction)
 result=[]
 for key,(origin,direction) in bases.items():
  group='straight' if key.startswith('straight') else 'diagonal' if key.startswith('diagonal') else key
  if not settings['layout'].get(group):continue
  element=dict(settings['elements'][key])
  center=Vector((0,guard_y,0)) if group in ('straight','diagonal') else origin
  element['_liveFrame']=frame@Matrix.Translation(center)
  position=origin+Vector(element['position'])/1000
  rotation=Euler([math.radians(v) for v in element['rotation']],'XYZ').to_matrix().to_4x4()
  aim=Vector((0,1,0)).rotation_difference(direction).to_matrix().to_4x4()
  if group in ('straight','diagonal'):
   center=Vector((0,guard_y,0))
   matrix=frame@Matrix.Translation(center+Vector(element['position'])/1000)@rotation@Matrix.Translation(origin-center)@aim
  else:matrix=frame@Matrix.Translation(position)@rotation@aim
  result.append((key,matrix,element))
 return result

def blades(entry,relative,source,pipeline,hilt):
 settings=entry.get('blade')
 if not settings or not settings['enabled']:return []
 points=emitters(source,entry['category'],pipeline.resources)
 if not points:
  # Old geometry-only hilts contain no emitter table. Bounds supply an explicit fallback.
  entry.setdefault('warnings',[]).append('Blade emitter estimated from hilt bounds: '+relative)
  points=estimated_emitters(hilt,entry['category'])
 if entry['category']=='dualsaber' and settings.get('spacing'):
  main=[m.translation for n,m,_ in points if 'guard' not in n]
  if len(main)==2:
   center=(main[0]+main[1])/2
   adjusted=[]
   for n,m,scale in points:
    matrix=m.copy();direction=matrix.translation-center
    if direction.length>1e-8:matrix.translation+=direction.normalized()*(settings['spacing']/2000)
    adjusted.append((n,matrix,scale))
   points=adjusted
 # Native persistent artwork replaces brightness-only approximations. Keep a
 # geometric fallback for incomplete/offline resource installations.
 from saber_ribbons import build as build_ribbons
 ribbons=build_ribbons(entry,source,pipeline,hilt,points,manual_emitters,matching_effects(pipeline.resources,source.stem),dict(sockets(source,all_names=True))) if source.is_file() else []
 if ribbons:return ribbons
 entry.setdefault('warnings',[]).append('Native blade artwork unavailable; using a smooth static fallback.')
 effect='standard'
 result=[]
 elements=manual_emitters(hilt,points,settings) if settings.get('layout') is not None else [(n,m,{**settings,'length':settings['length']*s}) for n,m,s in points]
 for name,matrix,element in elements:
  length=element['length']/1000
  for channel,factor in [('core',1),('glow',4)]:
   width=element['width']/1000*factor
   radius=min(width/2,length/2)
   # Keep the core endpoint fixed; carry the wider glow cap beyond it.
   # A shared endpoint makes the halo fade out before the bright core tip.
   tip_extension=radius if channel=='glow' else 0
   shell_length=length+tip_extension
   bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=radius)
   obj=bpy.context.object;obj.name='equipment_'+str(entry['layer'])+'_blade_'+name+'_'+channel
   for v in obj.data.vertices:
    v.co.z+=(1 if v.co.z>=0 else -1)*max(0,shell_length/2-radius)
    v.co.z+=shell_length/2
    v.co=matrix@Vector((v.co.x,v.co.z,-v.co.y))
   for face in obj.data.polygons:face.use_smooth=True
   obj.data.update();obj.data.materials.append(material(pipeline,element[channel],channel,effect,element.get('intensity',1.5)));obj['saberChannel']=channel;obj['saberEffect']=effect;obj['saberElement']=name
   obj['saberMatrix']=[v for row in matrix for v in row]
   if '_liveFrame' in element:obj['saberFrame']=[v for row in element['_liveFrame'] for v in row]
   obj['saberLength']=element['length'];obj['saberWidth']=element['width'];obj['saberRadius']=radius;obj['saberRadiusFactor']=factor/2;obj['saberTipExtension']=channel=='glow'
   result.append(obj)
 return result
