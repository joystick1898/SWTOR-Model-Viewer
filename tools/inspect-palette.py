"""Inspect actual palette samples for a supplied material; run in Blender."""
import json, sys
from pathlib import Path
import bpy
import numpy as np

root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'worker'))
from palette import palette_offsets
from resource_source import source
config=json.loads((root/'development.local.json').read_text())
file=Path(sys.argv[sys.argv.index('--')+1])
info=json.loads(file.read_text())
def pixels(key):
    image=bpy.data.images.load(str(source(Path(config['resources']),info['ddsPaths'][key])))
    return np.asarray(image.pixels[:],dtype=np.float32).reshape(-1,4),tuple(image.size)
palette,size=pixels('paletteMap');mask,mask_size=pixels('paletteMaskMap')
contrast=info['otherValues']['palette1'][3]
result={'paletteMap':info['ddsPaths']['paletteMap'],'paletteSize':size,'maskSize':mask_size,
        'wholeMapRed':list(palette_offsets('#FF0000',palette,contrast))}
if size==mask_size:
    selected=palette[(mask[:,0]>.9)&(mask[:,1]<.1)]
    result['strongPrimarySamples']=len(selected)
    if len(selected):result['primaryRegionRed']=list(palette_offsets('#FF0000',selected,contrast))
print(json.dumps(result,indent=2))
