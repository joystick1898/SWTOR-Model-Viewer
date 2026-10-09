"""Independent rigid attachments and native weighted clothing layers."""
import bpy,math,copy
from pathlib import Path
from mathutils import Matrix,Vector,Euler
from asset_materials import resolve_material
from sabers import blades,effect_components
from secondary import anchor_cloth,anchor_world
from palette_controls import apply_selection,material_palettes

def attach_equipment(entries,arm,source,pipeline,resources,skins=None):
 if entries and arm is None:raise ValueError('This model has no skeleton to attach equipment to')
 meshes=[];parts=[]
 for entry in entries:
  bone=entry['bone'];native=bone=='@skin'
  if not native and bone not in arm.data.bones:raise ValueError('Target skeleton has no bone '+bone+'. Choose an available bone.')
  if native and entry['kind']!='armor':raise ValueError('Native clothing fit requires a clothing appearance; choose a bone for this item')
  if not native:
   frame=bpy.data.objects.new('equipment_socket_'+str(entry['layer']),None);bpy.context.scene.collection.objects.link(frame)
   frame.parent=arm;frame.parent_type='BONE';frame.parent_bone=bone
   bpy.context.view_layer.update();frame.matrix_world=arm.matrix_world@arm.data.bones[bone].matrix_local
  for relative in entry['models']:
   before=set(bpy.data.objects);bpy.ops.import_mesh.gr2(filepath=str(source(relative)))
   added=set(bpy.data.objects)-before
   hilt=next((o for o in added if o.type=='MESH'),None)
   if hilt and entry['category'] in ('saber','dualsaber'):added.update(blades(entry,relative,Path(source(relative)),pipeline,hilt))
   if hilt and entry['category'] in ('saber','dualsaber'):
    for component,matrix in effect_components(Path(source(relative)),resources):
     before_component=set(bpy.data.objects);bpy.ops.import_mesh.gr2(filepath=str(source(component)))
     for obj in set(bpy.data.objects)-before_component:
      if obj.type=='MESH':obj.data.transform(matrix);obj['weaponComponentSource']=component
      added.add(obj)
   for obj in added:
    if obj.type!='MESH':continue
    obj.name='equipment_'+str(entry['layer'])+'_'+obj.name
    for mod in list(obj.modifiers):obj.modifiers.remove(mod)
    for i in range(0 if obj.get('saberChannel') else max(1,len(obj.data.materials))):
     info=entry.get('materialInfo')
     if info:
      base=info;info=base.get('materialOverrides',{}).get(str(i),base)
      if int(base.get('otherValues',{}).get('materialSkinIndex',-1))==i and skins and entry['slot'] in skins:info=skins[entry['slot']]
     else:
      original=obj.data.materials[i].name if i<len(obj.data.materials) else Path(relative).stem
      info,_=resolve_material(resources,original,{'materials':[]},None,relative)
     color=entry.get('colors',{}).get(relative,entry.get('colors',{}).get('*',{}))
     if color and info.get('otherValues',{}).get('derived')!='SkinB':
      info=copy.deepcopy(info)
      for channel,index in [('primary',1),('secondary',2)]:
       apply_selection(info['otherValues'],color,channel,index)
     mat=pipeline.make('equipment_'+str(entry['layer'])+'_'+str(i),info)
     if i<len(obj.data.materials):obj.data.materials[i]=mat
     else:obj.data.materials.append(mat)
    if native:
     anchor_cloth(obj,arm,Path(source(relative)).with_suffix('.clo'));anchor_world(obj,arm)
     if not any(g.name in arm.data.bones for g in obj.vertex_groups):raise ValueError('Clothing has no matching bones on this model')
    else:
     # Ranged weapons changed authoring axes in the modern model directory;
     # modern saber/staff meshes still use +Z. Keep those families distinct.
     folder=relative.split('/weapon/')[-1].split('/')[0]
     family=Path(relative).stem.split('_')[0]
     socket_authored=folder=='model' and family in ('blaster','rifle','assaultcannon','bowcaster')
     grip=Matrix.Rotation(-math.pi/2,4,'X') if '/weapon/' in relative and not socket_authored else Matrix.Identity(4)
     if entry['category']=='jetpack' and '/player_mount/' in relative:grip=Matrix.Rotation(math.pi,4,'Y')
     position=Matrix.Translation(Vector(entry['position'])/1000)
     rotation=Euler([math.radians(v) for v in entry['rotation']],'XYZ').to_matrix().to_4x4()
     transform=position@rotation@Matrix.Scale(entry['scale'],4)@grip
     obj.data.transform(arm.data.bones[bone].matrix_local@transform)
     obj.matrix_world=arm.matrix_world.copy();obj.vertex_groups.clear()
     group=obj.vertex_groups.new(name=bone);group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    obj.modifiers.new('Equipment attachment','ARMATURE').object=arm
    part={'name':obj.name,'slot':'equipment','bone':bone,'equipmentLayer':entry['layer'],'equipmentItem':entry['item'],'source':obj.get('weaponComponentSource',relative)}
    part['nativePalettes']=material_palettes(obj.data.materials)
    if obj.get('saberFrame') is not None and not native:
     def matrix_rows(values):return Matrix([values[i:i+4] for i in range(0,16,4)])
     part['saberEdit']={'element':obj['saberElement'],'frame':[v for row in grip@matrix_rows(obj['saberFrame']) for v in row],'matrix':[v for row in grip@matrix_rows(obj['saberMatrix']) for v in row],'length':obj['saberLength'],'width':obj['saberWidth'],'radius':obj.get('saberRadius',0),'radiusFactor':obj.get('saberRadiusFactor',.3),'radiusScale':obj.get('saberRadiusScale',1),'tipExtension':bool(obj.get('saberTipExtension',False))}
    meshes.append(obj);parts.append(part)
   for obj in added:
    if obj.type!='MESH':bpy.data.objects.remove(obj,do_unlink=True)
 return meshes,parts
