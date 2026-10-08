"""Prepare matching upstream source and an exact viewer source snapshot."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import time
import urllib.request
import zipfile

PROJECT = Path(__file__).resolve().parents[1]
UPSTREAM = (
    ('blender-4.3.2.tar.xz', 'da5763a70f32202832b31d57808d756d'),
    ('blender-with-libraries-4.3.0.tar.xz', '0921224ea4801c5f3f2e2e822734a648'),
)


def digest(file, algorithm='sha256'):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, algorithm).hexdigest()


def download(name, expected_md5):
    cache = PROJECT / 'dist/source-cache'
    cache.mkdir(parents=True, exist_ok=True)
    destination = cache / name
    url = 'https://download.blender.org/source/' + name
    if destination.exists() and digest(destination, 'md5') == expected_md5:
        print('Verified cached source:', name, flush=True)
        return destination, url
    partial = destination.with_suffix(destination.suffix + '.partial')
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'SWTOR-Model-Viewer-release'})
            with urllib.request.urlopen(request, timeout=60) as response, partial.open('wb') as output:
                downloaded, next_progress = 0, 0
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
                    downloaded += len(chunk)
                    if downloaded >= next_progress:
                        print(f'{name}: {downloaded // (1024 * 1024)} MiB', flush=True)
                        next_progress = downloaded + 64 * 1024 * 1024
            if digest(partial, 'md5') != expected_md5:
                raise ValueError('Upstream checksum mismatch: ' + name)
            partial.replace(destination)
            return destination, url
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2)


def zip_files(destination, entries):
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED, strict_timestamps=False) as archive:
        for file, relative in sorted(entries, key=lambda entry: str(entry[1])):
            archive.write(file, str(relative).replace('\\', '/'))


def source_files(root):
    return (file for file in root.rglob('*') if file.is_file()
            and not any(part in {'__pycache__', '.git', 'node_modules'} for part in file.relative_to(root).parts)
            and file.suffix not in {'.pyc', '.pdb'})


def dependency_definitions(file):
    with tarfile.open(file, 'r|xz') as archive:
        for member in archive:
            if member.name.endswith('/build_files/build_environment/cmake/versions.cmake'):
                return archive.extractfile(member).read()
    raise ValueError('Blender dependency definitions missing from ' + file.name)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--download-only', action='store_true')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--app', type=Path)
    args = parser.parse_args()
    sources = [(download(name, md5), md5) for name, md5 in UPSTREAM]
    definitions = [dependency_definitions(item[0][0]) for item in sources]
    if definitions[0] != definitions[1]:
        raise ValueError('Blender library sources do not match the release dependency versions')
    if args.download_only:
        return
    if not args.output or not args.app:
        parser.error('--output and --app are required')
    output, app = args.output.resolve(), args.app.resolve()
    if not output.is_relative_to(PROJECT / 'dist') or not app.is_relative_to(PROJECT / 'dist'):
        raise ValueError('Release output must be inside dist')
    output.mkdir(parents=True, exist_ok=True)
    blender_version = subprocess.check_output([str(app / 'resources/runtime/blender/blender.exe'), '--version'], text=True)
    if 'Blender 4.3.2' not in blender_version or '32f5fdce0a0a' not in blender_version:
        raise ValueError('Bundled Blender does not match the prepared 4.3.2 source')
    version = json.loads((PROJECT / 'package.json').read_text())['version']
    records = []
    for (file, url), md5 in sources:
        target = output / file.name
        if not target.exists():
            try:
                os.link(file, target)
            except OSError:
                shutil.copyfile(file, target)
        records.append({'file': target.name, 'url': url, 'bytes': target.stat().st_size,
                        'upstreamMd5': md5, 'sha256': digest(target)})
    entries = []
    for directory in ('src', 'worker', 'assets', 'tools', 'tests', 'release', 'docs', '.github'):
        entries.extend((file, file.relative_to(PROJECT)) for file in source_files(PROJECT / directory))
    for name in ('package.json', 'package-lock.json', 'development.example.json', 'README.md', 'CHANGELOG.md',
                 'CONTRIBUTORS.md', 'CONTRIBUTING.md', 'THIRD-PARTY-NOTICES.txt',
                 'LICENSE', '.gitignore', 'Start-Viewer.cmd'):
        entries.append((PROJECT / name, Path(name)))
    viewer_source = output / f'SWTOR-Model-Viewer-{version}-source.zip'
    zip_files(viewer_source, entries)
    addon = app / 'resources/runtime/addons/io_scene_gr2'
    addon_source = output / 'io_scene_gr2-4.0.7-source.zip'
    zip_files(addon_source, ((file, Path('io_scene_gr2') / file.relative_to(addon)) for file in source_files(addon)))
    for file in (viewer_source, addon_source):
        records.append({'file': file.name, 'bytes': file.stat().st_size, 'sha256': digest(file)})
    text = (PROJECT / 'release/SOURCE-CODE.txt').read_text(encoding='utf-8').replace('{{VERSION}}', version)
    (output / 'SOURCE-CODE.txt').write_text(text, encoding='utf-8')
    shutil.copyfile(PROJECT / 'LICENSE', output / 'VIEWER-LICENSE.txt')
    manifest = {'viewerVersion': version, 'blenderVersion': '4.3.2', 'blenderCommit': '32f5fdce0a0a',
                'librarySources': '4.3.0 library-source set; dependency versions unchanged in 4.3.2',
                'dependencyDefinitionsSha256': hashlib.sha256(definitions[0]).hexdigest(),
                'files': records}
    manifest_text = json.dumps(manifest, indent=2) + '\n'
    (output / 'sources-manifest.json').write_text(manifest_text, encoding='utf-8')
    (app / 'sources-manifest.json').write_text(manifest_text, encoding='utf-8')
    # Original viewer source is small enough to travel with the runnable package too.
    (app / 'source').mkdir(exist_ok=True)
    shutil.copyfile(viewer_source, app / 'source' / viewer_source.name)
    print('Prepared source distribution:', output, flush=True)


if __name__ == '__main__':
    main()
