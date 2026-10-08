# Changelog

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
- Add cache regression coverage to Windows source checks and include the user
  guide, release notes and changelog in the portable package.

## 0.2.1 — 2026-10-07

- Added live lightsaber blade position, length and thickness controls.
- Corrected facial reference poses for affected small-female stealth animations.
- Fixed conversion-cache recovery and serialization.
- Preserve distinct Unity materials when sanitized names would otherwise collide.
- Included AI disclosure, contributor credits, upstream notices and source bundles.
