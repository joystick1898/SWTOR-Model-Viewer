"""Create the portable release ZIP without including development data."""
import json,zipfile,hashlib
from pathlib import Path
project=Path(__file__).resolve().parents[1]
latest=project/'dist/latest.json';build=json.loads(latest.read_text(encoding='utf-8'))
source=Path(build['app']).resolve()
if not source.is_relative_to((project/'dist').resolve()):raise ValueError('Package must be inside dist')
destination=project/'dist'/('SWTOR-Model-Viewer-'+build['version']+'-Windows-x64.zip')
temporary=destination.with_suffix('.zip.partial')
with zipfile.ZipFile(temporary,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True,strict_timestamps=False) as archive:
    for file in sorted(source.rglob('*')):
        if file.is_file() and '__pycache__' not in file.parts and file.suffix!='.pyc':archive.write(file,Path('SWTOR Model Viewer')/file.relative_to(source))
temporary.replace(destination)
digest=hashlib.sha256()
with destination.open('rb') as f:
    while chunk:=f.read(1024*1024):digest.update(chunk)
build.update(zip=str(destination),zipBytes=destination.stat().st_size,sha256=digest.hexdigest())
source_directory=Path(build['sourceDirectory']).resolve()
if not source_directory.is_relative_to((project/'dist').resolve()):raise ValueError('Sources must be inside dist')
source_zip=destination.with_name('SWTOR-Model-Viewer-'+build['version']+'-Sources.zip')
source_temporary=source_zip.with_suffix('.zip.partial')
# The upstream tar.xz and viewer ZIP files are already compressed.
with zipfile.ZipFile(source_temporary,'w',compression=zipfile.ZIP_STORED,allowZip64=True,strict_timestamps=False) as archive:
    for file in sorted(source_directory.rglob('*')):
        if file.is_file():archive.write(file,Path('SWTOR Model Viewer Sources')/file.relative_to(source_directory))
source_temporary.replace(source_zip)
with source_zip.open('rb') as stream:source_digest=hashlib.file_digest(stream,'sha256').hexdigest()
build.update(sourceZip=str(source_zip),sourceZipBytes=source_zip.stat().st_size,sourceSha256=source_digest)
source_zip.with_suffix('.zip.sha256').write_text(source_digest+'  '+source_zip.name+'\n',encoding='utf-8')
latest.write_text(json.dumps(build,indent=2),encoding='utf-8')
destination.with_suffix('.zip.sha256').write_text(digest.hexdigest()+'  '+destination.name+'\n',encoding='utf-8')
print(json.dumps(build,indent=2))
