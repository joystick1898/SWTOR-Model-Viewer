"""Recover referenced paths from the user's installation, never from the network."""
import json,sys
from pathlib import Path
from runtime_paths import DATA,setting
from local_tor import Archives
root=setting('resources');overlay=DATA/'npc-resources';archives=Archives(setting('game')/'Assets')
recovered=[];missing=[];errors=[]
for relative in json.loads(Path(sys.argv[1]).read_text(encoding='utf-8')):
    relative=relative.replace('\\','/')
    if not relative.startswith(('art/','anim/')) or '..' in relative.split('/') or ':' in relative:raise ValueError('Invalid resource path')
    destination=overlay/relative
    if (root/relative).is_file() or destination.is_file():continue
    try:content=archives.read(relative)
    except FileNotFoundError:missing.append(relative);continue
    except Exception as error:errors.append(dict(path=relative,error=str(error)));continue
    destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(content);recovered.append(relative)
with (DATA/'recovery.jsonl').open('a',encoding='utf-8') as f:f.write(json.dumps(dict(recovered=recovered,missing=missing,errors=errors))+'\n')
print(json.dumps(dict(recovered=len(recovered),missing=len(missing),errors=len(errors))))
