import sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'worker'))
from saber_effects import layers,persistent,relative,native_layers

class PersistentEffects(unittest.TestCase):
 def test_only_idle_and_vent_events(self):
  for event in ['lightsaber_loop','lightsaber_loop_vent_01','dummy_vent_blade_02_loc']:
   self.assertTrue(persistent({'_fxStartFxName':event,'_fxResourceName':'blade.prt'}))
  for event in ['lightsaber_turn_on','lightsaber_turn_off','lightsaber_instant_on','lightsaber_swing','impact','NewFxGroup']:
   self.assertFalse(persistent({'_fxStartFxName':event,'_fxResourceName':'blade.prt'}))
  for text in ['dynamic_saber_trail','saber_critblade','saber_impact','saber_ignite']:
   self.assertFalse(persistent({'_fxStartFxName':'lightsaber_loop','_fxResourceName':text+'.prt'}))
  self.assertFalse(persistent({'_fxStartFxName':'lightsaber_loop','_conditions':'TRAILS TRUE'}))
 def test_reference_safety(self):
  for path in ['../a.prt','art/../../x','C:/secret']:
   with self.assertRaises(ValueError):relative(path)
 def test_recursive_flipbook_and_cycle(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);folder=root/'art/fx/particles';folder.mkdir(parents=True)
   texture=root/'art/fx/texture/unstable_dynamic_saber_core.dds';texture.parent.mkdir();texture.write_bytes(b'fixture')
   (folder/'emitter.prt').write_text('.ParticleType=BASIC_EMITTER\n.EmitSpec=particle.prt\n.EmitAtDeathSpec=impact.prt\n')
   (folder/'particle.prt').write_text('.ParticleType=BILLBOARD_POINT\n.TextureName=/art/fx/texture/unstable_dynamic_saber_core.dds\n.RowSize=16\n.ColumnSize=2\n.AnimationSpeed=0.08\n.StartFrame=-1\n.FrameMoveDirection=-1\n.DestBlend=D3DBLEND_INVSRCALPHA\n')
   diagnostics=[];result=layers(root,'emitter.prt',diagnostics)
   self.assertEqual(len(result),1);self.assertEqual(diagnostics,[])
   self.assertEqual((result[0]['columns'],result[0]['rows'],result[0]['fps']),(16,2,12.5))
   self.assertEqual(result[0]['direction'],-1)
   (folder/'cycle.prt').write_text('.ParticleType=BASIC_EMITTER\n.EmitSpec=cycle.prt\n')
   self.assertEqual(layers(root,'cycle.prt',diagnostics),[]);self.assertIn('Cyclic',diagnostics[-1])
 def test_motion_trail_flag_is_excluded(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);folder=root/'art/fx/particles';folder.mkdir(parents=True)
   (folder/'hidden.prt').write_text('.ParticleType=BILLBOARD_POINT\n.DoTrail=true\n.TextureName=art/fx/texture/dynamic_saber_core.dds\n')
   self.assertEqual(layers(root,'hidden.prt'),[])

if __name__=='__main__':unittest.main()
