"""Native IAS15 + REBOUNDx all-body 1PN, SI-facing / AU-day internal units."""
import copy
import json
from dataclasses import dataclass, asdict

import numpy as np
import rebound
import reboundx

from .ephemeris import AU, DAY, G_SI, C, Body, Ephemeris

MASS_UNIT = 1.988409870698051e30
G = G_SI * MASS_UNIT * DAY**2 / AU**3


@dataclass
class OrbitSettings:
    epsilon: float = 1e-10
    max_step_days: float = 0.25
    relativity: bool = True
    quadrupoles: bool = True


class OrbitSystem:
    def __init__(self, bodies, epoch, settings=None):
        self.bodies = copy.deepcopy(bodies)
        self.epoch = epoch
        self.settings = settings or OrbitSettings()
        self.contact = None
        self.modified = False
        self._build(0)
        self.resolve_contact()
        self.reference_energy = self.energy() if self.contact is None else 0.0

    @classmethod
    def solar(cls, utc="2026-09-05T00:00:00", settings=None):
        ephem = Ephemeris()
        epoch = ephem.epoch(utc)
        return cls(ephem.bodies(epoch), epoch, settings)

    def _build(self, t):
        self.sim = rebound.Simulation()
        self.sim.G = G
        for b in self.bodies:
            self.sim.add(m=b.mass/MASS_UNIT, r=b.radius/AU,
                         x=b.position[0]/AU, y=b.position[1]/AU, z=b.position[2]/AU,
                         vx=b.velocity[0]*DAY/AU, vy=b.velocity[1]*DAY/AU, vz=b.velocity[2]*DAY/AU)
        self.sim.t = t
        self.sim.integrator = "ias15"
        self.sim.dt = min(.01, self.settings.max_step_days)
        self.sim.integrator.epsilon = self.settings.epsilon
        self.rebx = reboundx.Extras(self.sim)
        self.gr = None
        if self.settings.relativity:
            self.gr = self.rebx.load_force("gr_full")
            self.gr.params["c"] = C * DAY / AU
            self.rebx.add_force(self.gr)
        if self.settings.quadrupoles:
            self.j2_force = self.rebx.create_force("cosmos_quadrupoles")
            self.j2_force.force_type = "pos"
            self.j2_force.update_accelerations = self._quadrupoles
            self.rebx.add_force(self.j2_force)

    def _quadrupoles(self, sim_pointer, force_pointer, particles, count):
        # Static, axisymmetric J2, with the actual J2000 spin-axis direction.
        # The equal and opposite force on the source preserves linear momentum.
        for i, body in enumerate(self.bodies):
            if body.j2 == 0:
                continue
            source = particles[i]
            pole = body.pole
            for j in range(count):
                if i == j:
                    continue
                p = particles[j]
                r = np.array([p.x-source.x, p.y-source.y, p.z-source.z])
                d = np.linalg.norm(r)
                n = r/d
                mu = np.dot(n, pole)
                a = (1.5*G*source.m*body.j2*(body.equatorial_radius/AU)**2/d**4
                     * ((5*mu*mu-1)*n - 2*mu*np.array(pole)))
                p.ax += a[0]; p.ay += a[1]; p.az += a[2]
                source.ax -= a[0]*p.m/source.m
                source.ay -= a[1]*p.m/source.m
                source.az -= a[2]*p.m/source.m

    def sync(self):
        for b, p in zip(self.bodies, self.sim.particles):
            b.position = [p.x*AU, p.y*AU, p.z*AU]
            b.velocity = [p.vx*AU/DAY, p.vy*AU/DAY, p.vz*AU/DAY]

    def energy(self):
        energy = self.rebx.gr_full_hamiltonian(self.gr) if self.gr else self.sim.energy()
        if self.settings.quadrupoles:
            for i, b in enumerate(self.bodies):
                if not b.j2:
                    continue
                p = self.sim.particles[i]
                for j, q in enumerate(self.sim.particles):
                    if i == j:
                        continue
                    r = np.array([q.x-p.x, q.y-p.y, q.z-p.z])
                    d = np.linalg.norm(r)
                    mu = np.dot(r/d, b.pole)
                    energy += G*p.m*q.m*b.j2*(b.equatorial_radius/AU)**2/d**3*(3*mu*mu-1)/2
        return energy * MASS_UNIT * (AU/DAY)**2

    def edit(self, index, changes):
        body = self.bodies[index]
        if changes.get("mass", body.mass) <= 0 or changes.get("radius", body.radius) <= 0:
            raise ValueError("质量和半径必须大于零")
        for key, value in changes.items():
            setattr(body, key, value)
        self._build(self.sim.t)
        self.modified = True
        self.contact = None
        self.resolve_contact()
        if self.contact is None:
            self.reference_energy = self.energy()

    def fall_to_sun(self, index):
        sun = next(b for b in self.bodies if b.key == "sun")
        if self.bodies[index].key == "sun":
            raise ValueError("请选择太阳以外的天体")
        self.edit(index, {"velocity": list(sun.velocity)})

    def resolve_contact(self):
        for i, a in enumerate(self.bodies):
            for j in range(i+1, len(self.bodies)):
                b = self.bodies[j]
                distance = np.linalg.norm(np.array(a.position)-b.position)
                radius = a.radius+b.radius
                if distance <= radius + max(0.01, radius*1e-9):
                    self.contact = {"i": i, "j": j, "time_days": self.sim.t,
                                    "distance_m": distance, "surface_gap_m": distance-radius,
                                    "speed_m_s": np.linalg.norm(np.array(a.velocity)-b.velocity)}
                    return self.contact
        return None

    def _step_bound(self):
        result = self.settings.max_step_days
        for i, a in enumerate(self.bodies):
            for b in self.bodies[i+1:]:
                r = (np.array(b.position)-a.position)/AU
                v = (np.array(b.velocity)-a.velocity)*DAY/AU
                d = np.linalg.norm(r)
                R = (a.radius+b.radius)/AU
                mu = G*(a.mass+b.mass)/MASS_UNIT
                if np.dot(r, v) < 0 or np.linalg.norm(v) < 1e-12:
                    speed = np.linalg.norm(v)
                    # Include gravitational curvature even for release from rest.
                    closing = speed + np.sqrt(2*mu/max(d, R))
                    result = min(result, .4*max(d-R, R*1e-10)/closing,
                                 .05*np.sqrt(d**3/mu))
        return result

    def advance(self, days):
        if days <= 0:
            raise ValueError("动力学只向前积分；回放请使用保存的数据")
        target = self.sim.t + days
        self.sync()
        if self.resolve_contact():
            return
        while self.sim.t < target:
            self._check_domain()
            dt = min(target-self.sim.t, self._step_bound())
            self.sim.integrate(self.sim.t+dt)
            self.sync()
            if self.resolve_contact():
                return

    def _check_domain(self):
        for i, b in enumerate(self.bodies):
            compactness = G_SI*b.mass/(b.radius*C*C)
            external = sum(G_SI*a.mass/np.linalg.norm(np.array(a.position)-b.position)
                           for j, a in enumerate(self.bodies) if i != j) / C**2
            if self.settings.relativity and max(compactness, external,
                    np.dot(b.velocity, b.velocity)/C**2) >= .01:
                raise ValueError("此设置已超出 1PN 弱场慢速模型；需要数值相对论求解器")

    def ephemeris_errors(self):
        expected = Ephemeris().states(self.epoch + self.sim.t*DAY)
        # Compare heliocentric differences so a barycentre convention is not
        # misreported as an orbital error. Modified experiments are not forecasts.
        current = np.array([b.position for b in self.bodies])
        return np.linalg.norm((current-current[0])-(expected[:,:3]-expected[0,:3]), axis=1)/1000

    def save(self, path):
        self.sync()
        data = {"format": "cosmos-native-1", "epoch_tdb_s": self.epoch,
                "time_days": self.sim.t, "settings": asdict(self.settings),
                "bodies": [b.dict() for b in self.bodies], "modified": self.modified,
                "contact": self.contact}
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    @classmethod
    def load(cls, path):
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        if d["format"] != "cosmos-native-1":
            raise ValueError("不是 Cosmos Native 场景")
        system = cls([Body(**b) for b in d["bodies"]], d["epoch_tdb_s"], OrbitSettings(**d["settings"]))
        system.sim.t = d["time_days"]
        system.modified = d["modified"]
        system.contact = d["contact"]
        return system
