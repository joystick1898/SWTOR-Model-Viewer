# SWTOR Model Viewer 0.2.5 — Equipment loading fixes

Released October 15, 2026. Download **SWTOR-Model-Viewer-0.2.5-Windows-x64.zip**,
extract the entire folder, and run **SWTOR Model Viewer.exe**. Blender, Python
and the GR2 importer are bundled. Supply your own installed game and extracted
Resources folder. The executable is unsigned and portable.

The matching **SWTOR-Model-Viewer-0.2.5-Sources.zip** and SHA-256 files accompany
the Windows download. The Sources ZIP is for source access and rebuilding; it
is not needed to run the viewer.

## What's changed

- Fixed Reforged Havoc Squad previews failing on a missing helmet attachment.
  Equipment models are checked and archive recovery is attempted before Blender
  starts. Missing optional attachments produce an explicit incomplete-appearance
  warning instead of aborting an otherwise usable conversion.
- The equipment picker checks the current body type. **Unavailable for this body**
  disables items missing required models; **Missing attachments** identifies
  partial appearances. Warnings remain visible after applying equipment.
- Corrected verified face-model references filed under the head directory,
  including Vengeance's Vendetta. Component selections and colors are preserved.
- Avoid repeated archive lookups for files already confirmed missing during
  the current session, while continuing to recognize restored local files.
- Native animation-network decoding now supports legacy 32-bit networks as
  well as MAWB networks, preserving explicit track order and bind transforms.
- ZG export gives a clearer error when its GR2 importer is missing. Updated
  compatibility guidance distinguishes the tested Blender 4.3.2 workflow from
  the known collection-link failure with ZG 2.0.14 on Blender 5.2.2.

## Verification and limits

All 203 affected catalog appearances were checked across eight body types:
**1,624 combinations**, with 630 available, 742 explicitly partial, and 252
unavailable because required files were absent. Blender imported all **1,510**
distinct surviving mesh/body combinations with no import, finite-coordinate,
or matching-bone failures. Five textured previews and one FBX export passed;
targeted equipment UI tests and a packaged full Reforged Havoc preview passed.

These are local checks against the available installation, not a guarantee of
exact in-game appearance for every item. Missing artwork is not recreated or
replaced with another armor/body model. Some items remain incomplete or
unavailable until the actual matching game files are provided.

The broader workspace UI fixture stopped at a skin-color assertion before its
equipment checks; the dedicated equipment UI test passed independently.

## Updating

Close the viewer and extract 0.2.5 into its own folder. Existing settings and
presets remain usable; no manual catalog rebuild is required for these equipment
checks. Settings and generated caches normally live in
`%APPDATA%/SWTOR Model Viewer`. The viewer does not modify your game installation
or extracted Resources.

See the [user guide](https://github.com/joystick1898/SWTOR-Model-Viewer/blob/main/docs/USER-GUIDE.md)
and [ZG compatibility guide](https://github.com/joystick1898/SWTOR-Model-Viewer/blob/main/docs/ZG-COMPATIBILITY.md).
