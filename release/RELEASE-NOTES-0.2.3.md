# SWTOR Model Viewer 0.2.3 — Workspace and customization update

Character editing now keeps appearance, the model and equipment together, with
more room for attachments and a resizable animation workspace.

## Download and start

Download **SWTOR-Model-Viewer-0.2.3-Windows-x64.zip**, extract the whole folder,
and run **SWTOR Model Viewer.exe**. Blender, Python and the GR2 importer are
included. Supply your own SWTOR installation and extracted Resources folder.
The portable executable is unsigned; no installer is required.

The optional **Sources.zip** includes the viewer and matching upstream sources.
Both archives have SHA-256 checksum files.

## What's changed

- Appearance controls sit left of the viewer; equipment and attachments remain
  available in a full-height panel on the right. Equipment browsing opens on the
  left without covering the character.
- Color dropdowns sit beside applicable appearance choices. Species-specific
  controls remain available, including head-dependent options.
- Each equipped item's dropdown edits the whole item or an individual mesh,
  with independent primary and secondary channels and per-channel resets.
- A red X clears all equipment layers in that slot immediately in the draft.
  Apply equipment commits it; Revert changes restores the applied equipment.
- Drag the animation bar's top edge to change its height and the list divider to
  change its width. The scrollable grid gains rows and columns as space grows.
  Previous/Next pagination stays available, and dimensions are remembered.
- Fixed hand-slot catalog loops, off-hand routing after category changes,
  duplicate-layer draft merging, lost color edits during option loading, and
  clear-slot buttons requiring an extra item-selection click after Apply.

## Updating

Close the viewer and extract this version into a new application folder.
Existing presets, settings and catalogs remain compatible. The storage and cache
controls introduced in 0.2.2 remain available. Apply pending appearance and
equipment edits before saving or exporting.

See the included user guide and changelog for details.

## Limits and credits

Exports contain the selected pose, not an entire animation sequence. Full cloth
physics and exact game rendering are not implemented. Unity Built-in materials
have local validation; URP/HDRP and Tabletop Simulator are not fully validated.
No game models, textures, animations or extracted catalogs are distributed.

Free community software under GPL-3.0-or-later. Generated with AI using OpenAI
Codex under Joystick1898's direction. Thanks to ZeroGravitas, SWTOR Slicers and
the upstream projects; their licenses, notices and source distributions remain included.
