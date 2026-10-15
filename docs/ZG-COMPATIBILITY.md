# ZG Tools Character Assembler compatibility

Included in **SWTOR Model Viewer 0.2.4**. Older 0.2.3 packages do not include
this feature. See [release notes](../release/RELEASE-NOTES-0.2.4.md).

## Verified target

Exports were imported with unmodified [ZG SWTOR Tools 2.0.14](https://github.com/SWTOR-Slicers/ZG-SWTOR-Tools/releases/tag/2.0.14)
and its paired **GR2 importer 4.2.1** on **Blender 4.3.2**. On **Blender 5.2.2 LTS**,
the same add-ons load the tested character data but hit a collection-organization
error before the assembly operator finishes; see the compatibility notes below.
Compatibility with other versions is not established by these checks.
The viewer continues to use its existing importer;
install the ZG release and its paired importer in the Blender environment used
for assembly. No viewer runtime replacement or add-on source modification is needed.

### Blender 5.2.2 collection error

ZG 2.0.14 can report `Collection 'GEAR' already in collection 'Collection'`
(or another collection name). Its collection helpers use `scene.user_of_id()`
to decide whether a collection needs linking. A minimal fresh-scene test returns
1 on Blender 4.3.2 and 0 on 5.2.2 for the same already-linked collection, causing
ZG to attempt the duplicate link.

Model import and skeleton binding happen before this step. Compatibility tests
inspect the surviving scene separately from the operator's completion status:
an intact model does not make the failed operator a successful assembly.
A fresh scene and disabling **Collect By In-game Names** do not eliminate this
issue. Grouping can remain unfinished, especially with multiple gear groups.
The diagnostic tests leave installed add-ons unchanged.

The viewer's bundled **Blender 4.3.2 / GR2 4.0.7** runtime is independent of the
Blender installation used to assemble exported characters. `paths.json` carries
asset references and material parameters, not a Blender-version-specific scene.
This collection issue does not require updating the viewer's runtime.

The October 11 local audit covered 15 cases: eight human body types, three
female alien characters, two dyed jacket cases, and two NPCs. All completed on
Blender 4.3.2; on 5.2.2 the same scene-data checks passed after the collection
error, but none completed the assembly operator successfully.

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
