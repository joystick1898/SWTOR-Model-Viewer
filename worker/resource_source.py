"""Source selection shared by mesh, skeleton and material conversion."""
import os,json,subprocess,uuid
from pathlib import Path

def source(root,relative):
    root=Path(root).resolve();relative=relative.replace('\\','/').lstrip('/')
    if '..' in relative.split('/') or ':' in relative:raise ValueError('Resource outside source folder')
    primary=(root/relative).resolve()
    if not primary.is_relative_to(root):raise ValueError('Resource outside source folder')
    if primary.is_file():return primary
    data=Path(os.environ.get('SWTOR_DATA',Path(__file__).resolve().parents[1]/'output'))
    recovered=(data/'npc-resources'/relative).resolve()
    if not recovered.is_relative_to((data/'npc-resources').resolve()):raise ValueError('Resource outside cache')
    if not recovered.is_file() and os.environ.get('SWTOR_GAME') and os.environ.get('SWTOR_PYTHON') and relative.startswith(('art/','anim/')):
        request=data/('recovery-'+uuid.uuid4().hex+'.json');request.write_text(json.dumps([relative]),encoding='utf-8')
        try:
            result=subprocess.run([os.environ['SWTOR_PYTHON'],str(Path(__file__).resolve().parents[1]/'tools/recover_sources.py'),str(request)],capture_output=True,text=True,creationflags=0x08000000 if os.name=='nt' else 0)
            if result.returncode:raise ValueError('Game dependency recovery failed: '+result.stderr[-1000:])
        finally:request.unlink(missing_ok=True)
    return recovered
