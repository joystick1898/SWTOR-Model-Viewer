import bpy,json
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath=r'G:\Old Republic Assets\SWTOR Extracts-Main\AttonRand\AttonRand.blend',load_ui=False)
result=[]
for obj in bpy.data.objects:
    if obj.type=='MESH':result.append({'name':obj.name,'parent':obj.parent.name if obj.parent else None,'parent_type':obj.parent_type,'parent_bone':obj.parent_bone,'matrix_world':[list(row) for row in obj.matrix_world],'modifiers':[{'type':m.type,'object':m.object.name if getattr(m,'object',None) else None} for m in obj.modifiers],'constraints':[{'type':c.type,'subtarget':getattr(c,'subtarget',None)} for c in obj.constraints]})
Path('reports/weapon-source-scene.json').write_text(json.dumps(result,indent=2));print(json.dumps([o for o in result if 'blast' in o['name'].lower()]))
