import copy
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'worker'))
from zg_colors import translate_colors
from palette import palette_offsets


def material(family='Garment', **values):
    return {'matPath': '/art/test.mat', 'ddsPaths': {'paletteMap': '/art/test.dds'},
            'otherValues': {'derived': family, 'palette1': [0, .5, 0, 1.2],
                            'palette2': [.2, .4, -.1, 1],
                            'palette1Specular': [.3, .4, .5], **values}}


class ZGColors(unittest.TestCase):
    def test_controls_only_bad_native_vectors_report_diagnostics(self):
        for vector in ([],[0],[0,.5,0],[0,.5,0,1,2],[0,.5,0,float('inf')],[0,.5,0,True],'bad'):
            result=translate_colors(material(palette1=vector,palette1Controls={'brightness':.1}),self.pixels)
            self.assertFalse(result['ready'])
            self.assertEqual(result['diagnostics'][0]['code'],'invalid-native-controls')

    def test_two_dye_channels_decode_palette_and_mask_only_once(self):
        info=material(palette1Color='#FF0000',palette2Color='#00FF00')
        info['ddsPaths']['paletteMaskMap']='/art/mask.dds'
        calls=[]
        def load(texture):
            calls.append(texture)
            return np.array([[1,0,0,1],[0,1,0,1]],dtype=np.float32) if 'mask' in texture else self.pixels(texture)
        result=translate_colors([info,copy.deepcopy(info)],load)
        self.assertTrue(result['ready'])
        self.assertEqual(calls,['/art/test.dds','/art/mask.dds'])

    def test_wheel_calibrates_each_garment_region_without_background_bias(self):
        pixels=np.array([[0,.1,.6,.5],[0,.2,.6,.5],[0,.9,.6,.5],[0,.9,.6,.5],[0,.9,.6,.5]],dtype=np.float32)
        mask=np.array([[1,0,0,1],[0,1,0,1],[0,0,0,1],[0,0,0,1],[0,0,0,1]],dtype=np.float32)
        primary=palette_offsets('#FF0000',pixels,1,mask,1)
        secondary=palette_offsets('#FF0000',pixels,1,mask,2)
        self.assertEqual(primary,palette_offsets('#FF0000',pixels[:1],1))
        self.assertEqual(secondary,palette_offsets('#FF0000',pixels[1:2],1))
        self.assertNotEqual(primary,palette_offsets('#FF0000',pixels,1))
        self.assertEqual(palette_offsets('#FF0000',pixels,1,np.zeros_like(mask),1),palette_offsets('#FF0000',pixels,1))
        self.assertEqual(palette_offsets('#FF0000',pixels,1,mask[:1],1),palette_offsets('#FF0000',pixels,1))

    def test_native_controls_override_wheel_and_preserve_unspecified_values(self):
        original = material(palette1Color='#FF0000', palette1Controls={'hue': .9, 'brightness': -.032},
                            palette2Controls={'saturation': 0, 'contrast': 1.029})
        result = translate_colors(original, self.pixels)
        self.assertTrue(result['ready'], result['diagnostics'])
        values = result['definition']['otherValues']
        self.assertAlmostEqual(values['palette1'][0], .9)
        self.assertAlmostEqual(values['palette1'][2], -.032)
        self.assertEqual(values['palette2'][:3], [float(np.float32(.2)), 0, float(np.float32(-.1))])
        self.assertNotIn('palette1Controls', values)
        self.assertNotIn('palette1Color', values)
        self.assertIn('palette1Controls', original['otherValues'])

    def test_native_controls_validate_ranges_and_shader_support(self):
        for controls in ({'hue': 2}, {'brightness': float('nan')}, {'contrast': True}, {'unknown': 0}):
            self.assertFalse(translate_colors(material(palette1Controls=controls), self.pixels)['ready'])
        self.assertFalse(translate_colors(material('Uber', palette1Controls={'hue': .9}), self.pixels)['ready'])

    def pixels(self, _):
        return np.array([[0, .3, .6, .4], [0, .5, .8, .6]], dtype=np.float32)

    def test_native_metadata_is_unchanged_and_no_texture_is_read(self):
        original = material()
        result = translate_colors(original, lambda _: self.fail('Unnecessary texture read'))
        self.assertEqual(result['definition'], original)
        self.assertTrue(result['ready'])
        self.assertEqual(result['converted'], [])

    def test_both_channels_preserve_specular_and_input(self):
        original = material(palette1Color='#8040c0', palette2Color='#20a060')
        before = copy.deepcopy(original)
        result = translate_colors(original, self.pixels)
        self.assertEqual(original, before)
        self.assertTrue(result['ready'])
        values = result['definition']['otherValues']
        self.assertNotIn('palette1Color', values)
        self.assertNotIn('palette2Color', values)
        self.assertEqual(values['palette1Specular'], [.3, .4, .5])
        self.assertNotEqual(values['palette1'], values['palette2'])
        self.assertAlmostEqual(values['palette1'][3], 1.2)

    def test_nested_eye_skin_and_override(self):
        original = {'slots': [{'materialInfo': {
            **material('HairC', palette1Color='#482d18'),
            'eyeMatInfo': material('Eye', palette1Color='#1122ff'),
            'materialOverrides': {'1': material('Garment', palette2Color='#44ff22')}}},
            {'slotName': 'skinMats', 'materialInfo': {'mats': [
                material('SkinB', palette1Color='#d0a080')]}}]}
        result = translate_colors(original, self.pixels)
        self.assertTrue(result['ready'])
        self.assertEqual(len(result['converted']), 4)

    def test_black_white_and_gray_are_finite(self):
        for swatch in ('#000000', '#ffffff', '#808080'):
            result = translate_colors(material(palette1Color=swatch), self.pixels)
            self.assertTrue(result['ready'])
            values = result['definition']['otherValues']['palette1']
            self.assertTrue(np.isfinite(values).all())
            self.assertAlmostEqual(values[1], 1)

    def test_unsupported_edits_are_retained_and_blocked(self):
        cases = [material('Uber', palette1Color='#123456'),
                 material('SkinB', palette2Color='#123456'),
                 material(palette1Color='red'),
                 material(palette1Color='#123456', palette1=[0, 0, 0, float('nan')])]
        no_map = material(palette1Color='#123456')
        no_map['ddsPaths'] = {}
        cases.append(no_map)
        for original in cases:
            result = translate_colors(original, self.pixels)
            self.assertFalse(result['ready'])
            self.assertEqual(len(result['diagnostics']), 1)
            self.assertTrue(any(k.endswith('Color') for k in result['definition']['otherValues']))

    def test_missing_or_bad_pixels_block_instead_of_default_color(self):
        for pixels in ([], [1, 2, 3], [0, 0, float('inf'), 1]):
            result = translate_colors(material(palette1Color='#123456'), lambda _: pixels)
            self.assertFalse(result['ready'])
        def missing(_):
            raise FileNotFoundError('texture absent')
        self.assertFalse(translate_colors(material(palette1Color='#123456'), missing)['ready'])

    def test_duplicate_calibrations_are_reused_but_arrays_are_independent(self):
        calls = []
        def load(name):
            calls.append(name)
            return self.pixels(name)
        result = translate_colors([material(palette1Color='#abcdef') for _ in range(3)], load)
        self.assertEqual(len(calls), 1)
        a, b, _ = result['definition']
        a['otherValues']['palette1'][0] = 10
        self.assertNotEqual(a, b)


if __name__ == '__main__':
    unittest.main(argv=[sys.argv[0]])
