# Windows release build

The release process includes the AI disclosure, contributor credits, original
viewer license, full upstream notices, and source distributions automatically.
The viewer's original code is licensed under GPL-3.0-or-later. Third-party
components retain their own licenses. The app is free community software.

## Release status

The upcoming **0.2.4** source update adds ZG Tools Character Assembler compatibility.
[Release notes](RELEASE-NOTES-0.2.4.md) and the [compatibility guide](../docs/ZG-COMPATIBILITY.md)
describe its tested scope. The latest published Windows/Sources archives remain
**0.2.3**. Do not describe those archives as containing the ZG exporter.

Before publishing 0.2.4, build new archives and checksums, run packaged validation,
and upload both Windows and Sources packages with the 0.2.4 release notes.
Keep the existing 0.2.3 release and its assets intact. The source version is 0.2.4;
its changelog section remains Unreleased until the package is published.

## Build

On Windows x64, install Node.js/npm and configure `development.local.json` using
`development.example.json`. The tested build runtimes are Blender 4.3.2,
Python 3.14.7 and the SWTOR Slicers GR2 importer 4.0.7. Then run:

```powershell
npm ci
npm test
npm run bundle:windows
```

The command packages the current working tree, includes the release documents,
captures its source, downloads and verifies Blender's official source archives,
and writes the Windows ZIP, companion Sources ZIP and SHA-256 files to `dist`.
The first build downloads approximately 1.65 GB of upstream source; later builds
reuse the checksum-verified cache in `dist/source-cache`.

The Windows ZIP is all a user needs to run the app. Keep the Sources ZIP available
alongside it when sharing a release. The runtime ZIP also includes the small viewer
source snapshot and the GR2 Python source. See [SOURCE-CODE.txt](SOURCE-CODE.txt)
for source versions and build instructions. No manual notice-copy step is needed.
ZIP timestamps are clamped automatically when a dependency predates 1980.

`dist/latest.json` records package paths, sizes and checksums. The directory
inventory includes release documents and source metadata. `inventoryHash` tracks
paths and sizes; the final ZIP SHA-256 hashes identify the actual archive contents.
Previous versions remain in `dist`; increment the project version for a new release.
The portable package also includes `CHANGELOG.md`, `RELEASE-NOTES.md` for the
packaged version, and `docs/USER-GUIDE.md`.

## Verification

With the local developer game/resource configuration available:

```powershell
node tools/packaged-ui-smoke.mjs
node tools/packaged-pipeline-smoke.mjs
node tools/recovery-smoke.mjs
```

The UI smoke starts with a fresh test profile; the pipeline smoke then uses the
catalogs it produced. These checks cover first setup, textured character loading,
searches, representative posed FBX exports and re-imports. Local tests are recorded
as local tests; they do not claim testing on another physical Windows machine.
The portable executable is unsigned and has no installer.

For 0.2.4, also verify the packaged Export for ZG Tools action and fine-tuning
controls. Import the resulting `assets/paths.json` with unmodified ZG Tools
2.0.14 and its paired GR2 4.2.1 importer in a separate Blender configuration.
Check hidden helmet/head combinations, native palettes, recovered dependencies,
materials and skeleton bindings. Source-level verification does not substitute
for checking the newly built portable package.

## Source and notices

The original viewer license is `LICENSE` in the repository and `VIEWER-LICENSE.txt`
in the package, preserving Electron's separate `LICENSE`. Blender's complete
license tree, Chromium notices, Python notices and GR2 license/source remain in
their runtime locations. [Contributors](../CONTRIBUTORS.md) credits ZeroGravitas,
SWTOR Slicers and the other upstream projects. An AI disclosure appears during
setup and in START-HERE.

Blender 4.3.2 source and Blender's official 4.3.0 library-source collection are
included in the companion archive. Their dependency version definitions match.
The installed Blender build identifies commit `32f5fdce0a0a`. The source manifest
records the official download URLs, upstream checksums and local SHA-256 hashes.

The source snapshot excludes local configuration, generated output, caches,
game data, Git history, and historical reports containing local paths. The existing
repository is left intact. No GitHub publication or history rewrite is performed
by the build command.
