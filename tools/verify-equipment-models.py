"""Blender import, finite geometry and native bone binding regression."""
import sys,json,math
from pathlib import Path
import bpy,addon_utils
request=json.loads(Path(sys.argv[sys.argv.index('--')+1]).read_text())
sys.path.insert(0,request['addons'])
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'worker'))
from resource_source import source
from secondary import anchor_cloth,anchor_world
addon_utils.enable('io_scene_gr2',default_set=True,persistent=False)
prefs=bpy.context.preferences.addons['io_scene_gr2'].preferences
prefs.gr2_scale_object=False;prefs.gr2_apply_axis_conversion=False
results=[]
for batch in request['batches']:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    body=batch['body']
    # Read the native specification rather than guessing skeleton filenames.
    import re
    dyc=source(request['resources'],'art/dynamic/spec/'+body+'new.dyc').read_text()
    skeleton=re.search(r'^\s*Skeleton=(\S+)',dyc,re.M)[1]
    bpy.ops.import_mesh.gr2(filepath=str(source(request['resources'],'art/dynamic/spec/'+skeleton)))
    arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    for relative in batch['models']:
        before=set(bpy.data.objects);result=dict(body=body,path=relative)
        try:
            file=source(request['resources'],relative)
            bpy.ops.import_mesh.gr2(filepath=str(file))
            meshes=[o for o in set(bpy.data.objects)-before if o.type=='MESH']
            if not meshes:raise ValueError('No mesh objects imported')
            for obj in meshes:
                anchor_cloth(obj,arm,file.with_suffix('.clo'));anchor_world(obj,arm)
                if not any(g.name in arm.data.bones for g in obj.vertex_groups):raise ValueError('No matching native bones')
                if not all(math.isfinite(v) for vertex in obj.data.vertices for v in vertex.co):raise ValueError('Non-finite vertex coordinates')
            result.update(ok=True,vertices=sum(len(o.data.vertices) for o in meshes),triangles=sum(len(o.data.polygons) for o in meshes))
        except Exception as error:result.update(ok=False,error=str(error))
        finally:
            for obj in set(bpy.data.objects)-before:bpy.data.objects.remove(obj,do_unlink=True)
            for mesh in list(bpy.data.meshes):
                if mesh.users==0:bpy.data.meshes.remove(mesh)
        results.append(result)
    print('VERIFIED',body,len(batch['models']),flush=True)
summary=dict(checked=len(results),failed=sum(not r['ok'] for r in results))
Path(request['output']).write_text(json.dumps(dict(summary=summary,results=results),indent=2))
print(summary,flush=True)
if summary['failed']:raise RuntimeError('Equipment mesh regression failures')
