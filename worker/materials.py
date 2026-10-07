"""Bake installed SWTOR shader color/palette logic to portable textures.

Calls the separately installed GPL GR2 shader API; does not copy its implementation.
Roughness is an approximation. Specialized directional/specular lighting is not baked.
"""
import bpy,json,hashlib,struct,zlib
import numpy as np
from pathlib import Path
from palette import palette_offsets
from resource_source import source as resource_source

def save_texture(image,file,linear=False):
    """Write independent RGBA channels, without Blender's float-image alpha conversion.

    In Blender 4.3, saving a float image with packed gloss in alpha can change
    RGB even with CHANNEL_PACKED. Encode sRGB explicitly, keeping alpha linear.
    """
    width,height=image.size
    pixels=np.empty(width*height*4,dtype=np.float32);image.pixels.foreach_get(pixels)
    pixels=np.clip(pixels.reshape(height,width,4),0,1)
    if not linear:
        rgb=pixels[:,:,:3]
        pixels[:,:,:3]=np.where(rgb<=.0031308,12.92*rgb,1.055*np.power(rgb,1/2.4)-.055)
    rgba=np.rint(pixels[::-1]*255).astype(np.uint8).reshape(height,width*4)
    rows=np.zeros((height,width*4+1),dtype=np.uint8);rows[:,1:]=rgba
    def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    Path(file).write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(rows.tobytes()))+chunk(b'IEND',b''))

class MaterialPipeline:
    def __init__(self, resources, cache, resolution=None):
        self.resources=resources;self.cache=Path(cache);self.cache.mkdir(parents=True,exist_ok=True)
        self.resolution=resolution;self.materials={};self.records=[]
    def source(self,relative):
        return resource_source(self.resources,relative)
    def image(self,relative):
        p=self.source(relative)
        if not p.is_file():raise ValueError('Missing texture: '+str(p))
        return bpy.data.images.load(str(p),check_existing=True)
    def dimensions(self,info):
        sizes={k:tuple(self.image(v).size) for k,v in info.get('ddsPaths',{}).items()}
        def largest(keys):
            selected=[sizes[k] for k in keys if k in sizes]
            return tuple(max(s[i] for s in selected) for i in range(2)) if selected else (1,1)
        base=largest(['diffuseMap','paletteMap','paletteMaskMap','complexionMap','facepaintMap','ageMap','rotationMap'])
        result={'base':base,'normal':sizes.get('rotationMap',(1,1)),'emission':base}
        if self.resolution:result={k:(self.resolution,self.resolution) for k in result}
        if info['otherValues']['derived']=='EmissiveOnly':
            result={**result,'base':sizes['diffuseMap'],'emission':sizes['diffuseMap'],'normal':(1,1)}
        return result
    def make(self,name,info):
        # Normalize native shader families for every caller, including NPCs.
        # HighQualityCharacter uses the portable Creature color inputs.
        if info.get('otherValues',{}).get('derived')=='HighQualityCharacter':
            info={**info,'otherValues':{**info['otherValues'],'derived':'Creature'}}
        sources=[]
        for relative in info.get('ddsPaths',{}).values():
            p=self.source(relative);sources.append((str(p),p.stat().st_mtime_ns,p.stat().st_size))
        bake_info={k:v for k,v in info.items() if not k.startswith('portableAlpha')}
        dimensions=self.dimensions(info)
        key=hashlib.sha256(json.dumps([13,dimensions,bake_info,sources,info.get('portableAlphaMode')=='additive'],sort_keys=True).encode()).hexdigest()
        material_key=key+repr((info.get('portableAlphaMode'),info.get('portableAlphaCutoff')))
        if material_key in self.materials:return self.materials[material_key]
        folder=self.cache/key;folder.mkdir(exist_ok=True)
        family=info['otherValues']['derived']
        files={channel:folder/(key[:12]+'-'+channel+'.png') for channel in dimensions}
        if not all(p.exists() for p in files.values()):self.bake(info,files,dimensions)
        mat=bpy.data.materials.new(name+' â€” '+family);mat.use_nodes=True
        nodes=mat.node_tree.nodes;links=mat.node_tree.links;bsdf=nodes.get('Principled BSDF')
        base=nodes.new('ShaderNodeTexImage');base.image=bpy.data.images.load(str(files['base']),check_existing=True)
        links.new(base.outputs['Color'],bsdf.inputs['Base Color'])
        alpha_cutoff=info.get('portableAlphaCutoff',.75 if family=='HairC' else .5)
        cutoff=nodes.new('ShaderNodeMath');cutoff.operation='GREATER_THAN';cutoff.inputs[1].default_value=alpha_cutoff
        links.new(base.outputs['Alpha'],cutoff.inputs[0]);links.new(cutoff.outputs[0],bsdf.inputs['Alpha'])
        normal=nodes.new('ShaderNodeTexImage');normal.image=bpy.data.images.load(str(files['normal']),check_existing=True);normal.image.colorspace_settings.name='Non-Color'
        normal_map=nodes.new('ShaderNodeNormalMap');links.new(normal.outputs['Color'],normal_map.inputs['Color']);links.new(normal_map.outputs['Normal'],bsdf.inputs['Normal'])
        emission=nodes.new('ShaderNodeTexImage');emission.image=bpy.data.images.load(str(files['emission']),check_existing=True)
        links.new(emission.outputs['Color'],bsdf.inputs['Emission Color']);bsdf.inputs['Emission Strength'].default_value=1
        bsdf.inputs['Roughness'].default_value=.25 if family=='Eye' else .65
        bsdf.inputs['Specular IOR Level'].default_value=.1 if family=='Eye' else 0
        mat.surface_render_method='DITHERED';mat.use_backface_culling=False
        mat['gltf_alpha_mode']='MASK';mat.alpha_threshold=alpha_cutoff
        if info.get('portableAlphaMode')=='additive':
            mat['gltf_alpha_mode']='BLEND';links.new(base.outputs['Alpha'],bsdf.inputs['Alpha'])
        self.materials[material_key]=mat
        self.records.append({'name':mat.name,'family':family,'textures':{k:str(v) for k,v in files.items()},'resolution':'native' if self.resolution is None else self.resolution,'textureDimensions':dimensions,'roughness':.25 if family=='Eye' else .65,'specular':.1 if family=='Eye' else 0,'specularPolicy':'constant only; no specular or roughness maps','alphaMode':info.get('portableAlphaMode','cutout' if family=='HairC' else 'opaque'),'alphaCutoff':alpha_cutoff,'baseColorPolicy':'palette color without procedural specular or view-dependent flush'})
        return mat
    def bake(self,info,files,dimensions):
        if info['otherValues']['derived']=='EmissiveOnly':
            base=self.image(info['ddsPaths']['diffuseMap'])
            pixels=list(base.pixels[:]);width,height=base.size
            if info.get('portableAlphaMode')=='additive':
                # glTF has no additive mode: use a luminance opacity approximation.
                # Unity uses true additive blending and ignores this alpha.
                for i in range(0,len(pixels),4):pixels[i+3]=max(pixels[i:i+3])
            for channel in ['base','emission']:
                copy=bpy.data.images.new('Portable emissive',width=width,height=height,alpha=True,float_buffer=True);copy.pixels.foreach_set(pixels);save_texture(copy,files[channel],linear=not base.is_float);bpy.data.images.remove(copy)
            normal=bpy.data.images.new('Flat normal',width=1,height=1);normal.colorspace_settings.name='Non-Color';normal.pixels[:]=(.5,.5,1,1);save_texture(normal,files['normal'],linear=True);bpy.data.images.remove(normal)
            return
        mat=bpy.data.materials.new('Temporary shader bake');mat.use_nodes=True
        nodes=mat.node_tree.nodes;links=mat.node_tree.links;nodes.clear()
        output=nodes.new('ShaderNodeOutputMaterial');shader=nodes.new('ShaderNodeHeroEngine')
        shader.derived=info['otherValues']['derived'].upper()
        for prop,relative in info.get('ddsPaths',{}).items():
            if hasattr(shader,prop):setattr(shader,prop,self.image(relative))
        values=info['otherValues']
        for palette in [1,2]:
            vector=values.get(f'palette{palette}')
            if vector:
                for prop,value in zip(['hue','saturation','brightness','contrast'],vector):setattr(shader,f'palette{palette}_{prop}',float(value))
            for prop,key in [('specular','Specular'),('metallic_specular','MetallicSpecular')]:
                if f'palette{palette}{key}' in values:setattr(shader,f'palette{palette}_{prop}',[*values[f'palette{palette}{key}'],1])
        if 'fleshBrightness' in values:shader.flesh_brightness=values['fleshBrightness']
        if 'flush' in values:shader.flush_tone=[*values['flush'],1]
        for index in [1,2]:
            if values.get(f'palette{index}Color') and info['ddsPaths'].get('paletteMap'):
                palette=self.image(info['ddsPaths']['paletteMap'])
                pixels=np.asarray(palette.pixels[:],dtype=np.float32)
                calibrated=palette_offsets(values[f'palette{index}Color'],pixels,float(values.get(f'palette{index}',[0,0,0,1])[3]))
                for prop,value in zip(['hue','saturation','brightness','contrast'],calibrated):setattr(shader,f'palette{index}_'+prop,value)
        group=shader.node_tree
        # These helpers inject view/normal-dependent lighting into the *color*
        # graph before its diffuse BSDF. An EMIT bake alone does not remove it.
        # Disconnect only their contribution in this temporary shader instance;
        # preserve palette, complexion, facepaint and texture composition.
        for node in list(group.nodes):
            if node.type=='GROUP' and node.node_tree.name.split('.')[0] in {'GetPhongSpecular','GetSpecularLookup','GetFlushColor'}:
                for socket in node.outputs:
                    for link in list(socket.links):
                        zero=group.nodes.new('ShaderNodeRGB');zero.outputs[0].default_value=(0,0,0,1)
                        group.links.new(zero.outputs[0],link.to_socket)
        diffuse=next((n for n in group.nodes if n.type=='BSDF_DIFFUSE'),None)
        if diffuse is None:diffuse=next(n for n in group.nodes if n.type=='BSDF_PRINCIPLED')
        color_input=diffuse.inputs.get('Color') or diffuse.inputs.get('Base Color')
        group_output=next(n for n in group.nodes if n.type=='GROUP_OUTPUT')
        def expose(name,socket):
            group.interface.new_socket(name,in_out='OUTPUT',socket_type='NodeSocketColor');group.links.new(socket,group_output.inputs[name])
        if not color_input.is_linked:raise ValueError('Shader color has no source')
        color_source=color_input.links[0].from_socket
        if shader.derived=='UBER':
            # Uber builds its highlight inline rather than using GetPhongSpecular.
            color_source=next(n for n in group.nodes if n.type=='GAMMA').outputs['Color']
        if shader.derived=='HAIRC':
            # Hair adds a sampled directional highlight after its palette color.
            color_source=next(n for n in group.nodes if n.type=='GROUP' and n.node_tree.name.startswith('HuePixel')).outputs['Diffuse Color']
        # Non-palette materials still accept a primary tint. Preserve texture
        # luminance/detail; there is no invented secondary region without a mask.
        if values.get('palette1Color') and not info['ddsPaths'].get('paletteMap'):
            color=values['palette1Color'];rgb=[int(color[i:i+2],16)/255 for i in (1,3,5)]
            rgb=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
            tint=group.nodes.new('ShaderNodeMixRGB');tint.blend_type='COLOR';tint.inputs[0].default_value=1
            group.links.new(color_source,tint.inputs[1]);tint.inputs[2].default_value=(*rgb,1);color_source=tint.outputs[0]
        expose('PortableColor',color_source)
        packed=next(n for n in group.nodes if n.type=='GROUP' and n.node_tree.name.startswith('NormalAndAlphaFromSwizzledTexture'))
        expose('PortableNormal',packed.outputs['Normal']);expose('PortableAlpha',packed.outputs['Alpha'])
        # Use the packed emissive mask with the customized base color. The game-specific
        # specular/lighting response intentionally remains outside this portable material.
        multiply=group.nodes.new('ShaderNodeVectorMath');multiply.operation='SCALE'
        group.links.new(color_source,multiply.inputs[0]);group.links.new(packed.outputs['Emission Strength'],multiply.inputs['Scale']);expose('PortableEmission',multiply.outputs['Vector'])
        emission=nodes.new('ShaderNodeEmission');links.new(emission.outputs[0],output.inputs['Surface'])
        bpy.ops.object.select_all(action='DESELECT');bpy.ops.mesh.primitive_plane_add(size=2,location=(0,0,-10));plane=bpy.context.object;plane.data.materials.append(mat)
        scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1;scene.cycles.device='CPU';scene.render.bake.use_clear=True;scene.render.bake.margin=0
        target=nodes.new('ShaderNodeTexImage');nodes.active=target
        baked={}
        for channel,socket in [('base','PortableColor'),('alpha','PortableAlpha'),('normal','PortableNormal'),('emission','PortableEmission')]:
            width,height=dimensions['base' if channel=='alpha' else channel]
            image=bpy.data.images.new('Bake '+channel,width=width,height=height,alpha=True,float_buffer=True)
            image.alpha_mode='CHANNEL_PACKED'
            if channel in ['alpha','normal']:image.colorspace_settings.name='Non-Color'
            target.image=image;links.new(shader.outputs[socket],emission.inputs['Color']);nodes.active=target
            bpy.ops.object.bake(type='EMIT');baked[channel]=image
        count=dimensions['base'][0]*dimensions['base'][1]*4
        pixels=np.empty(count,dtype=np.float32);alpha=np.empty(count,dtype=np.float32)
        # HeroEngine's mix factor selects the transparent shader: opacity is its inverse.
        baked['base'].pixels.foreach_get(pixels);baked['alpha'].pixels.foreach_get(alpha);pixels[3::4]=1-np.clip(alpha[0::4],0,1);baked['base'].pixels.foreach_set(pixels);baked['base'].update()
        for channel,p in files.items():
            save_texture(baked[channel],p,linear=channel=='normal')
        bpy.data.objects.remove(plane,do_unlink=True);bpy.data.materials.remove(mat)
        for image in baked.values():bpy.data.images.remove(image)
