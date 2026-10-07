"""Anchor unsupported secondary hair to its native cloth attachment.

This preserves the authored rest shape; it does not simulate cloth dynamics.
Only unbound groups named in a v3 CLO with one known skeletal anchor qualify.
"""
import struct
from functools import lru_cache

@lru_cache(maxsize=8)
def sibling_cloth_anchors(directory):
    candidates={}
    for file in directory.glob('*.clo'):
        for name,anchor in cloth_anchors(file.read_bytes()).items():
            candidates.setdefault(name,{}).setdefault(anchor,str(file))
    return {name:next(iter(anchors.items())) for name,anchors in candidates.items() if len(anchors)==1}

def cloth_anchors(data):
    """CLO v3 particles: 96 bytes, final two uint32s index name and anchor."""
    if len(data)<128 or data[:4]!=b'OLCB':return {}
    version=struct.unpack_from('<I',data,4)[0]
    if version==3:
        count,particles=struct.unpack_from('<II',data,56)
        names_start=16+struct.unpack_from('<Q',data,88)[0]
        records=16+struct.unpack_from('<Q',data,96)[0]
    elif version==1:
        count,names_start,particles,records=struct.unpack_from('<4I',data,56)
        names_start+=16;records+=16
    else:return {}
    if not 0<count<4096 or particles>4096 or names_start+count*32>len(data) or records+particles*96>len(data):return {}
    try:names=[data[names_start+i*32:names_start+(i+1)*32].split(b'\0')[0].decode('ascii') for i in range(count)]
    except UnicodeDecodeError:return {}
    result={}
    for i in range(particles):
        name,anchor=struct.unpack_from('<II',data,records+i*96+88)
        if name>=count or anchor>=count:return {}
        if names[name] in result and result[names[name]]!=names[anchor]:return {}
        result[names[name]]=names[anchor]
    return result

def anchor_cloth(obj,arm,cloth):
    mapping=cloth_anchors(cloth.read_bytes()) if cloth.is_file() else {}
    missing=[g for g in obj.vertex_groups if g.name not in arm.data.bones]
    references={}
    if any(g.name not in mapping for g in missing):
        siblings=sibling_cloth_anchors(cloth.parent)
        for g in missing:
            if g.name not in mapping and g.name in siblings:
                anchor,file=siblings[g.name];mapping[g.name]=anchor;references[g.name]=file
    def skeletal_anchor(name):
        visited=set()
        while name not in arm.data.bones:
            if name in visited or name not in mapping:return None
            visited.add(name);name=mapping[name]
        return name
    resolved={g.name:anchor for g in missing if (anchor:=skeletal_anchor(g.name))}
    if not resolved:return None
    indices={g.index:resolved[g.name] for g in missing if g.name in resolved};changed=0
    targets={name:obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name) for name in set(resolved.values())}
    for vertex in obj.data.vertices:
        weights={}
        for w in vertex.groups:
            if w.group in indices:weights[indices[w.group]]=weights.get(indices[w.group],0)+w.weight
        for name,weight in weights.items():targets[name].add([vertex.index],weight,'ADD')
        if weights:changed+=1
    for g in missing:
        if g.name in resolved:obj.vertex_groups.remove(g)
    return {'mesh':obj.name,'anchors':resolved,'cloth':str(cloth),'sharedClothReferences':references,'vertices':changed,'mode':'native cloth anchors; rigid rest shape, no simulation'}

def anchor_world(obj,arm):
    """Keep authored *_World groups stationary within the actor, but poseable.

    The imported GR2 scene root is outside JBA animation. Binding these rigid
    groups there preserves playback while enabling whole-rig manual posing.
    """
    root=arm.data.bones.get('GrannyRootBone')
    if not root or root.parent:return None
    groups=[g for g in obj.vertex_groups if g.name.endswith('_World') and g.name not in arm.data.bones]
    if not groups:return None
    target=obj.vertex_groups.get(root.name) or obj.vertex_groups.new(name=root.name)
    indices={g.index for g in groups};changed=0
    for v in obj.data.vertices:
        weight=sum(w.weight for w in v.groups if w.group in indices)
        if weight:target.add([v.index],weight,'ADD');changed+=1
    names=[g.name for g in groups]
    for g in groups:obj.vertex_groups.remove(g)
    return {'mesh':obj.name,'groups':names,'anchor':root.name,'vertices':changed,'mode':'stationary world groups; editable scene-root binding'}

def anchor_hair(obj,arm,cloth):
    if not cloth.is_file():return None
    data=cloth.read_bytes()
    if len(data)<160 or data[:4]!=b'OLCB' or struct.unpack_from('<I',data,4)[0]!=3:return None
    count=struct.unpack_from('<I',data,56)[0]
    start=16+struct.unpack_from('<Q',data,88)[0]
    if not 0<count<4096 or start+count*32>len(data):return None
    names=[data[start+i*32:start+(i+1)*32].split(b'\0')[0].decode('ascii') for i in range(count)]
    anchors=[n for n in names if n in arm.data.bones]
    missing=[g for g in obj.vertex_groups if g.name not in arm.data.bones]
    if len(anchors)!=1 or not missing or any(g.name not in names or not g.name.startswith('newtonparticle_') for g in missing):return None
    anchor=anchors[0];group=obj.vertex_groups.get(anchor) or obj.vertex_groups.new(name=anchor)
    indices={g.index for g in missing};changed=0
    for vertex in obj.data.vertices:
        weight=sum(w.weight for w in vertex.groups if w.group in indices)
        if weight>0:group.add([vertex.index],weight,'ADD');changed+=1
    missing_names=[g.name for g in missing]
    for g in missing:obj.vertex_groups.remove(g)
    return {'mesh':obj.name,'anchor':anchor,'cloth':str(cloth),'groups':missing_names,'vertices':changed,'mode':'native cloth anchor; rigid rest shape, no simulation'}
