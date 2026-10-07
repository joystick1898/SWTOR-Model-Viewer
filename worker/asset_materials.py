"""Resolve a portable material from native catalog and shader references."""
import xml.etree.ElementTree as ET
from pathlib import Path
from resource_source import source as resource_source
PROPERTIES={'DiffuseMap':'diffuseMap','RotationMap1':'rotationMap','GlossMap':'glossMap','PaletteMaskMap':'paletteMaskMap','PaletteMap':'paletteMap','DirectionMap':'directionMap'}
def resolve_material(resources,original,metadata,selection,model):
    resources=Path(resources).resolve()
    def source(relative):
        return resource_source(resources,relative)
    def read(relative):return ET.parse(source(relative)).getroot()
    available=[m for m in metadata['materials'] if source(m).is_file()]
    selected=selection or next((m for m in available if Path(m).stem==Path(model).stem+'_v01'),None) or next(iter(available),None)
    relative='art/shaders/materials/'+original.split('.')[0]+'.mat'
    placeholder=original.split('.')[0].lower() in ['default','defaultmirror','standardmaterial']
    if (not source(relative).is_file() or placeholder) and selected:
        relative=selected
        if original.lower().startswith('defaultmirror'):
            eyes=[m for m in metadata.get('materialOverrides',{}).get(selected,[]) if Path(m).name.startswith('eye_') and source(m).is_file()]
            if len(eyes)==1:relative=eyes[0]
    xml=read(relative);family=xml.findtext('Derived')
    diffuse=next((e.findtext('value') for e in xml.findall('input') if e.findtext('semantic')=='DiffuseMap'),None)
    if diffuse and not source(diffuse.replace('\\','/')+'.dds').is_file() and selected:
        relative=selected;xml=read(relative);family=xml.findtext('Derived')
    if selection and family!='Eye':
        replacement=read(selection)
        if replacement.findtext('Derived')==family:xml=replacement;relative=selection
    if family=='HighQualityCharacter':family='Creature'
    # Defiant's emitter overlay uses AnimatedUV, but both animated layers are
    # disabled in its native material. Preserve the static additive diffuse
    # layer instead of rejecting the whole vented hilt. Other AnimatedUV
    # materials still need an explicit adapter.
    static_saber_overlay=False
    if family=='AnimatedUV' and Path(relative).stem.startswith('weapon_saber_'):
        values={e.findtext('semantic'):e.findtext('value') for e in xml.findall('input')}
        def zero(key,count=None):
            value=values.get(key)
            return value is not None and all(float(v)==0 for v in value.split(',')[:count])
        static_saber_overlay=xml.findtext('AlphaMode')=='Add' and zero('animTexTint1') and zero('animTexTint2',3) and zero('animTexUVScrollSpeed0') and zero('animTexRotationSpeed0') and values.get('animTexTint0')=='1,1,1,1'
        if static_saber_overlay:family='EmissiveOnly'
    if family not in ['Creature','Garment','HairC','SkinB','Eye','Uber','EmissiveOnly']:raise ValueError('Shader '+str(family)+' needs a material adapter')
    info={'ddsPaths':{},'otherValues':{'derived':family},'portableAlphaMode':'cutout' if xml.findtext('AlphaMode')=='Test' or family=='HairC' else 'opaque','portableAlphaCutoff':.75 if family=='HairC' else float(xml.findtext('AlphaTestValue') or .5)}
    if static_saber_overlay:
        info['portableAlphaMode']='additive'
        info['portableMaterialNote']='Static additive saber overlay; native animated layers are disabled'
    for entry in xml.findall('input'):
        semantic=entry.findtext('semantic');value=entry.findtext('value')
        if semantic in PROPERTIES and value:
            texture=value.replace('\\','/')+'.dds'
            # View-dependent directional highlights are omitted from portable color.
            if semantic!='DirectionMap' or source(texture).is_file():info['ddsPaths'][PROPERTIES[semantic]]=texture
        if semantic in ['Palette1','Palette2','Palette1Specular','Palette2Specular','Palette1MetallicSpecular','Palette2MetallicSpecular'] and value:
            values=[float(v) for v in value.split(',')]
            info['otherValues'][semantic[0].lower()+semantic[1:]]=values[:3] if 'Specular' in semantic else values
        if semantic=='FleshBrightness' and value:info['otherValues']['fleshBrightness']=float(value)
        if semantic=='FlushTone' and value:info['otherValues']['flush']=[float(v) for v in value.split(',')]
    for texture in info['ddsPaths'].values():
        if not source(texture).is_file():raise ValueError('Missing texture: '+texture)
    return info,relative
