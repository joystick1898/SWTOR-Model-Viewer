import bpy,sys,addon_utils,json
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path('worker').resolve()));from sabers import estimated_emitters,emitters
sys.path.insert(0,'C:/Users/BRShe/AppData/Roaming/Blender Foundation/Blender/4.3/scripts/addons');addon_utils.enable('io_scene_gr2',default_set=True)
p=bpy.context.preferences.addons['io_scene_gr2'].preferences;p.gr2_scale_object=False;p.gr2_apply_axis_conversion=False
root=Path('G:/Old Republic Assets/resources');audit=json.loads(Path('reports/saber-emitter-audit.json').read_text());results=[]
for row in audit['results']:
 if not row['estimated']:continue
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete();bpy.ops.import_mesh.gr2(filepath=str(root/row['model']));hilt=next((o for o in bpy.data.objects if o.type=='MESH'),None)
 if hilt is None:
  results.append({'model':row['model'],'skipped':'GR2 importer returned no mesh'});continue
 points=estimated_emitters(hilt,row['category']);bounds=[(min(v.co[i] for v in hilt.data.vertices),max(v.co[i] for v in hilt.data.vertices)) for i in range(3)];axis=max(range(3),key=lambda i:bounds[i][1]-bounds[i][0])
 for n,m,_ in points:
  direction=m.to_3x3()@Vector((0,1,0));assert abs(direction[axis])>.99999
  assert abs(m.translation[axis]-(bounds[axis][0] if n=='estimated_front' else bounds[axis][1]))<1e-7
 if len(points)==2:
  assert ((points[1][1].translation-points[0][1].translation).length-(bounds[axis][1]-bounds[axis][0]))<1e-7
 results.append({'model':row['model'],'axis':'XYZ'[axis],'spacing':bounds[axis][1]-bounds[axis][0],'emitters':len(points)})
# Authored emitters must retain their exact previous transforms.
for row in audit['results']:
 if row['estimated']:continue
 actual=emitters(root/row['model'],row['category'],root)
 assert [(n,[list(r) for r in m],scale) for n,m,scale in actual]==[(e['name'],e['matrix'],e['lengthScale']) for e in row['emitters']]
Path('reports/blade-alignment-audit.json').write_text(json.dumps({'ok':True,'estimated':results,'nativeUnchanged':sum(not r['estimated'] for r in audit['results'])},indent=2));print('ALIGNMENT_PASS',len(results))
