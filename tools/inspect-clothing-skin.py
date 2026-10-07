from build_local_npcs import Builder
b=Builder()
for a in b.assets.values():
 if a.findtext('ArtName') in ['hand_glove','hand_glove_archetype','chest_jacket','hand_glove_bm_archetype'] or a.findtext('BaseFile','').endswith('hand_glove_[bt]_archetype.gr2'):
  print(a.findtext('ArtName'),a.findtext('BaseFile'),a.findtext('SkinMaterialIndex'))
