from build_local_npcs import Builder
b=Builder()
for n in ['epp.player.alignment.dark_side_appearance']:
 d=b.node(b.g.names[n]);print(n,d)
for n in b.g.names:
 if n.startswith(('chr.','prototype.','sys.','cbt.','dynamic.','app.','tbl.')) and any(x in n for x in ['dark','corrupt','alignment']):print(n)
