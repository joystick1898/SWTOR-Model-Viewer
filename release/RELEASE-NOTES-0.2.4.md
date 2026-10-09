# SWTOR Model Viewer 0.2.4 — ZG Tools Character Assembler compatibility

**Status: upcoming release.** The features are implemented in the repository's
source. New Windows and Sources archives have not yet been built or published.
The latest downloadable package remains 0.2.3 and does not include this update.

## What's changed

- **Export for ZG Tools** in Character Designer and NPC Browser writes the legacy
  TORCommunity character format: `assets/paths.json`, `skeleton.json`, and known
  equipped gear names in `preset.json`. The existing preview and FBX workflow remain available.
- Clothing replacements, selected components, native palettes, exposed skin,
  eyes and the character's skeleton are translated from the applied character.
- Supported custom colors become native palette parameters. Armor color wheels
  sample the selected dye-mask region, improving cases where red appeared orange.
- **Fine-tune color** adds native Hue, Saturation, Brightness and Contrast beside
  the wheel. Buttons and keyboard arrows adjust by 0.1 from the applied preview
  value; typed numbers retain precision. Saved presets preserve these controls.
- Dye editors list included pieces with separate primary and secondary channels.
  Whole item / Whole layer options are removed; older saved colors still work.
- Hidden helmets export correctly while the head is visible. Hidden layers no
  longer create gear-name conflicts. Fixed an equipped workspace-switch crash
  and added validation for malformed saved colors and palette values.
- Palette translation reuses decoded textures and indexed preview model mappings.
  Bake-cache metadata supplies fine-tuning baselines without recalibration.
- Characters using recovered assets include a minimal Resources tree and import
  instructions without altering the original extraction.

## Using the ZG export

1. Apply appearance and equipment edits in the viewer.
2. Choose **Export for ZG Tools** and select a destination.
3. In Blender, configure ZG's Resources folder and select the exported
   `assets/paths.json` using **Character Assembler**. Follow the generated import
   instructions if a supplemental Resources tree is included.

Verified compatibility target: [ZG SWTOR Tools 2.0.14](https://github.com/SWTOR-Slicers/ZG-SWTOR-Tools/releases/tag/2.0.14)
and its paired **GR2 importer 4.2.1**. These are external Blender import tools;
the viewer's bundled GR2 importer remains 4.0.7. Use matching game resources.
No changes to upstream add-ons are required.

## Compatibility limits

This exports a legacy character definition in its rest pose. Weapons, independent
bone attachments, attachment transforms, lightsaber effects, animation and the
selected pose are outside this handoff. Omitted attachments/effects are reported.
Use FBX when the selected pose is needed.

The importer can share one material across pieces in a slot. Incompatible visible
layers or different per-piece colors sharing that material cause an explanatory
error rather than silently losing edits. Partial hiding within a multi-mesh source,
unsupported shaders/tints, ambiguous mappings and conflicting dependencies can
also block export. Shader parameters match the tested importer; lighting and
texture details mean rendered pixels need not match the viewer exactly.

## Verification and update status

Source checks passed: 71 JavaScript tests and 24 Blender/Python regressions,
70 exact palette comparisons across both importers, and real Electron UI/export
checks. The unmodified ZG Character Assembler imported the reviewed head-visible
character with 12 models, materials, loaded textures and skeleton bindings.
Windows source CI passed, including 31 checks requiring no game resources.
These are source/integration results; 0.2.4 portable-package verification is pending.

Existing presets remain supported. Older preview caches regenerate for the new
palette metadata. Once the package is published, close the viewer and extract it
into a new folder; retain your settings and saved presets.

See the [user guide](../docs/USER-GUIDE.md), [compatibility guide](../docs/ZG-COMPATIBILITY.md)
and [changelog](../CHANGELOG.md). Free community software under GPL-3.0-or-later,
generated with AI using OpenAI Codex under Joystick1898's direction. Thanks to
ZeroGravitas, SWTOR Slicers and the upstream projects.
