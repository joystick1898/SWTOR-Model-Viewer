# Changelog

## 0.2.4 — 2026-10-09

ZG Tools Character Assembler compatibility update. Windows and matching Sources
packages are available from [Releases](https://github.com/joystick1898/SWTOR-Model-Viewer/releases/tag/v0.2.4).
See [0.2.4 release notes](release/RELEASE-NOTES-0.2.4.md) for usage, verification and limits.

- Fixed a workspace-switch crash when live attachment controls still referenced
  equipment from the previous workspace.
- Fine-tuning arrows and keyboard arrows step by 0.1 from the applied preview's
  palette value when a field is automatic, while retaining precise typed values.
- Hidden equipment layers no longer cause gear-name conflicts in ZG exports.
  Palette translation reuses decoded texture pairs and visibility checks reuse
  the preview's source index instead of repeatedly reading hidden models.
- Added clearer validation of malformed native palette values and saved color
  dictionaries, plus regression coverage in local checks and Windows CI.
- Removed Whole item / Whole layer color options; equipment colors are edited
  per piece with primary and secondary dye channels. Legacy saved colors remain supported.
- Armor color wheels now calibrate against the selected dye-mask region instead
  of the whole palette image. Added optional native hue, saturation, brightness
  and contrast fields, preserved in saved characters and ZG exports.
- ZG visibility export now uses the applied preview's model/layer mapping for
  hidden equipment instead of relying solely on reconstructed object names.
- Added Export for ZG Tools to Character Designer and NPC Browser. Writes
  legacy paths.json, skeleton.json and gear-name preset.json without changing
  the preview or FBX pipeline.
- Translates supported custom colors to native palettes, preserves clothing
  replacements and selected components, and reports unsupported material conflicts.
- Includes a minimal Resources tree when a character depends on recovered assets,
  with import instructions and no changes to the source extraction.
- Verified actual imports with ZG Tools 2.0.14 and its paired GR2 importer 4.2.1.

## 0.2.3 — 2026-10-08

- Reorganized the workspace around appearance on the left, the viewer in the
  center, and a persistent equipment panel extending to the bottom on the right.
- Added adjacent color dropdowns for skin, eyes, hair and individual appearance
  pieces while preserving species- and head-specific customization options.
- Added equipment color dropdowns with whole-item and per-mesh primary/secondary
  channels, explicit Apply/Revert actions, and a catalog alongside the viewer.
- Added a red clear-slot button that immediately returns the draft slot to
  Choose item, including all layers in that slot. Apply equipment commits removal.
- Added a resizable animation dock and list divider with remembered dimensions,
  a responsive scrollable animation grid, and retained Previous/Next pagination.
- Fixed repeated hand-slot catalog requests, off-hand destination loss when
  changing categories, duplicate-layer draft reconciliation, appearance edits
  overwritten during option loading, and clear buttons staying disabled after Apply.
- Reduced repeated slot classification and canceled obsolete catalog searches.

## 0.2.2 — 2026-10-08

- Added a configurable preview and baked-material cache limit in Settings,
  defaulting to 2 GiB. Least recently used previews are removed when needed.
- Added expiry after 14 unused days by default, a zero-retention option,
  clear-on-close, and an immediate Clear preview cache button.
- Added separate disk-usage totals for previews and required catalogs/resources,
  plus a generated-data folder picker for storing the data on another drive.
- Automatically remove obsolete, failed and interrupted setup snapshots after a
  successful startup, and discard conversion/export intermediates after use.
- Preserve shared textures until cached models no longer reference them. Wait
  for conversion workers and export copies to finish before cleanup.
- Preserve saved exports and presets. Document additional catalog/resource space
  and temporary conversion space in setup, the user guide and release documents.
- Resolve Windows folder aliases before validating the generated-data location.
- Add cache regression coverage to Windows source checks and include the user
  guide, release notes and changelog in the portable package.

## 0.2.1 — 2026-10-07

- Added live lightsaber blade position, length and thickness controls.
- Corrected facial reference poses for affected small-female stealth animations.
- Fixed conversion-cache recovery and serialization.
- Preserve distinct Unity materials when sanitized names would otherwise collide.
- Included AI disclosure, contributor credits, upstream notices and source bundles.
