# TORCommunity-compatible ZG character export

Historical research and implementation plan, October 8, 2026. The exporter is now implemented; see the [user guide](USER-GUIDE.md#export-for-zg-tools) and [native color controls](NATIVE-COLOR-CONTROLS.md) for current behavior.

## Objective and compatibility target

Make SWTOR Model Viewer a replacement authoring front end for the TORCommunity Character Designer -> ZG Tools Character Assembler workflow. Export the established character description, with original game asset references and native material parameters. Compatibility means correct reconstruction with unmodified ZG Tools, not merely JSON that parses.

Target verified on GitHub: ZG SWTOR Tools **2.0.14**, published September 16, 2026, at commit `6b6fe100d0f683104658a4751e82715022c84e8a`. The matched release GR2 importer reports **4.2.1**. The release importer ZIP is identical to the ZIP at that commit (SHA-256 `06e2188affe114dd78f58ab11ba47b948ce5caf9d3c7a402aecf0c834e85b488`). The release Character Assembler source matches the repository source after line-ending normalization.

This pair differs from the viewer's documented bundled importer 4.0.7. Test the external target in an isolated Blender configuration; installing it over the viewer's runtime is unnecessary.

The original scope targeted the legacy JSON handoff; .blend export and save-system redesign were outside that scope.

Sources inspected:

- [ZG 2.0.14 release and matched add-on downloads](https://github.com/SWTOR-Slicers/ZG-SWTOR-Tools/releases/tag/2.0.14).
- [Pinned Character Assembler source](https://github.com/SWTOR-Slicers/ZG-SWTOR-Tools/blob/6b6fe100d0f683104658a4751e82715022c84e8a/zg_swtor_tools/char_character_assembler.py): correction at lines 59-96; gather/import at 834-1150; skeleton at 1013-1064; gear names at 1300-1320.
- [Pinned paired importer ZIP](https://github.com/SWTOR-Slicers/ZG-SWTOR-Tools/blob/6b6fe100d0f683104658a4751e82715022c84e8a/io_scene_gr2.zip): `io_scene_gr2/ops/import_cha.py`, especially `read()` and `build()`.
- [JC SWTOR Tools](https://github.com/jecandone/JC-SWTOR-Tools): README corroborates the paths/skeleton/preset handoff; its implementation was not used as the contract authority.
- Local original: an Atton Rand `assets/paths.json` fixture, plus sibling `skeleton.json`, `preset.json`, and `paths_corrected.json`.

## Observed contract

Recommended initial output:

```text
CharacterName/
  assets/
    paths.json
    skeleton.json
    preset.json       (gear naming information where known)
```

The user selects `assets/paths.json` in ZG and configures their extracted Resources directory. ZG gathers models/materials/textures into neighboring folders, corrects material texture paths, and invokes the GR2 character importer. Empty model/material folders are not required beforehand. Do not export `paths_corrected.json`: that is ZG's generated output. Do not rename `paths.json`; its name is used in ZG's corrected-output calculation.

`paths.json` is a top-level array, without a viewer-specific wrapper. Ordinary records contain `slotName`, a `models` array, and `materialInfo` with `matPath`, `ddsPaths`, and `otherValues`. Models belonging to the same slot share a material description. The Atton reference has ten records: head, facehair, hair, chest, bracer, waist, hand, leg, boot, skinMats; fourteen model references; an empty facehair model array; and four skin material records. These are fixture facts, not mandatory counts for every character.

Use slash-separated game-root references such as `/art/dynamic/...gr2`, `/art/shaders/materials/...mat`, and `/art/...dds`. Never export drive letters or viewer cache paths. Retaining the leading slash is especially important for `skeleton.json`: ZG unconditionally removes its first character when resolving the path. Atton's exact skeleton shape is:

```json
{"path":"/art/dynamic/spec/bmnnew_skeleton.gr2"}
```

Preserve the legacy skin nesting, which differs from ordinary slots and from our native builder:

```text
skinMats.materialInfo.mats[]
  slotName
  materialInfo: { matPath }
  ddsPaths
  otherValues
```

Eyes belong in `head.materialInfo.eyeMatInfo`, with their own `ddsPaths` and `otherValues`. Preserve native palette arrays (four numbers), specular arrays (three numbers), shader family, flesh brightness, flush, and clothing `materialSkinIndex`. The fixture uses string `"-1"` for the latter; the importer calls `int()`, accepting strings or integers. For legacy output, keep that string convention. Validate required values per shader rather than inventing universal defaults.

ZG replaces five common texture references using the referenced .mat files; it preserves customization maps such as complexion. The importer also reads DirectionMap from gathered .mat files for HairC/Creature. Thus valid .mat references and a consistent recipient resource snapshot are essential; having only the DDS files used by our preview is insufficient.

`preset.json` is optional for geometry import. ZG reads non-null entries whose keys contain `Gear`, then accesses their `name` and `slot` for collection naming. A minimal compatible preset is not a complete TORCommunity designer save. Do not manufacture its historical customization numbers, website IDs, tooltip HTML, or item links. Include known name/slot data and verified `ippPath` when available; retain richer viewer state under a different filename only if later requested.

Legacy-format fidelity is the goal, not byte-identical obsolete paths or copied TORCommunity bugs. Atton includes `/.dds` placeholders and empty unused value arrays. Keep the original fixture unchanged; decide placeholder behavior by shader and consumer behavior, not by blanket replacement. The importer uses a malformed palette path as a special creature-material signal, making blanket cleanup unsafe.

## Viewer integration and gaps

| Area | Existing implementation | Required work |
|---|---|---|
| Character state | `src/designer.mjs`, `tools/assemble_designer.py`, `tools/build_local_npcs.py` resolve native choices | Reuse resolution; serialize separately from preview conversion |
| Skin records | Native builder puts `matPath` directly on each skin record | Adapt to the legacy nested `materialInfo.matPath` shape |
| Clothing | `src/equipment.mjs` resolves assets; `worker/convert.py` applies replacement | Compute final slots with the same replacement/component rules before serializing |
| Piece dyes | Designer splits one slot into one record per model | Merge only material-equivalent records; reject incompatible same-slot material groups in strict export |
| Custom swatches | `palette1Color`/`palette2Color` are applied inside `worker/materials.py` | Resolve them to native numeric palettes using `worker/palette.py` calibration and matching DDS decoding/color space |
| Extra material slots | Viewer understands `materialOverrides` | Map representable eye/skin cases; detect arbitrary overrides that the target ignores |
| Visibility | Hidden parts use Blender object names | Preserve whole-source-model omissions only when mapping is unambiguous; submesh hiding needs separate treatment |
| Resource recovery | Viewer can use its private `npc-resources` overlay | Check .mat and texture dependencies too; explain when recipient extraction must be updated |
| Export plumbing | `src/main.cjs`, `src/preload.cjs`, renderer and FBX bundle | Add a dedicated export action and writer, outside FBX conversion |

Two particularly important limits:

1. The target importer caches materials by material index, slot name and shader family. Repeated `chest` entries with different dyes can reuse the first material. Inventing `chest_1` slots would depart from the old contract and affect skin lookup/organization. Independent per-piece dyes must not silently flatten or be advertised as fully preserved.
2. Viewer RGB swatches are not native SWTOR palette controls. Native palette values can be exported directly; custom swatches require calibration. Swatches applied to materials with no palette map currently use a viewer-specific shader change, which has no established representation in the inspected JSON importer.

The strict initial scope should cover modular player characters, supported humanoid NPC appearances, native clothing replacements and same-material attachments, native palettes, eyes, exposed skin, and the correct skeleton. Test every supported case before advertising it. Pose, expression, arbitrary bone-attached weapons, saber effects and attachment transforms are outside this legacy handoff. Arbitrary material overrides, conflicting layered armor and partial-mesh hiding are compatibility blockers unless a verified representation is found. Creature support needs its own fixtures and importer-specific handling.

A syntactically valid file is not enough. If an appearance feature cannot be represented, identify the specific affected piece before export. Offer an explicitly described reduced export only as a user choice; never silently omit it or label that result an exact appearance match.

## Upstream issues to investigate during implementation

Static inspection found two issues present in both the release and pinned source:

- Skin .mat gathering reads `materialInfo["matPath"]` rather than `mat_materialInfo["matPath"]` at line 931. With skinMats last, this appears to copy a previous ordinary slot's .mat under the skin filename; other ordering may fail. Keep normal legacy ordering, test the unmodified baseline first, and distinguish upstream behavior from exporter defects. Do not distort the schema to conceal this or patch installed add-ons as part of exporting.
- Character naming compares the full `self.filepath` to literal `"paths.json"` at line 820, so an absolute path likely takes the filename-based naming branch. Treat top-level collection naming separately from geometry/material acceptance.

These are source-level findings, not reproduced Blender failures. Check the matched pair in a clean scene, capture logs, and determine practical impact before deciding whether an upstream fix is necessary. No upstream message or issue has been sent.

## Proposed execution sequence

1. **Lock the contract and baseline.** Keep the Atton originals read-only. Record source versions/hashes. Use synthetic small fixtures in committed tests and the private Atton fixture only for local integration. Import the original through unmodified ZG 2.0.14 + GR2 4.2.1 in an isolated supported Blender LTS environment to establish what already works and expose upstream issues.
2. **Build a dedicated serializer and validator.** Proposed `src/zg-export.mjs`: accept resolved appearance/profile, adapt skin and eye layout, normalize game paths and numeric arrays, preserve supported slot names/order, and emit diagnostics. Use a whitelist so viewer-only properties do not leak into the legacy contract. Preserve stable ordering and meaningful numeric precision.
3. **Resolve the effective appearance.** Share the clothing replacement/component-selection rules with the preview path; reconcile hidden pieces and material equivalence. Resolve supported custom colors using the same calibration as preview, with regression coverage. Keep this export independent of animation decoding, posing and texture baking; extracting shared resolution from `prepareNpc` may be necessary because it currently loads animations. A lightweight DDS helper or isolated Blender material-resolution step is acceptable if needed for identical swatch calibration.
4. **Write the package and integrate the UI.** Add “Export for ZG Tools” for supported Character Designer/NPC cases, choosing a character folder. Stage and validate the files before publishing the folder. Write skeleton from the actual resolved profile; write truthful gear metadata only. Surface limitations/missing references before completion. Keep ordinary viewer presets distinct from legacy `preset.json`.
5. **Prove reconstruction.** Run the acceptance matrix below through the target assembler/importer. Add user guidance showing which file to select, resource requirements, exact supported appearance features and tested versions. Release only after both structural and visual checks pass.

## Acceptance criteria

- Synthetic tests: correct top-level array; exact skin nesting; eyes; palette lengths/types; finite values; explicit skin indices; all eight body skeleton paths; empty slots; same-slot merging; conflicting dyes/overrides rejected; replacement rules; safe paths; no host/cache paths; duplicate basenames detected because ZG flattens files into slot folders.
- Atton parity: compare normalized original structure and meaningful values, including all fourteen models, hair attachments, eyes, exposed-skin records and rig. Compare under the same resource snapshot because current .mat correction can legitimately differ from a historical corrected JSON.
- Real import: start with a fresh character folder containing only our JSON files and a clean Blender scene. ZG must gather assets and assemble successfully without hand-editing JSON. Check expected mesh set, eye/skin material assignments, shader inputs and skeleton binding; an operator returning FINISHED is insufficient because the importer catches some parse errors.
- Visual matrix: Atton, all eight body profiles, representative supported species, bald/no-facehair, helmet, exposed skin, multiple clothing attachments, primary/secondary dyes, known NPC customization maps, cleared/replaced slots. Compare meaningful appearance, not pixel-identical lighting between the viewer's baked materials and ZG's native shaders.
- Negative matrix: per-piece dye conflicts, custom non-palette tint, arbitrary material overrides, layered clothing conflicts, missing .mat/.dds/.gr2, duplicate basenames, hidden submeshes and viewer-specific equipment. Each must give a truthful diagnostic rather than quietly changing the character.
- Portability: exported JSON contains game-relative references only. Validate against a Resources folder without access to the viewer's private recovery cache. If a fresh extraction is required, report that explicitly. Asset packaging is a separate optional feature, not assumed by JSON-only export.

## Completion of this research pass

Read the supplied files, inspected local resolution/material/export code, checked the latest release and pinned source, downloaded the matched release archives to a temporary research folder, verified importer ZIP parity and Character Assembler source parity, and wrote this plan. No application code was changed, no add-ons were installed, and no end-to-end ZG import was run. Full compatibility remains an acceptance target to prove during implementation.
