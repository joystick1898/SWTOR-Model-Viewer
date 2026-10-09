# Using SWTOR Model Viewer

## First launch

Extract the full Windows ZIP and launch `SWTOR Model Viewer.exe`. Select your
extracted Resources folder (containing `art`, `anim`, and `gamedata`) and your
SWTOR installation (containing `Assets`). First setup scans files and builds
catalogs; this can take several minutes on a large extraction.

The viewer bundles Blender, Python and the GR2 importer. Users do not need to
install those tools separately. Game assets are supplied by the user.
[SWTOR Slicers' guides](https://github.com/SWTOR-Slicers/WikiPedia/wiki) cover the
community's extraction and asset workflows.

## Browse, customize and pose

- **Character Designer:** choose species, body and appearance options, change
  colors, and apply customization.
- **NPC Browser:** search character names, choose an available appearance and
  animation, or open a supported modular character in the designer.
- **Asset Browser:** find models by name or filename, choose materials and an
  associated animation, then scrub to a pose.
- **Equipment & attachments:** add clothing or independent equipment layers,
  choose attachment bones, and adjust placement in the viewport.
- **Lightsabers:** configure blades, guards, colors and effects in the equipment
  editor. Select a saber under **Adjust in viewport** for live position, length
  and thickness controls. Older native layouts offer **Prepare editable blades**.

Save a character preset to keep its appearance, equipment and pose. Presets refer
to resources in your own game data; they do not embed the underlying assets.

In Character Designer, appearance is on the left, equipment is on the right,
and animation playback and facial expressions are in the bottom dock. Drag the
panel dividers to resize the sidebars. The equipment panel extends to the bottom;
the animation dock occupies the space beneath the appearance panel and viewer.
Species-specific appearance choices follow the selected species, body and head.

Drag the animation dock's top edge upward for more rows. Drag the divider beside
the animation list to widen it and reveal more columns. Scroll within the list;
**Previous** and **Next** remain available below it to change pages. Panel sizes
are remembered. Double-click a divider to reset it, or focus it and use the arrow
keys to resize (Home resets it).

Use the small color dropdown beside Skin Color, Eye Color or Hair Color to set
a custom override without replacing the native palette choice. **Reset** restores
that channel's native color. Commit these edits with **Apply appearance**.

Click an empty equipment slot or **Add item** to open the catalog on the left;
the character remains visible. Select an equipped item to access **Replace item**,
**Add layer**, component visibility, sockets, transforms and lightsaber settings.
Items on unusual sockets stay in the independent **Attachments** list.

Click the red **X** beside a filled slot to clear every equipment layer in that
slot and return it to **Choose item**. This changes the draft immediately without
needing to select the item first. **Apply equipment** commits the removal;
**Revert changes** restores the applied equipment. Independent attachments and
other slots are preserved. Use **Remove layer** in item details to remove only
one layer from a slot containing several items.

Each item's color dropdown lists its included mesh pieces. Choose a piece to edit
its **Primary** and **Secondary** dye channels independently. **Reset** restores
that channel's original appearance. Older presets with whole-item colors remain
supported, but the editor now offers per-piece controls only.
Open **Fine-tune color** for native Hue, Saturation, Brightness and Contrast.
Arrows step by **0.1**; precise numbers can also be typed. Empty fields show the
applied preview value and retain automatic coloring. Apply wheel changes first
so the arrows can use the updated preview value. Saturation **0** is strongest
and **1** is gray. Choosing a new wheel color clears that channel's fine-tuning.
Component overrides remain available under **Colors / individual components**.
Use **Apply equipment** to commit or **Revert changes** to discard pending edits.
Apply appearance and equipment changes before saving a preset or exporting.

## Export and Unity

**Export FBX** exports the selected pose with textures and optional editable bones.
It does not export an entire animation. Keep the FBX, its `.meta` and `.fbx.json`
files, the `.textures` folder and the `.materials` folder together.

For Unity, copy the complete export into `Assets`, including all `.meta` files.
Saber exports include a shader in the materials folder; keep it with the bundle.
Follow `UNITY_IMPORT.txt` beside the export. Materials target Unity's Built-in
Render Pipeline; URP/HDRP and Tabletop Simulator compatibility are not fully
validated. Bloom is a setting in the destination Unity scene.

## Export for ZG Tools

In **Character Designer** or **NPC Browser**, use **Export for ZG Tools** and
choose a destination. A new character folder contains `assets/paths.json`,
`assets/skeleton.json`, `assets/preset.json`, and `ZG_IMPORT.txt`.

Apply pending appearance changes first: export uses the character currently
shown. The export preserves supported native models, clothing components,
materials, skin, eyes and palette colors. It always includes the skeleton
description. Pose, facial expression, weapons, bone-attached accessories and
lightsaber effects are excluded. The existing FBX export remains available for
posed models and those extras.

In a clean Blender scene, enable **ZG SWTOR Tools** and its matched **GR2
importer**, configure ZG's Resources folder, then use **Character Assembler** to
open `assets/paths.json`. Enable importing and binding the skeleton. Tested with
ZG **2.0.14**, GR2 **4.2.1**, and Blender **4.3.2**. ZG may reuse existing scene
materials, so use a clean scene when checking a newly exported appearance.

Usually the export contains JSON only and uses your existing extracted Resources.
If dependencies came from the viewer's recovery cache, the export also includes
a complete minimal **Resources** folder for that character. Point ZG to that
included folder, as explained in `ZG_IMPORT.txt`. Your original extraction is
not modified. A Resources bundle contains game assets, so it is for your local
workflow; the application itself does not ship those assets.

ZG shares materials among models in the same slot. If pieces in a slot have
different colors or material overrides that cannot be represented, export
explains the conflict and creates no partial character folder. Use matching
colors for those pieces. Non-palette tints, unsupported shaders, ambiguous hidden
parts, and conflicting filenames also produce an explanatory error. This is a
legacy character-definition export, not a pixel-identical copy of the viewer's
baked lighting. `preset.json` supplies known equipped gear names; use **Save
character** separately to retain all viewer edits.

## Updates and data

Close the viewer, extract a new release into its own folder, and run the new
executable. Settings and caches remain in `%APPDATA%/SWTOR Model Viewer`.
Use **Settings** to change source folders or rebuild catalogs.

The app reads the selected extraction and can recover missing dependencies from
the installed game into its own cache. It does not overwrite the extraction or
the installed game. A new extraction is needed to replace outdated source art.

## Storage and cache

Open **Settings → Storage and preview cache** to see preview-cache usage and
required catalog/resource usage separately. The default location is
`%APPDATA%/SWTOR Model Viewer` (normally `AppData/Roaming` on Windows).

- **Cache limit:** defaults to 2 GiB, shared by generated previews and baked
  materials. Least recently used previews are removed when the limit is exceeded.
  Set any limit from 0 to 1024 GiB in 0.25 GiB steps; 0 retains no previews between
  requests. Smaller limits trade disk space for additional conversion time.
- **Age:** previews unused for 14 days expire by default. This can be changed
  from 1 to 3650 days. Reopening a cached preview refreshes its last-use time.
- **Clear previews when closing:** discards the reusable cache on a normal exit;
  the next startup also clears leftovers after an interrupted session.
- **Clear preview cache now:** immediately clears the currently saved location.
- **Generated data folder:** can be placed on another drive. Apply with
  **Prepare data and open viewer**. Changing location rebuilds catalogs; the old
  snapshot is removed after the replacement has been prepared and opened.
  Changing the limit or age alone does not require rebuilding catalogs.

The limit covers retained previews and shared baked materials, not catalogs,
recovered source files, settings, or Electron's browser caches. Working conversions
can temporarily exceed it; oversized previews are discarded after their bytes
have been delivered to the viewer. Cleanup runs at startup, after preview/export
requests, and on exit. The viewer works from its loaded model in memory.

Export intermediates are removed after each request has finished, including failed
requests; completed exports in your chosen destination are independent of the
cache. Saved presets and exports are never targeted by cleanup. Obsolete and failed
setup snapshots are cleaned after a successful startup. If files cannot be removed
(for example, because another program holds them open), cleanup reports the problem
and retries on a later operation. Only one viewer process per user-data location
may run, and independently configured viewers cannot share a generated-data folder.

## Rendering limits

The app approximates game materials and some saber effects. Full cloth physics,
all game-specific behavior, and animation-sequence export are not implemented.
Unsupported or missing source records can remain unavailable. Report specific
model/animation combinations through the repository's issue tracker.
