# SWTOR Model Viewer 0.2.1

A free, open-source Windows workbench for SWTOR models, character customization,
posing, equipment and textured FBX export.

## Download and start

Download **SWTOR-Model-Viewer-0.2.1-Windows-x64.zip**, extract the entire folder,
and run **SWTOR Model Viewer.exe**. Supply your own SWTOR installation and
extracted Resources folder. Blender, Python and the importer are included.
The portable executable is unsigned; no installer is required.

The **Sources.zip** contains the viewer and matching Blender/library sources.
It is not needed to run the application. SHA-256 files accompany both downloads.

## Included in this version

- Live lightsaber blade position, length and thickness controls.
- Facial reference-pose correction for affected small-female stealth animations.
- Conversion-cache recovery and serialization fixes.
- Distinct Unity material files when sanitized names would otherwise collide.
- AI disclosure during setup, upstream credits and complete release notices.

The application was generated with AI using OpenAI Codex under Joystick1898's
direction. Special thanks to ZeroGravitas and the SWTOR Slicers community.
The viewer's original code uses GPL-3.0-or-later; upstream licenses are preserved.

## Validation and limits

52 tests passed. Fresh packaged setup, character loading and catalog searches
passed. Character/pike, Aric Jorgan and AT-ST FBX exports passed re-import checks.
Game-file recovery and both ZIP checksums/integrity checks passed.

Exports contain a selected pose, not a full animation sequence. Cloth physics
and full game rendering fidelity are not implemented. Unity Built-in materials
have local validation; URP/HDRP and Tabletop Simulator are not fully validated.
No game models, textures, animations, or extracted catalogs are included.
