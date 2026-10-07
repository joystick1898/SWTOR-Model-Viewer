"""Report the versions we can actually read, without guessing compatibility."""
import json
from runtime_paths import setting
from local_tor import Archives
def version(text):
    return dict(line.split('=',1) for line in text.splitlines() if '=' in line)
resources=version((setting('resources')/'version.txt').read_text(encoding='utf-8'))
try:
    game=version(Archives(setting('game')/'Assets').read('version.txt').decode('utf-8'))
except FileNotFoundError:
    game={}
keys=['assetChangelist','dbVersion','compatibleClient']
mismatch=any(resources.get(k)!=game[k] for k in keys if k in game and k in resources)
print(json.dumps(dict(resources=resources,game=game,mismatch=mismatch,warning=None if game else 'Game archives do not expose a version record; exact extraction/version matching could not be verified.')))
