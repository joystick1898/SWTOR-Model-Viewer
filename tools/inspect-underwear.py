from build_local_npcs import Builder
import xml.etree.ElementTree as E
b=Builder()
for a in b.assets.values():
 n=a.findtext('ArtName','')
 if ('naked' in n or 'underwear' in n) and n.split('_')[0] in ['chest','leg','hand','boot','waist','bracer']:
  print(n,a.findtext('ID'),a.findtext('BaseFile'),[(m.get('id'),m.get('filename')) for m in a.findall('Materials/Material')][:2],a.findtext('SkinMaterialIndex'))
