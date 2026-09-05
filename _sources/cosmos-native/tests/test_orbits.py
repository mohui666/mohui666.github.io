import tempfile
import unittest
from pathlib import Path
import sys

import numpy as np

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from cosmos_native.orbits import OrbitSystem, OrbitSettings
from cosmos_native.hydro import lane_emden


class ScientificChecks(unittest.TestCase):
    def test_solar_ephemeris_year(self):
        system=OrbitSystem.solar()
        system.advance(365.25)
        errors=system.ephemeris_errors()
        energy=abs((system.energy()-system.reference_energy)/system.reference_energy)
        self.assertLess(errors[3],.2)
        self.assertLess(errors[4],1.)
        self.assertLess(energy,1e-11)
        print("DE440 year errors/km",errors,"energy",energy,flush=True)

    def test_mass_radius_overlap_and_roundtrip(self):
        system=OrbitSystem.solar()
        earth=system.bodies[3]
        radius=earth.radius
        position=list(earth.position)
        velocity=list(earth.velocity)
        system.edit(3,{"mass":earth.mass*100})
        self.assertEqual(earth.radius,radius)
        self.assertEqual(earth.position,position)
        self.assertEqual(earth.velocity,velocity)
        system.edit(3,{"position":list(system.bodies[0].position)})
        self.assertEqual(system.sim.t,0)
        self.assertEqual((system.contact["i"],system.contact["j"]),(0,3))
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/"scene.json"
            system.save(path)
            loaded=OrbitSystem.load(path)
            self.assertEqual(loaded.bodies[3].radius,radius)
            self.assertIsNotNone(loaded.contact)

    def test_earth_sun_contact_convergence(self):
        times=[]
        for max_step in (.25,2.5):
            system=OrbitSystem.solar(settings=OrbitSettings(max_step_days=max_step))
            radius=system.bodies[3].radius
            system.fall_to_sun(3)
            system.advance(80)
            self.assertEqual((system.contact["i"],system.contact["j"]),(0,3))
            self.assertEqual(system.bodies[3].radius,radius)
            self.assertLess(abs(system.contact["surface_gap_m"]),1)
            times.append(system.sim.t)
        self.assertLess(abs(times[0]-times[1])*86400,.01)
        print("Earth-Sun contact days",times,flush=True)

    def test_polytrope_exact_n1(self):
        r,rho,p,u,surface=lane_emden(1,2e30,7e8)
        x=r/(7e8/surface)
        self.assertLess(abs(surface-np.pi),1e-9)
        self.assertLess(np.max(abs(rho/rho[0]-np.sinc(x/np.pi))),1e-8)
        self.assertTrue(np.all(p>0))


if __name__=="__main__":
    unittest.main()
