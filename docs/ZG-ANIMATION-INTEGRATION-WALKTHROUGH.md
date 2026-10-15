# A small-change integration of the native SWTOR animation fix

Design walkthrough, October 11, 2026. This is a hypothetical implementation plan,
not a patch. No installed add-on, upstream repository, or viewer runtime was changed.

The proposed result is simple: select the skeleton already in the Blender scene,
use the existing File > Import animation command, select a JBA, and receive an
action with the correct motion. Format selection would be automatic.

## What the current architecture actually is

The screenshot's animation entry belongs to the companion **GR2 importer**, not
to ZG Tools itself. Its menu registration calls the existing `ImportJBA` operator.
The live source now uses slightly different menu wording from the screenshot.
The source identifies the GR2 add-on as 4.2.1. [Menu source][menu]

The existing flow is `invoke → execute → load → read → build`. The last two
functions separate decoding from applying an action to the active armature.
That separation is the useful extension point. [Importer source][importer]

ZG Tools 2.0.14 provides a Resources path preference and a separate operation
that clears bone translations. I would reuse the preference optionally and
leave the cleanup tool available for manual use. [Preferences][zgprefs],
[cleanup operation][cleanup], [ZG version][zginit]

The design below is based on these exact GitHub snapshots, fetched directly:

| Repository | Branch inspected | Commit |
| --- | --- | --- |
| Granny2-Plug-In-Blender-2.8x | master | `fc07fe624f0e9899bc7d86d5664e50c29f3abfbd` |
| ZG-SWTOR-Tools | main | `6b6fe100d0f683104658a4751e82715022c84e8a` |

## 1. Preserve the existing entry point

Keep the operator ID `import_animation.jba`, the file selector, and the active
skeleton workflow. Add native support behind that command. Once accepted, update
the menu label and tooltip to describe both legacy and native animation support.
There is no need for another import menu or a replacement character assembler.

First add an early armature check. Capture the intended target when the import
starts and verify it still exists when the file picker returns. Keep a defensive
check immediately before building. This also avoids dereferencing a missing
active object in an error message.

Development acceptance: existing scripts calling the operator still work;
canceling the file picker or invoking without an armature creates no action.

## 2. Add a format switch in the reader

Keep `read(operator, filepath)` as the public entry point. Move its old decoding
body into a private legacy function and add a signature dispatcher. Proposed
pseudocode, not a ready-to-apply patch:

```python
def read(operator, filepath):
    header = peek_header(filepath)             # Proposed helper, with length checks.
    if identifies_legacy_jba(header):
        return read_legacy(operator, filepath)
    if identifies_jawb_v2(header):
        clip = read_native(filepath)
        return resolve_source_metadata(operator, filepath, clip)
    raise AnimationImportError("Unsupported animation format or version")
```

Keep decoding failures explicit. Never fall back to legacy decoding after a native
parse error. Both formats use `.jba`; the extension does not distinguish them.

The new native reader would be a Python port of the handoff's `native-jba.mjs`.
I would use Python's standard binary facilities or the existing DataView; upstream
already has 64-bit integer accessors. No new shared binary abstraction is needed.
[Binary utilities][binary]

The port must carry over wrapper-relative alignment, descriptor widths,
overlapping block samples, constant translation decoding, and six-byte quaternion
keys. It must report unparsed trailers rather than assume every file ends after
the world samples. These are format-specific rules, not global changes to the
legacy reader. See the [existing technical notes][technical].

Development acceptance: compare Python output against the extracted JS reader
sample-for-sample before involving Blender's scene. Compare quaternion orientation
with sign equivalence (`q` and `-q`), not just component equality.

## 3. Extend the current animation object, rather than replacing it

The existing `JointBoneAnimation` representation already holds tracks, samples,
timing and world motion. [Animation types][types]

Add optional instance fields with safe defaults, preserving old constructors:

| Proposed field | Purpose |
| --- | --- |
| `format_kind` | Explicit legacy/native distinction |
| `source_bind_by_track` | Ordered local source transforms; `None` for unresolved legacy data |
| `source_metadata` | Source profile, MPH file, rig/map IDs, correction diagnostics |
| `warnings` | Missing auxiliary tracks, unknown trailers, qualified mapping decisions |

Initialize lists/dictionaries per instance. Native animation must have a complete,
validated track-to-bind relationship before playback; `None` is not permission
to guess from the selected skeleton.

This lets both readers return the same kind of object and keeps most of the
existing action-building loop useful.

## 4. Resolve the animation's metadata near the input file

Add a Python MPH reader and a small source-selection module, porting the handoff's
`native-rig.mjs` and relevant `animation-library.mjs` policy.

Give the import operator an optional Resources directory field. Resolve an
explicit user selection first, then an available ZG Resources preference, then
a validated Resources ancestor of the chosen file. Read the ZG setting only if
that add-on is present, and do not rewrite its preference. Its current property
is `swtor_resources_folderpath`. [ZG preferences][zgprefs]

Start with the chosen clip's animation directory and `anim_library.mph`, then
other relevant MPH files in that directory when necessary. Load canonical body
directories only when source comparison requires them. Avoid a game-wide scan
every time the file selector opens. A per-import cache is enough for a first
implementation; a persistent cache can come later with file-change invalidation.

The resolver must distinguish three identities:

- The selected target skeleton: where the action will play.
- The clip's ordered native track map: which animated track belongs to which bone.
- The source bind: the reference pose against which those keys were authored.

Use MPH map pairs to fill the animation track order. Do not zip JBA tracks against
GR2 bone order, infer order from track count, or choose the source bind from the
target body type. Port the proven shared-motion comparison and stationary facial
reference correction. Keep stale-map fingerprint selection conservative and
visible in diagnostics; ambiguous cases should stop, not manufacture a map.

A loose copied JBA may lack its original directory context. If source metadata
cannot be established, report something actionable such as:

> This animation needs its matching MPH metadata. Select the extracted Resources
> folder or import the clip from its original animation directory.

Development acceptance: resolve the known 102/105-track, shared-body, stale-map,
and facial-reference fixtures. Test absent metadata and ambiguous matches too.

## 5. Prepare the import before changing the scene

After decoding and resolving metadata, build a small in-memory import plan:
target bone names, converted source-bind inverses, frame times, options and
warnings. Validate all mapped tracks and supported target transforms first.

Map by name, using `GOD → Bip01` only when appropriate for the imported target.
Reject duplicate target assignments. Missing essential deforming tracks should
stop the import; missing known auxiliary tracks can be reported. Define that
distinction explicitly rather than accepting any animation with one matching bone.

Do this before creating an action. For build-time failures, remove only the
newly created action and restore the previous action, pose and relevant context.
Keep Blender's Undo support, but do not assume returning `CANCELLED` rolls back
every mutation. Multi-file imports should preflight all selected files or clearly
report which earlier files were imported successfully.

## 6. Make the central change in the native branch of the pose builder

For ordinary native clips, compute a motion delta from the animation's source
bind and assign that delta as the target bone's basis. Both transforms must be
in the same converted local coordinate system.

```python
# Proposed native branch. Helpers and fields are defined by the steps above.
# This is design pseudocode, not code to paste into the installed add-on.
source_rest = convert_local(source_bind.translation, source_bind.rotation)
animated = convert_local(track.translations[sample], track.rotations[sample])

pose_bone.rotation_mode = 'QUATERNION'
pose_bone.matrix_basis = source_rest.inverted() @ animated
pose_bone.keyframe_insert('location', frame=frame_number)
pose_bone.keyframe_insert('rotation_quaternion', frame=frame_number)
```

Compute each source-bind inverse once per track, outside the frame loop. Keep
the legacy branch's existing behavior initially, with explicit mode selection
rather than detecting native behavior from a field accidentally being present.

Why it works: when a source sample equals the source rest, their matrix product
is identity. Blender consequently leaves the target at its own rest pose. A
real translated or rotated sample produces a nonidentity delta and still moves
the target. This avoids injecting a static source/target bind difference into
the pose. It requires compatible bone conventions; it is not a general retargeter.

**Important scope distinction:** retaining legacy compatibility does not fix all
legacy translation problems. A legacy clip could use this corrected branch only
after its actual source bind has also been established. Finding a modern clip
with the same filename is insufficient; compare motion and ordered names before
reusing modern metadata. Otherwise retain legacy behavior and describe that limit.

## 7. Give native motion appropriate import options

Avoid silently feeding native playback through inherited cleanup preferences.
I would expose an operator-level choice such as `Animation handling: Automatic /
Legacy settings / Native source bind`, defaulting to Automatic. Native-only mode
must still require valid metadata; it cannot manufacture a missing bind.

For native source-bind playback, retain facial translations and do not apply the
old delete-180 behavior automatically. Clearly disable the legacy-only cleanup
controls for that mode, or provide explicitly named post-processing options.
Leave saved legacy preferences intact. The user should see the chosen handling
in the import options or result, even when format detection is automatic.

ZG's translation-clearing operation stays available as a manual editing tool.
It must not be called as part of a supposedly corrected import. [Cleanup source][cleanup]

## 8. Handle units, timing and root motion deliberately

**Units and axes:** the GR2 importer records scale and axis-conversion properties
on imported objects. [GR2 import source][gr2import] Use those as evidence when
selecting the conversion for both bind and animated locals. Test object scale
versus applied data scale separately; blindly scaling twice would introduce a
new distortion. The existing handoff helper covers the viewer's neutral import
settings only. For an initial development version, reject unvalidated transformed
rigs with a clear explanation; add supported combinations once verified.

**Timing:** preserve scene FPS by mapping native samples to scene time:

```text
effective_scene_fps = scene.render.fps / scene.render.fps_base
frame_number = start_frame + sample_index * effective_scene_fps / clip_fps
```

Validate positive finite FPS. Use sample-consistent interpolation and ensure
the last sample arrives at the correct time. Keep any legacy timing change as a
separately reviewed behavior fix.

**Root motion:** decode and retain world samples, but leave world motion disabled
in the first native import path. State that this omits the separate world track;
local root-bone keys can still move the character. A later opt-in can apply world
motion relative to its initial sample. Automatically reparenting an established
scene rig would enlarge this change substantially, so defer that integration.

**Blender actions:** use supported keyframe APIs and test the actual supported
Blender releases. Do not copy the handoff's Blender-4.3-specific `action.fcurves`
iteration into every version without checking slotted actions/channelbags.

## 9. Keep the proposed change set easy to review

| Existing file | Proposed change |
| --- | --- |
| `io_scene_gr2/ops/import_jba.py` | Dispatch, import options, preflight, native pose branch and diagnostics |
| `io_scene_gr2/types/jba.py` | Optional source-bind and provenance fields |
| `io_scene_gr2/__init__.py` | Menu wording after native support passes acceptance |

| Proposed new file | Responsibility |
| --- | --- |
| `io_scene_gr2/utils/jba_native.py` | Native key decoding |
| `io_scene_gr2/utils/mph_metadata.py` | Native rig and clip-map decoding |
| `io_scene_gr2/utils/animation_source.py` | Metadata discovery and source-bind selection |
| Focused test files | Reader parity, mapping, transform and Blender import regressions |

No ZG source change is required for this version of the design: its preference
is read optionally. A later convenience panel could be independent. There is no
Node.js subprocess, Model Viewer installation dependency, archive extractor,
character-assembler rewrite, material change, or skeleton rewrite in this plan.

## 10. Prove the integration, then change the menu claim

I would deliver the work in three reviewable increments:

1. **Reader and metadata:** Python ports and JS-oracle comparisons, without scene
   mutation. Test malformed files and the original exact legacy/native pair.
2. **Native action building:** source-bind branch, import options, failure cleanup
   and Blender scene tests. Test neutral bind, retained translations, facial and
   shared-body cases, frame times and missing essential bones.
3. **Workflow acceptance:** import through the actual File menu, test legacy
   regression, Undo, multi-file import, supported Blender versions and validated
   transform settings. Update menu/tooltip and document remaining exclusions.

The existing four native handoff cases are regression seeds, not a complete
upstream test matrix. Add other body types, multi-block clips, a moving clip,
front/side facial review and in-game comparison where possible. Reject general
additive `ad_` clips until their layering semantics have separate coverage.

The existing viewer fix supplies the algorithm and evidence. The principal new
development work would be the Python metadata port and the compatibility work
around Blender's import settings. The central matrix change is small; proving
that it is given the correct source bind is the larger part of the integration.

[menu]: https://github.com/SWTOR-Slicers/Granny2-Plug-In-Blender-2.8x/blob/fc07fe624f0e9899bc7d86d5664e50c29f3abfbd/io_scene_gr2/__init__.py
[importer]: https://github.com/SWTOR-Slicers/Granny2-Plug-In-Blender-2.8x/blob/fc07fe624f0e9899bc7d86d5664e50c29f3abfbd/io_scene_gr2/ops/import_jba.py
[types]: https://github.com/SWTOR-Slicers/Granny2-Plug-In-Blender-2.8x/blob/fc07fe624f0e9899bc7d86d5664e50c29f3abfbd/io_scene_gr2/types/jba.py
[binary]: https://github.com/SWTOR-Slicers/Granny2-Plug-In-Blender-2.8x/blob/fc07fe624f0e9899bc7d86d5664e50c29f3abfbd/io_scene_gr2/utils/binary.py
[gr2import]: https://github.com/SWTOR-Slicers/Granny2-Plug-In-Blender-2.8x/blob/fc07fe624f0e9899bc7d86d5664e50c29f3abfbd/io_scene_gr2/ops/import_gr2.py
[zgprefs]: https://github.com/SWTOR-Slicers/ZG-SWTOR-Tools/blob/6b6fe100d0f683104658a4751e82715022c84e8a/zg_swtor_tools/addon_preferences.py
[cleanup]: https://github.com/SWTOR-Slicers/ZG-SWTOR-Tools/blob/6b6fe100d0f683104658a4751e82715022c84e8a/zg_swtor_tools/anim_clear_bone_translations.py
[zginit]: https://github.com/SWTOR-Slicers/ZG-SWTOR-Tools/blob/6b6fe100d0f683104658a4751e82715022c84e8a/zg_swtor_tools/__init__.py
[technical]: ../contributions/zg-animation-fix/TECHNICAL-NOTES.md
