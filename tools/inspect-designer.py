from build_local_npcs import Builder,F
from local_tor import strings
from collections import Counter
b=Builder();st=strings(b.archives.read('en-us/str/pcs.stb'))
for name in ['pcs.imperial_agent.male.cathar','pcs.jedi_knight.female.rattataki_legacy','pcs.jedi_knight.male.human','pcs.jedi_knight.female.togruta','pcs.trooper.male.nautolan']:
 d=b.node(b.g.names[name]);entries=d['4611686034028470000'];print('\n',name)
 for key in d['4611686088523270013']:
  ids=d['4611686086145961605'][str(key)];a=b.asset(entries[str(ids[0])].get(F['asset']));print('BODY',key,a.findtext('ArtName'),a.findtext('BaseFile'),[x.text for x in a.findall('BodyTypes/*')])
 print('labels',{k:st.get(v) for k,v in d['4611686093953769991'].items()})
 print('blank',[(k,v) for k,v in entries.items() if not v.get('4611686031694070054')][:2])
 print('rule',next(iter(d['4611686034054470003'].items())))
