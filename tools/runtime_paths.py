"""Shared source and writable-data paths; release callers supply environment values."""
import json, os
from pathlib import Path
PROJECT = Path(__file__).resolve().parents[1]
local = {}
if os.environ.get('SWTOR_PACKAGED') != '1':
    try: local = json.loads((PROJECT / 'development.local.json').read_text(encoding='utf-8'))
    except (FileNotFoundError, ValueError): pass
def setting(name):
    value = os.environ.get('SWTOR_' + name.upper()) or local.get(name)
    if not value: raise ValueError('Configure the ' + name + ' path in viewer setup.')
    return Path(value)
DATA = Path(os.environ.get('SWTOR_DATA', PROJECT / 'output'))
REPORTS = DATA / 'diagnostics' if os.environ.get('SWTOR_DATA') else PROJECT / 'reports'
REPORTS.mkdir(parents=True, exist_ok=True)
