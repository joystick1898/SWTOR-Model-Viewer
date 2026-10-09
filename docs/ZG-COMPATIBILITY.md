# ZG Tools Character Assembler compatibility

Included in **SWTOR Model Viewer 0.2.4**. Older 0.2.3 packages do not include
this feature. See [release notes](../release/RELEASE-NOTES-0.2.4.md).

## Verified target

Exports were imported with unmodified [ZG SWTOR Tools 2.0.14](https://github.com/SWTOR-Slicers/ZG-SWTOR-Tools/releases/tag/2.0.14)
and its paired **GR2 importer 4.2.1**. Compatibility with other versions is not
established by these checks. The viewer continues to use its existing importer;
install the ZG release and its paired importer in the Blender environment used
for assembly. No viewer runtime replacement or add-on source modification is needed.

## Export and assemble

Apply appearance and equipment changes, then choose **Export for ZG Tools** from
Character Designer or NPC Browser. Select the generated `assets/paths.json` in
Blender's **Character Assembler** with ZG's Resources folder configured to matching
extracted game data. Asset Browser does not offer this character export.

The character package uses the legacy TORCommunity filenames and structure:

| File | Purpose |
| --- | --- |
| `assets/paths.json` | Original model/texture references and native material parameters |
| `assets/skeleton.json` | Character skeleton reference |
| `assets/preset.json` | Known equipped gear names for collection organization |

`preset.json` is legacy metadata. Save a viewer character preset separately to
retain the full editable character state. Recovered dependencies may add a minimal
Resources tree and generated instructions; follow those instructions to make the
supplemental files available to ZG. Ordinary exports refer to your own resources.

## Appearance and visibility

Supported modular character data includes clothing replacements, selected pieces,
native palettes, skin and eyes. Visibility uses the applied preview's original
model and equipment-layer mapping. A helmet can remain equipped with both pieces
hidden while the head is visible. Hidden layers do not contribute gear names.

The wheel remains available alongside native Hue, Saturation, Brightness and
Contrast. Fine-tuning arrows step by 0.1; typed precision is preserved. Apply wheel
edits before fine-tuning so automatic fields reflect the current preview. Native
saturation is inverse: 0 is strongest and 1 is grayscale. New wheel choices clear
that channel's native overrides. See [native color controls](NATIVE-COLOR-CONTROLS.md).

## Limits and diagnostics

- Legacy assembly reconstructs the character in its rest pose. Weapons, independent
  bone attachments, transforms, saber effects and animations are outside this
  format; omitted attachments/effects are reported. Posed FBX remains available.
- ZG's importer shares some materials within a slot. Conflicting visible layers
  or distinct piece colors that cannot share that material block export.
- Partial hiding of a multi-mesh source, unsupported palette channels or shaders,
  unmapped parts, missing assets and conflicting filenames can produce errors.
  A failed export does not publish a partial character folder.
- Matching palette values do not guarantee identical pixels: lighting, masks,
  texture details and the Blender scene affect the final appearance. This does
  not establish compatibility for every NPC, creature or arbitrary attachment.

The reviewed fixture imported 12 models with expected materials, textures,
palettes, vertex groups and skeleton bindings. Both importer configurations passed
35 exact palette comparisons each; helmet/head, custom-color and native-control
exports and the real viewer UI were checked. The 0.2.4 portable package also passed first setup, updated startup, color-control
checks and export validation. Its fine-tuned head-visible export was imported
with the unmodified ZG add-ons and bundled Blender runtime.
