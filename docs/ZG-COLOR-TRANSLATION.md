# ZG color translation: first implementation

This records the initial export-adapter implementation. The full exporter is now
connected; current mask-aware calibration, native fine-tuning, and visibility
behavior are documented in [Native color controls](NATIVE-COLOR-CONTROLS.md) and
the [user guide](USER-GUIDE.md#export-for-zg-tools).

Implemented October 8, 2026 as an export-only adapter. The existing viewer renderer, palette calibration, FBX exporter and saved preset format were not changed by this work.

## What is implemented

`worker/zg_colors.py` exposes `translate_colors(definition, load_pixels)`. It accepts resolved material metadata, copies it, and replaces supported `palette1Color` / `palette2Color` swatches with native four-component palette arrays. It reuses the viewer's existing `worker/palette.py` calibration. This is texture-dependent conversion, not ordinary RGB-to-HSL conversion.

Primary colors are supported for SkinB, Eye, HairC and Garment; Garment also supports secondary colors. GarmentScrolling uses the same palette channel contract. Native values without swatches are preserved without reading textures. Specular, metallic specular, flush, masks and other metadata remain intact. Eye, skin and material-override records are traversed recursively. Successful conversions remove only the converted swatch keys.

Unsupported channels, missing palette maps, invalid colors/palettes and unreadable texture data produce location-specific diagnostics. Unsupported swatches remain in the copied definition; `ready` is false. There is no invented fallback color or silent loss. `ready` means **color translation is representable**, not that the entire character is ZG-compatible.

Input must already contain effective colors in each material's `otherValues`. Applying designer/equipment color selections, resolving replacement layers, and detecting conflicting colors in the same legacy slot belong to the next export integration step. This adapter does not interpret raw UI selection records.

`worker/translate_zg_colors.py` provides a Blender background entry point. Blender only decodes DDS pixels, using the same default image loading as the preview; no mesh conversion, add-on installation or texture baking is involved. Its request JSON contains `input`, `output`, and `resources`. The output is an intermediate report with `definition`, `ready`, `converted`, and `diagnostics`, not a finished paths.json. It refuses to overwrite the input definition.

Example from Atton's armor: `#8040C0` becomes primary palette
`[0.6408403515815735, 0.09671547263860703, 0.049465667456388474, 1.0812000036239624]`.
The same color has a different secondary brightness because its native contrast differs. These values match Blender's float32 shader properties.

## Verification performed

- Seven unit tests passed: untouched native metadata, both channels, nested materials, black/white/gray, unsupported edits, bad/missing pixels, and independent cached results.
- Twenty-five comparisons on actual Atton DDS textures passed with the viewer's GR2 4.0.7 shader: skin, eyes, hair, armor primary/secondary, each with purple, green, black, white and gray. The test executes the real preview color-setup code and captures its shader values before baking. All translated arrays matched exactly.
- The same twenty-five checks passed with the isolated GR2 4.2.1 package paired with ZG 2.0.14. A Blender editor context was supplied for its UI-dependent alpha callback; the add-on was not modified or installed over the viewer's copy.
- The standalone entry point successfully translated both armor channels from a request file.
- Three existing material-export regression tests passed.

Results: `reports/zg-color-parity.json` and `reports/zg-color-parity-target.json`. Verification runner: `tools/verify-zg-colors.py`; run inside Blender with `--background --factory-startup --python-exit-code 1 --python`, optionally supplying `-- --addons PATH --output PATH`. Unit tests use the same Blender invocation with `tests/test_zg_colors.py`, because Blender supplies NumPy.

## What remains

No export button or full paths.json writer is connected yet. The next step is to feed this adapter the final selected appearance, serialize the legacy structure, and test through the actual ZG character importer. Different resource snapshots can cause ZG to substitute a different palette texture from .mat files; parity assumes matching textures. Independent colors within a shared slot still need conflict detection. Full ZG reconstruction, visual equivalence, specular appearance and unsupported viewer-only tints are not established by these numeric checks.
