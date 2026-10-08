# SWTOR Model Viewer

A free, open-source Windows workbench for viewing **Star Wars: The Old Republic**
models, customizing characters, posing animations, editing equipment and
lightsabers, and exporting textured FBX files for modding.

**[Download the latest Windows release](https://github.com/joystick1898/SWTOR-Model-Viewer/releases/latest)** ·
[User guide](docs/USER-GUIDE.md) ·
[Report a bug](https://github.com/joystick1898/SWTOR-Model-Viewer/issues/new/choose)

## Get started

1. Download the **Windows-x64.zip** from Releases and extract the entire folder.
2. Run **SWTOR Model Viewer.exe**.
3. Select your extracted SWTOR **Resources** folder and installed game folder.
4. Let the first setup build its catalogs, then choose Character Designer,
   NPC Browser, or Asset Browser.

The portable package includes Blender, Python and the GR2 importer. No separate
runtime installation is needed. The executable is unsigned. You supply your own
game installation and extracted resources; no game assets are distributed here.
See [SWTOR Slicers' guides](https://github.com/SWTOR-Slicers/WikiPedia/wiki) for
community extraction and asset workflows.

## What it does

- Browse local models, named NPCs and available animations.
- Customize supported characters, appearance choices and piece colors.
- Add equipment and independent attachments, with viewport transform controls.
- Edit lightsaber blades, crossguards, colors and supported persistent effects.
- Scrub animations and apply supported facial expressions to create a pose.
- Save character presets and export posed FBX with textures and optional bones.
- Generate companion Unity Built-in materials and preserve their import metadata.

[Version 0.2.3 notes](release/RELEASE-NOTES-0.2.3.md) describe the split workspace,
per-piece color menus, clear-slot buttons and resizable animation dock.
See the [changelog](CHANGELOG.md) for release history.

## Export and update

Keep an exported FBX together with its `.textures` and `.materials` folders and
all companion files. Follow `UNITY_IMPORT.txt` next to the export. Full animation
export and cloth physics are not implemented. Game materials and some effects
are approximations; URP/HDRP and Tabletop Simulator are not fully validated.

To update, close the app and extract the new version into its own folder.
Settings and caches stay in `%APPDATA%/SWTOR Model Viewer`. Source folders can be
changed in Settings. The app reads game resources and keeps recovered files in
its own cache without modifying the installed game or extraction.

Settings includes storage usage, a generated-data folder picker, **Clear preview
cache**, and a configurable preview/material cache limit (default **2 GiB**).
Previews unused for **14 days** expire by default; least recently used previews
are removed sooner when the limit is reached. Set the limit to **0 GiB** to retain
no previews between requests, or enable clearing previews on exit. Catalogs and
recovered game resources require additional space, and conversions temporarily
need extra working space. Smaller caches mean slower repeat previews. Successful
setup removes obsolete snapshots; completed export intermediates are discarded.
Saved exports and presets are kept. See the [storage guide](docs/USER-GUIDE.md#storage-and-cache).

## Development

Use Windows x64 and Node.js 24. Packaging tools require Node.js 22.12 or newer.

```powershell
npm ci
Copy-Item development.example.json development.local.json
# Configure your runtime, game and resource paths in development.local.json.
npm start
```

Build-time dependencies are Blender 4.3.2, Python 3.14.7 and the SWTOR Slicers GR2
importer 4.0.7. These are bundled for users of the portable release.

```powershell
npm run bundle:windows
```

This creates the Windows ZIP, companion Sources ZIP and checksums, with notices
and credits included automatically. Keep the source download available alongside
the Windows download when sharing a release. Users need only the Windows ZIP to
run the viewer.

See [contributing](CONTRIBUTING.md) for checks that work without game data and
[release build instructions](release/README.md) for packaging and integration tests.
The full test suite uses local game/resource fixtures and is not a game-free CI job.

## AI, credits and license

This application was generated with AI using **OpenAI Codex**, under the direction
of **Joystick1898**. It is a free community project and is not sold or monetized.

Special thanks to **ZeroGravitas and SWTOR Slicers** for their tools and community
work. See [contributors](CONTRIBUTORS.md) and
[third-party notices](THIRD-PARTY-NOTICES.txt) for credits and upstream licenses.

The viewer's original code is licensed under **[GPL-3.0-or-later](LICENSE)**.
Third-party software retains its own authorship and licenses. Star Wars and SWTOR
names and game content belong to their respective rights holders; the software
license does not grant rights to game content. This is an independent community
project and is not an official game product.
