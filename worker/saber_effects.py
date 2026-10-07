"""Read persistent saber artwork. No ignition, shutdown, impact or motion trails.

Pure Python so discovery and its coverage audit do not require Blender.
Native particle motion/curve expressions are retained as evidence, not executed.
"""
import re
import xml.etree.ElementTree as ET
from functools import lru_cache
from pathlib import Path

PARTICLES = 'art/fx/particles/'
PRESETS = {
    'standard': ['saber_core_alpha_blended', 'saber_blade_alpha_blended'],
    'unstable': ['dhg_unstable_saber_core_alpha_blended', 'unstable_saber_blade_alpha_blended'],
    'relic': ['unstable_saber_core_alpha_blended', 'unstable_saber_blade_alpha_blended'],
    'vented': ['saber_core_alpha_blended', 'saber_blade_alpha_blended', 'vented_core_alpha_blended'],
    'vintage': ['vintage_saber_core_alpha_blended', 'saber_blade_alpha_blended'],
    'mamba': ['mamba_saber_core_alpha_blended', 'saber_blade_alpha_blended'],
    'tau': ['tau_saber_core_alpha_blended', 'tau_saber_core2_alpha_blended', 'tau_saber_blade_alpha_blended1', 'tau_saber_blade_alpha_blended2'],
    'nul': ['nul_saber_core_alpha_blended_top', 'nul_saber_blade_alpha_blended_top'],
}
EXCLUDED = re.compile(r'trail|turn_on|turn_off|ignite|ignition|shutdown|impact|slash|swipe|swing|crit', re.I)

def relative(value):
    value=value.replace('\\','/').lstrip('/')
    if ':' in value or '..' in value.split('/'):raise ValueError('Invalid effect resource path')
    return value

@lru_cache(maxsize=4096)
def particle(file):
    return dict(line.strip().lstrip('.').split('=',1) for line in Path(file).read_text(encoding='utf-8-sig').splitlines() if line.strip().startswith('.') and '=' in line)

def number(value, default=0):
    try:return float(value)
    except (ValueError,TypeError):return default

def scalar(value, default=1):
    """Representative size for static geometry; never evaluate native expressions."""
    if value and value.startswith('<'):
        values=value.strip('<>').split(',')
        return (number(values[0],default)+number(values[1],default))/2
    return number(value,default)

def persistent(row):
    event=row.get('_fxStartFxName','')
    text=' '.join(row.get(k,'') for k in ('_fxResourceName','_fxName','_fxStartFxName'))
    conditions=row.get('_conditions','')
    return bool(re.fullmatch(r'lightsaber_loop(?:_vent_\d+)?|dummy_vent_blade_\d+_loc',event)) and not EXCLUDED.search(text+' '+conditions)

def effect_rows(file):
    rows=[]
    for e in ET.fromstring(Path(file).read_bytes()).iter('e'):
        row={f.get('name'):f.text or '' for f in e.findall('f')}
        row['_conditions']=' '.join(' '.join(f.itertext()) for f in e.findall('f') if f.get('name','').endswith('IF'))
        rows.append(row)
    return rows

def layers(root, resource, diagnostics=None, visited=()):
    """Follow only persistent emitter children; never spawn at-death effects."""
    diagnostics=diagnostics if diagnostics is not None else []
    resource=relative(resource)
    if '/' not in resource:resource=PARTICLES+resource
    if EXCLUDED.search(resource):return []
    if resource in visited:
        diagnostics.append('Cyclic particle reference: '+resource);return []
    file=Path(root)/resource
    if not file.is_file():
        diagnostics.append('Missing persistent particle: '+resource);return []
    d=particle(file)
    if d.get('DoTrail','false').lower()=='true':return []
    kind=d.get('ParticleType')
    if kind in ('BASIC_EMITTER','DUMMY_EMITTER'):
        return layers(root,d['EmitSpec'],diagnostics,visited+(resource,)) if d.get('EmitSpec') else []
    texture=relative(d.get('TextureName',''))
    # Limit this renderer to longitudinal blade/vent artwork, not arbitrary FX.
    if kind!='BILLBOARD_POINT' or not ('dynamic_saber_' in texture or 'vented_saber_' in texture):
        diagnostics.append('Unsupported persistent particle: '+resource);return []
    if EXCLUDED.search(texture) or any(x in texture for x in ('tip_','flash_')):return []
    if not (Path(root)/texture).is_file():
        diagnostics.append('Missing persistent texture: '+texture);return []
    cols=max(1,int(number(d.get('RowSize'),1)));rows=max(1,int(number(d.get('ColumnSize'),1)))
    speed=number(d.get('AnimationSpeed'))
    short=any(x in texture for x in ('exhaust','vented_saber_core'))
    channel='glow' if short or any(x in texture for x in ('glow','lightning')) else 'core'
    return [dict(source=resource,texture=texture,columns=cols,rows=rows,
        fps=1/speed if speed>0 and cols*rows>1 else 0,
        startFrame=max(0,int(number(d.get('StartFrame'))))%(cols*rows),
        direction=max(-1,min(1,int(number(d.get('FrameMoveDirection'),1)))),
        channel=channel,short=short,
        blend='additive' if d.get('DestBlend')=='D3DBLEND_ONE' else 'blend',
        native=d,approximation='Native texture frames on angle-normalized radial overlays around a solid core; emitter motion and size curves are not simulated.')]

def preset(root, family, guard=False, diagnostics=None):
    names=PRESETS.get(family,PRESETS['standard'])
    if family=='unstable' and guard:names=['dhg_unstable_saber_vent_core_alpha_blended','unstable_saber_blade_alpha_blended']
    return [layer for name in names for layer in layers(root,PARTICLES+name+'.prt',diagnostics)]

def native_layers(root, files, diagnostics=None):
    result=[];seen=set()
    for file in files:
        for row in effect_rows(file):
            resource=row.get('_fxResourceName','')
            if not resource.endswith('.prt') or not persistent(row):continue
            for layer in layers(root,resource,diagnostics):
                key=(row.get('_fxAttachBone'),row.get('_fxAttachTo'),layer['texture'],row.get('_fxAttachPosition'),row.get('_fxScale'))
                # Native files repeat camera ribbons at several angles. Our radial
                # mesh handles those views without tripling opacity.
                if key in seen:continue
                seen.add(key);result.append({**layer,'attachment':row,'effectFile':str(file)})
    return result
