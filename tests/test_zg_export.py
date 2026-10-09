import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'worker'))
from zg_export import build_package, game_path


def material(family='Garment'):
    return {'matPath': '/art/test.mat',
            'ddsPaths': {k: '/art/' + k + '.dds' for k in ('diffuseMap', 'rotationMap', 'glossMap', 'paletteMap', 'paletteMaskMap')},
            'otherValues': {'derived': family, 'palette1': [0, .5, 0, 1], 'palette2': [0, .5, 0, 1]}}


def slot(name='chest', model='a'):
    return {'slotName': name, 'models': ['/art/' + model + '.gr2'], 'materialInfo': material()}


def assembly(slots=None, equipment=None):
    return {'profile': {'skeleton': 'art/test_skeleton.gr2'}, 'slots': slots or [slot()], 'equipment': equipment or []}


def export(value, state=None):
    return build_package(value, state or {}, lambda _: [0, .4, .6, .5], lambda p: [Path(p).stem])


class ZGExport(unittest.TestCase):
    def test_hidden_conflicting_layer_does_not_block_or_name_visible_gear(self):
        entries=[{'kind':'armor','bone':'@skin','slot':'face','models':['/art/'+name+'.gr2'],
                  'materialInfo':material(),'layer':layer,'name':name}
                 for layer,name in enumerate(('oldHelmet','newHelmet'))]
        value=assembly([slot('head','head')],entries)
        result=export(value,{'hidden':['equipment_0_oldHelmet']})
        self.assertEqual(result['preset']['faceGear']['name'],'newHelmet')
        self.assertEqual(next(s for s in result['paths'] if s['slotName']=='face')['models'],['/art/newHelmet.gr2'])
        with self.assertRaisesRegex(ValueError,'Multiple clothing layers'):
            export(value)

    def test_preview_mapping_avoids_reading_hidden_models(self):
        from zg_export import effective_slots
        value=assembly([slot(),slot(model='b')])
        parts=[{'name':name,'source':'/art/'+name+'.gr2'} for name in ('a','b')]
        slots,_,_=effective_slots(value,{'hidden':['a'],'previewParts':parts},lambda _:self.fail('Preview already identifies the source'))
        self.assertEqual([s['models'] for s in slots],[[],['/art/b.gr2']])

    def test_legacy_structure_and_input_unchanged(self):
        original = assembly();before = copy.deepcopy(original)
        result = export(original)
        self.assertEqual(original, before)
        self.assertEqual(result['skeleton'], {'path': '/art/test_skeleton.gr2'})
        self.assertEqual(result['paths'][-1]['slotName'], 'skinMats')
        self.assertEqual(result['paths'][0]['materialInfo']['otherValues']['materialSkinIndex'], '-1')

    def test_equivalent_pieces_merge_but_conflicting_colors_fail(self):
        value = assembly([slot(), slot(model='b')])
        self.assertEqual(len(export(value)['paths'][0]['models']), 2)
        value['slots'][1]['materialInfo']['otherValues']['palette1Color'] = '#8040C0'
        with self.assertRaisesRegex(ValueError, 'different colors'):
            export(value)

    def test_skin_nesting_and_primary_skin_color_match(self):
        body = slot('hand');body['materialInfo'] = material('SkinB')
        skin = {**material('SkinB'), 'slotName': 'hand'}
        value = assembly([body, {'slotName': 'skinMats', 'models': [], 'materialInfo': {'mats': [skin]}}])
        body['materialInfo']['otherValues']['palette1Color'] = '#D0A080'
        result = export(value)['paths']
        exported_skin = result[-1]['materialInfo']['mats'][0]
        self.assertEqual(exported_skin['materialInfo'], {'matPath': '/art/test.mat'})
        self.assertEqual(exported_skin['otherValues'], result[0]['materialInfo']['otherValues'])

    def test_eye_override_maps_without_requiring_legacy_eye_mat_path(self):
        head = slot('head');eye = material('Eye');eye.pop('matPath')
        head['materialInfo']['eyeMatInfo'] = eye
        head['materialInfo']['materialOverrides'] = {'1': copy.deepcopy(eye)}
        result = export(assembly([head]))
        self.assertEqual(result['paths'][0]['materialInfo']['eyeMatInfo']['otherValues']['derived'], 'Eye')

    def test_clothing_replacement_components_and_colors(self):
        entry = {'kind': 'armor', 'bone': '@skin', 'slot': 'chest', 'models': ['/art/replacement.gr2'],
                 'materialInfo': material(), 'layer': 0, 'name': 'Jacket', 'references': ['ipp.test'],
                 'colors': {'*': {'primary': '#8040C0', 'secondary': '#20A060'}}}
        result = export(assembly(equipment=[entry]))
        self.assertEqual(result['paths'][0]['models'], ['/art/replacement.gr2'])
        self.assertEqual(result['colorsTranslated'], 2)
        self.assertEqual(result['preset']['chestGear']['ippPath'], 'ipp.test')

    def test_rigid_equipment_excluded_with_notice(self):
        entry = {'kind': 'rigid', 'bone': 'RightWeapon', 'layer': 0, 'name': 'Saber', 'models': []}
        result = export(assembly(equipment=[entry]), {'hidden': ['equipment_0_blade']})
        self.assertEqual(len(result['warnings']), 1)
        self.assertEqual(result['paths'][0]['models'], ['/art/a.gr2'])

    def test_hidden_models_omitted_unknown_names_block(self):
        value = assembly([slot(), slot(model='b')])
        self.assertEqual(export(value, {'hidden': ['a']})['paths'][0]['models'], ['/art/b.gr2'])
        with self.assertRaisesRegex(ValueError, 'Cannot map hidden'):
            export(value, {'hidden': ['unknown']})

    def test_unsupported_override_and_missing_skin_block(self):
        value = assembly()
        value['slots'][0]['materialInfo']['materialOverrides'] = {'1': material('Uber')}
        with self.assertRaisesRegex(ValueError, 'override'):
            export(value)
        value = assembly();value['slots'][0]['materialInfo']['otherValues']['materialSkinIndex'] = 1
        with self.assertRaisesRegex(ValueError, 'skin material'):
            export(value)

    def test_preview_name_mapping_hides_helmet_and_keeps_head(self):
        entry = {'kind': 'armor', 'bone': '@skin', 'slot': 'face', 'models': ['/art/helmet.gr2', '/art/crown.gr2'],
                 'materialInfo': material(), 'layer': 0, 'name': 'Helmet'}
        value = assembly([slot('head', 'head')], [entry])
        parts = [{'name': 'equipment_0_preview_' + m, 'source': '/art/' + m + '.gr2', 'equipmentLayer': 0}
                 for m in ('helmet', 'crown')]
        state = {'hidden': [p['name'] for p in parts], 'previewParts': parts}
        parts.append({'name': 'head', 'source': '/art/head.gr2'})
        result = export(value, state)
        self.assertEqual(result['paths'][0]['models'], ['/art/head.gr2'])
        self.assertNotIn('faceGear', result['preset'])
        self.assertFalse(any(s['slotName'] == 'face' for s in result['paths']))
        state['hidden'] = ['head']
        result = export(value, state)
        self.assertEqual(result['paths'][0]['models'], ['/art/helmet.gr2', '/art/crown.gr2'])
        state['hidden'] = ['equipment_1_preview_helmet']
        self.assertEqual(len(export(value, state)['paths']),3)  # stale flag, current parts remain visible
        parts.append({'name': 'equipment_1_preview_helmet', 'source': '/art/other.gr2', 'equipmentLayer': 1})
        with self.assertRaisesRegex(ValueError, 'Cannot map hidden'):
            export(value, state)

    def test_missing_maps_bad_paths_and_collision_block(self):
        value = assembly();value['slots'][0]['materialInfo']['ddsPaths'].pop('paletteMap')
        with self.assertRaisesRegex(ValueError, 'required maps'):
            export(value)
        for value in ('../art/a.gr2', 'C:/art/a.gr2', '/art/../a.gr2', '/art//a.gr2'):
            with self.assertRaises(ValueError):
                game_path(value)
        with self.assertRaisesRegex(ValueError, 'Conflicting model'):
            export(assembly([slot(), slot('hand')]))


if __name__ == '__main__':
    unittest.main(argv=[sys.argv[0]])
