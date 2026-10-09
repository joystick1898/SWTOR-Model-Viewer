"""Blender CLI adapter: -- request.json (input, output, resources).

Uses Blender's unchanged default DDS loading, just like the viewer. No meshes,
shaders, baking or add-ons are required. Output is an intermediate color report,
NOT a finished paths.json. A blocked result retains unsupported swatches.
"""
import json
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from resource_source import source
from zg_colors import translate_colors


def main():
    request = json.loads(Path(sys.argv[sys.argv.index('--') + 1]).read_text(encoding='utf-8'))
    original = Path(request['input']).resolve()
    destination = Path(request['output']).resolve()
    if original == destination:
        raise ValueError('Color translation output must not overwrite the source definition.')
    definition = json.loads(original.read_text(encoding='utf-8'))

    def load_pixels(relative):
        file = source(request['resources'], relative)
        if not file.is_file():
            raise FileNotFoundError('Missing palette map: ' + relative)
        image = bpy.data.images.load(str(file), check_existing=False)
        try:
            pixels = np.empty(len(image.pixels), dtype=np.float32)
            image.pixels.foreach_get(pixels)
            return pixels.reshape(image.size[1],image.size[0],4)
        finally:
            bpy.data.images.remove(image)

    result = translate_colors(definition, load_pixels)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(result, indent=2, allow_nan=False), encoding='utf-8')
    print(f"ZG colors: {len(result['converted'])} translated; {len(result['diagnostics'])} blocked")


if __name__ == '__main__':
    main()
