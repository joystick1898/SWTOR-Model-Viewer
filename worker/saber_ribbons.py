"""Native artwork around continuous solid cores, with normalized radial overlays."""
import hashlib,json,math
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector,Matrix,Euler
from materials import save_texture
from saber_effects import native_layers,preset,effect_rows,scalar

def attachment_matrix(source,layer,sockets):
    rows=effect_rows(layer['effectFile'])
    nodes={r['_fxName']:dict(r) for r in rows if r.get('_fxName') and r.get('_fxResourceName')}
    # Sample the fully extended state, without importing transition effects.
    for row in rows:
        if row.get('_fxStartFxName') not in ('lightsaber_instant_on','lightsaber_shaft_extend','lightsaber_loop_vent_01','lightsaber_loop_vent_02'):continue
        node=nodes.get(row.get('_fxAssetName'))
        if node is None:continue
        for field in ('Position','Rotation','Scale'):
            if row.get('_trIgnore'+field)=='false' and row.get('_trTarget'+field):
                node['_fxScale' if field=='Scale' else '_fxAttach'+field]=row['_trTarget'+field]
    def vec(s,default):return [float(v) for v in (s or default).strip('()').split(',')]
    def resolve(row,visited=()):
        parent=row.get('_fxAttachTo');bone=row.get('_fxAttachBone')
        if parent in visited:raise ValueError('Cyclic saber attachment')
        if parent in nodes:base=resolve(nodes[parent],visited+(parent,))
        elif bone in sockets:base=sockets[bone]
        else:raise ValueError('Unresolved saber attachment: '+str(bone or parent))
        return base@Matrix.Translation(vec(row.get('_fxAttachPosition'),'(0,0,0)'))@Euler([math.radians(v) for v in vec(row.get('_fxAttachRotation'),'(0,0,0)')],'XYZ').to_matrix().to_4x4()@Matrix.Diagonal(vec(row.get('_fxScale'),'(1,1,1)')+[1])
    return resolve(layer['attachment'])

def material(pipeline,layer,element,settings):
    source=Path(pipeline.resources)/layer['texture']
    frame=int(settings.get('frame',0))%(layer['columns']*layer['rows'])
    animated=settings.get('motion','static')=='animated'
    data={k:layer[k] for k in ('columns','rows','fps','direction','channel','blend','texture','source')}
    data['nativeBlend']=layer['blend']
    # Emissive overlays must not paint dark sprite backgrounds over the core.
    # Original blend settings remain in the source metadata.
    data['blend']='additive'
    data.update(frame=frame,animated=animated,intensity=element.get('intensity',1.5))
    color=element[layer['channel']]
    style='tau' if 'tau_' in layer['source'] else 'nul' if 'nul_' in layer['source'] else settings.get('effect','native')
    data.update(base=layer.get('base',False),baseColor=element['glow'] if style=='tau' else color,tau=style=='tau')
    if data['base']:data['animated']=False
    key='saber-fx-v9-'+hashlib.sha256(json.dumps([data,style,element['core'],element['glow'],source.stat().st_mtime_ns],sort_keys=True).encode()).hexdigest()[:20]
    if key in pipeline.materials:return pipeline.materials[key]
    folder=pipeline.cache/key;folder.mkdir(exist_ok=True)
    texture=folder/(key+'.png');normal=folder/(key+'-normal.png')
    original=bpy.data.images.load(str(source),check_existing=True);w,h=original.size
    if not texture.exists():
        pixels=np.empty(w*h*4,dtype=np.float32);original.pixels.foreach_get(pixels);pixels=pixels.reshape(h,w,4)
        tint=np.array([int(color[i:i+2],16)/255 for i in (1,3,5)])
        tint=np.where(tint<=.04045,tint/12.92,((tint+.055)/1.055)**2.4)
        # DDS byte pixels are encoded sRGB. Decode before applying a linear tint;
        # save_texture encodes once. Alpha is preserved without gamma conversion.
        rgb=pixels[:,:,:3].copy()
        if layer['channel']=='core':
            glow=np.array([int(element['glow'][i:i+2],16)/255 for i in (1,3,5)])
            glow=np.where(glow<=.04045,glow/12.92,((glow+.055)/1.055)**2.4)
            core_weight=np.clip((rgb.max(axis=2,keepdims=True)-.55)/.35,0,1)
            tint=glow*(1-core_weight)+tint*core_weight
            if style=='tau':tint=glow
        pixels[:,:,:3]=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)*tint
        if data['base']:
            base=np.array([int(data['baseColor'][i:i+2],16)/255 for i in (1,3,5)])
            pixels[:,:,:3]=np.where(base<=.04045,base/12.92,((base+.055)/1.055)**2.4)
            pixels[:,:,3]=1
        if style=='tau':
            # Explicit persistent color ramp: every selected crystal color ends
            # in white. Work in each atlas cell, in Blender's bottom-up order.
            along=(np.arange(h)%(h//layer['rows']))/max(1,h//layer['rows']-1)
            white=np.clip((along-.35)/.55,0,1)[:,None,None]**1.5
            energy=1 if data['base'] else np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4).max(axis=2,keepdims=True)
            pixels[:,:,:3]=pixels[:,:,:3]*(1-white)+energy*white
        image=bpy.data.images.new(key,width=w,height=h,alpha=True,float_buffer=True);image.pixels.foreach_set(pixels.ravel());save_texture(image,texture);bpy.data.images.remove(image)
    if not normal.exists():
        image=bpy.data.images.new(key+'normal',width=1,height=1,alpha=True,float_buffer=True);image.pixels.foreach_set([.5,.5,1,1]);save_texture(image,normal,linear=True);bpy.data.images.remove(image)
    mat=bpy.data.materials.new('Saber FX '+key[-20:]);mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF');tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(texture),check_existing=True)
    for slot in ('Base Color','Emission Color'):mat.node_tree.links.new(tex.outputs['Color'],bs.inputs[slot])
    mat.node_tree.links.new(tex.outputs['Alpha'],bs.inputs['Alpha']);bs.inputs['Emission Strength'].default_value=data['intensity'];bs.inputs['Roughness'].default_value=1;bs.inputs['Specular IOR Level'].default_value=0
    mat.surface_render_method='DITHERED';mat.use_backface_culling=False;mat['gltf_alpha_mode']='BLEND';mat['saberFX']=json.dumps(data)
    files={'base':str(texture),'emission':str(texture),'normal':str(normal)}
    pipeline.materials[key]=mat
    pipeline.records.append(dict(name=mat.name,family='SaberFX',textures=files,textureDimensions={'base':[w,h],'emission':[w,h],'normal':[1,1]},alphaMode=data['blend'],saberFX=data,saberEffect=settings.get('effect','native'),saberChannel=layer['channel'],saberIntensity=data['intensity'],roughness=1,specular=0,sourceTexture=layer['texture'],sourceParticle=layer['source'],nativeParticle=layer['native'],effectApproximation=layer['approximation']))
    return mat

def ribbon(entry,name,matrix,element,layer,pipeline,index):
    settings=entry['blade'];length=element['length']/1000;thickness=element['width']/1000
    # Normalize artist-authored sprite width around the familiar blade controls.
    native=layer['native'];ratio=scalar(native.get('XScale2D'),.1)/max(.01,scalar(native.get('YScale2D'),.5))
    width=thickness*max(3,min(16,ratio*60))
    if layer['short']:
        if settings.get('effect')!='vented':length*=.18
        width=max(width,thickness*8)
    if 'nul_' in layer['source']:width*=.45 if layer['channel']=='glow' else .7
    cols,rows=layer['columns'],layer['rows'];frame=int(settings.get('frame',0))%(cols*rows)
    ox=(frame%cols)/cols;oy=1-(frame//cols+1)/rows
    vertices=[];faces=[];uvs=[]
    sections=5 if layer['short'] and settings.get('effect')=='vented' else 1
    for section in range(sections):
        for i in range(6):
            angle=i*math.pi/6
            side=Vector((math.cos(angle),0,math.sin(angle)))*width/2
            start=len(vertices)
            for x,y in [(-1,-.1),(1,-.1),(1,1.1),(-1,1.1)]:vertices.append(matrix@(side*x+Vector((0,(section+y)*length/sections,0))))
            faces.append(tuple(range(start,start+4)))
            uvs.extend([(ox,oy),(ox+1/cols,oy),(ox+1/cols,oy+1/rows),(ox,oy+1/rows)])
    mesh=bpy.data.meshes.new('Native saber artwork');mesh.from_pydata(vertices,[],faces);mesh.update()
    uv=mesh.uv_layers.new(name='UVMap')
    for i,coord in enumerate(uvs):uv.data[i].uv=coord
    obj=bpy.data.objects.new('equipment_'+str(entry['layer'])+'_blade_'+name+'_'+layer['channel']+'_'+str(index),mesh);bpy.context.scene.collection.objects.link(obj)
    mesh.materials.append(material(pipeline,layer,element,settings));obj['saberChannel']=layer['channel'];obj['saberElement']=name
    return obj

def solid_core(entry,name,matrix,element,layer,pipeline):
    # A real emissive capsule supplies a continuous core at every camera angle.
    length=element['length']/1000
    radius=min(element['width']/1000*.3,length/2)
    if 'nul_' in layer['source']:radius*=.7
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=radius)
    obj=bpy.context.object;obj.name='equipment_'+str(entry['layer'])+'_blade_'+name+'_solid_core'
    cols,rows=layer['columns'],layer['rows'];frame=int(entry['blade'].get('frame',0))%(cols*rows)
    ox=(frame%cols)/cols;oy=1-(frame//cols+1)/rows
    for vertex in obj.data.vertices:
        vertex.co.z+=(1 if vertex.co.z>=0 else -1)*max(0,length/2-radius)
        vertex.co.z+=length/2
    uv=obj.data.uv_layers.active
    for loop in obj.data.loops:
        uv.data[loop.index].uv=(ox+.5/cols,oy+obj.data.vertices[loop.vertex_index].co.z/length/rows)
    for vertex in obj.data.vertices:vertex.co=matrix@Vector((vertex.co.x,vertex.co.z,-vertex.co.y))
    for face in obj.data.polygons:face.use_smooth=True
    obj.data.update();obj.data.materials.append(material(pipeline,{**layer,'base':True},element,entry['blade']))
    obj['saberChannel']='core';obj['saberElement']=name
    return obj

def build(entry,source,pipeline,hilt,points,manual,files,sockets):
    settings=entry['blade'];family=settings.get('effect','native');diagnostics=[]
    # Pulsing remains a legacy save alias; the new UI separates family and motion.
    if family=='pulsing':family='standard'
    authored=native_layers(pipeline.resources,files,diagnostics if family=='native' else []) if family=='native' or settings.get('layout') is None else []
    native=authored if family=='native' else []
    result=[]
    if settings.get('layout') is not None:
        elements=manual(hilt,points,settings)
    else:
        elements=[(n,m,{**settings,'length':settings['length']*s}) for n,m,s in points]
        # Resolve actual vent socket hierarchies, including fully extended dummies.
        existing={n for n,_,_ in elements}
        for layer in authored:
            row=layer['attachment'];bone=row.get('_fxAttachBone','');parent=row.get('_fxAttachTo','')
            if 'vent' not in bone or not parent.startswith('dummy_vent_blade'):continue
            name=parent
            if name in existing:continue
            try:
                matrix=attachment_matrix(source,layer,sockets)
                scale=matrix.to_scale().y
                matrix=Matrix.Translation(matrix.translation)@matrix.to_quaternion().to_matrix().to_4x4()
                elements.append((name,matrix,{**settings,'length':settings['length']*scale}));existing.add(name)
            except ValueError as error:diagnostics.append(str(error))
    for name,matrix,element in elements:
        guard=any(x in name.lower() for x in ('guard','vent','straight','diagonal'))
        selected=[]
        if native:
            for layer in native:
                row=layer['attachment'];bone=row.get('_fxAttachBone','');parent=row.get('_fxAttachTo','')
                if name.startswith('dummy_vent_blade'):
                    if parent==name:selected.append(layer)
                elif settings.get('layout') is None:
                    if bone==name and parent in ('TARGET','CASTER'):selected.append(layer)
                elif bone:
                    is_guard=any(x in (bone+' '+parent).lower() for x in ('guard','vent'))
                    if is_guard==guard:selected.append(layer)
            if settings.get('layout') is not None and guard and not any(l['channel']=='core' for l in selected):
                selected=[l for l in native if l['attachment'].get('_fxAttachBone') and not any(x in l['attachment'].get('_fxAttachBone','') for x in ('guard','vent'))]
        if not any(l['channel']=='core' and not l['short'] for l in selected):
            selected=preset(pipeline.resources,family if family!='native' else 'standard',guard,diagnostics)+selected
        unique={}
        for layer in selected:unique.setdefault((layer['texture'],layer['short']),layer)
        core=next((l for l in unique.values() if l['channel']=='core' and not l['short']),None)
        generated=[]
        if core:
            obj=solid_core(entry,name,matrix,element,core,pipeline)
            obj['saberRadius']=min(element['width']/1000*.3,element['length']/2000)*(.7 if 'nul_' in core['source'] else 1)
            obj['saberRadiusFactor']=.3;obj['saberRadiusScale']=.7 if 'nul_' in core['source'] else 1
            generated.append(obj)
        for index,layer in enumerate(unique.values()):generated.append(ribbon(entry,name,matrix,element,layer,pipeline,index))
        for obj in generated:
            obj['saberMatrix']=[v for row in matrix for v in row]
            if '_liveFrame' in element:obj['saberFrame']=[v for row in element['_liveFrame'] for v in row]
            obj['saberLength']=element['length']
            obj['saberWidth']=element['width']
        result.extend(generated)
    if diagnostics:entry.setdefault('warnings',[]).extend(sorted(set(diagnostics)))
    return result
