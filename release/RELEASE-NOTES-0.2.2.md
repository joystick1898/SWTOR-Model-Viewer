# SWTOR Model Viewer 0.2.2 — Storage and cache controls

Browsing models now has a configurable limit on retained previews and baked
materials. This release addresses generated data growing without a size limit
and old setup snapshots remaining indefinitely.

## Download and start

Download **SWTOR-Model-Viewer-0.2.2-Windows-x64.zip**, extract the entire folder,
and run **SWTOR Model Viewer.exe**. Blender, Python and the GR2 importer are
included. You supply your own SWTOR installation and extracted Resources folder.
The portable executable is unsigned; no installer is required.

The **Sources.zip** contains the viewer and matching Blender/library sources;
it is optional for running the app. Both downloads have SHA-256 files.

## What's changed

- **Cache size:** choose the retained preview/material budget in Settings.
  The default is **2 GiB**; **0 GiB** retains no previews between requests.
  Least recently used previews are removed first.
- **Cache age:** previews expire after **14 unused days** by default. The age
  can be changed, and reusing a cached preview refreshes its last-use time.
- **Cleanup controls:** clear previews immediately or when closing the viewer.
- **Storage visibility:** see preview-cache usage and required catalog/resource
  usage separately. Choose another drive for generated data.
- **Automatic cleanup:** obsolete and failed/interrupted setup snapshots are
  removed after successful startup. Conversion/export intermediates are temporary.
- **Safe reuse:** shared textures are kept while retained previews need them.
  Cleanup waits for active workers and export copies to finish.

Saved exports and presets are preserved. Catalogs, recovered game resources and
Electron's browser caches are additional storage outside the preview limit.
Conversions temporarily need extra working space and can exceed the retained
budget. Smaller limits can make repeat previews slower.

## Updating from 0.2.1

Close the viewer and extract 0.2.2 into a new application folder. Existing settings
and the current catalogs are reused when the selected game data has not changed.
The first successful startup applies the default cache policy and removes
obsolete snapshots. Open **Settings → Storage and preview cache** to change it.
Changing the generated-data location rebuilds catalogs before retiring the old
snapshot. Changing only cache preferences does not rebuild the catalogs.

See the included user guide and [changelog](https://github.com/joystick1898/SWTOR-Model-Viewer/blob/v0.2.2/CHANGELOG.md) for details.

## Limits and credits

All 60 local regression tests passed with isolated catalog fixtures. The 20
game-independent checks used by Windows CI and the Electron storage-settings
smoke test also passed locally.

Exports contain a selected pose, not a full animation sequence. Full cloth
physics and exact game rendering fidelity are not implemented. Unity Built-in
materials have local validation; URP/HDRP and Tabletop Simulator are not fully
validated. No game models, textures, animations or extracted catalogs are included.

Free community software under GPL-3.0-or-later. Generated with AI using OpenAI
Codex under Joystick1898's direction. Thanks to ZeroGravitas, SWTOR Slicers and
the upstream projects; their licenses, notices and source distributions are kept.
