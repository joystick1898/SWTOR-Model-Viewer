# Contributing

Bug reports, documentation improvements and focused pull requests are welcome.
This is a small community project developed with AI assistance.

## Development

Use Windows x64 and Node.js 24 (the packaging tools require Node.js 22.12 or newer).
Run `npm ci`, copy `development.example.json` to `development.local.json`, and
configure your local Blender 4.3.2, Python 3.14.7, GR2 importer 4.0.7, game and
extracted-resource paths. Then run `npm start`.

Keep game files, extracted resources, generated exports, caches, and local
configuration out of commits and issue attachments. The sample configuration
contains example paths; it does not ship game data.

## Checks

The following checks use temporary test data and do not need SWTOR installed:

```powershell
node --test tests/cache-policy.test.mjs tests/conversion-cache.test.mjs tests/equipment-layout.test.mjs tests/live-saber.test.mjs tests/material-export.test.mjs tests/palette-controls.test.mjs tests/review.test.mjs tests/setup.test.mjs tests/zg-export.test.mjs
```

`npm test` runs the full suite and needs the configured game/resource fixtures.
Some older research scripts in `tools` also use development-specific paths or
historical reports. They are not needed to run the app or the release build.
For packaging and integration checks, see [release/README.md](release/README.md).

Please describe what a change fixes, how to reproduce the original behavior,
and what you tested. Add a regression test when the behavior warrants one.
Preserve existing presets, upstream notices and game-file boundaries.

Contributions to the viewer's original code use GPL-3.0-or-later. Include the
origin and license for any third-party code or assets you introduce.
