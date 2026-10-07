"""Inventory idle saber coverage without loading Blender or modifying game files."""
import sys,json,collections
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'worker'))
from saber_effects import native_layers,effect_rows,persistent
config=json.loads((ROOT/'development.local.json').read_text());resources=Path(config['resources'])
catalog=json.loads((ROOT/'output/equipment/catalog.json').read_text())
models={Path(m).stem for item in catalog['items'] if item['category'] in ('saber','dualsaber') for m in item['models']}
files=[p for p in (resources/'art/fx/fxspec').rglob('*.fxspec') if any(p.stem==m or p.stem.endswith('_'+m) for m in models)]
results=[];textures=set();particles=set();all_diagnostics=collections.Counter()
for file in files:
 diagnostics=[];resolved=native_layers(resources,[file],diagnostics)
 textures.update(x['texture'] for x in resolved);particles.update(x['source'] for x in resolved)
 all_diagnostics.update(diagnostics)
 results.append(dict(effect=str(file.relative_to(resources)),persistentTextureLayers=len(resolved),animatedTextureLayers=sum(x['fps']>0 for x in resolved),textures=sorted({x['texture'] for x in resolved}),diagnostics=sorted(set(diagnostics))))
summary=dict(catalogModelStems=len(models),effectFiles=len(files),filesWithSupportedArtwork=sum(r['persistentTextureLayers']>0 for r in results),uniqueTextures=len(textures),uniqueParticles=len(particles),fullyFaithfulParticleSimulation=False,scope='Persistent blade texture layers only; no ignition, shutdown, impact or motion trails.')
report=dict(summary=summary,diagnostics=dict(all_diagnostics),results=results)
(ROOT/'reports/PERSISTENT_SABER_COVERAGE.json').write_text(json.dumps(report,indent=2))
print(json.dumps(summary,indent=2))
