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

## Export and Unity

**Export FBX** exports the selected pose with textures and optional editable bones.
It does not export an entire animation. Keep the FBX, its `.meta` and `.fbx.json`
files, the `.textures` folder and the `.materials` folder together.

For Unity, copy the complete export into `Assets`, including all `.meta` files.
Saber exports include a shader in the materials folder; keep it with the bundle.
Follow `UNITY_IMPORT.txt` beside the export. Materials target Unity's Built-in
Render Pipeline; URP/HDRP and Tabletop Simulator compatibility are not fully
validated. Bloom is a setting in the destination Unity scene.

## Updates and data

Close the viewer, extract a new release into its own folder, and run the new
executable. Settings and caches remain in `%APPDATA%/SWTOR Model Viewer`.
Use **Settings** to change source folders or rebuild catalogs.

The app reads the selected extraction and can recover missing dependencies from
the installed game into its own cache. It does not overwrite the extraction or
the installed game. A new extraction is needed to replace outdated source art.

## Limits

The app approximates game materials and some saber effects. Full cloth physics,
all game-specific behavior, and animation-sequence export are not implemented.
Unsupported or missing source records can remain unavailable. Report specific
model/animation combinations through the repository's issue tracker.
