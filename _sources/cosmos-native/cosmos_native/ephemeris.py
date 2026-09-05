from dataclasses import dataclass, asdict
from pathlib import Path

import numpy as np
import spiceypy as spice

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
AU = 149597870700.0
DAY = 86400.0
G_SI = 6.67430e-11
C = 299792458.0


@dataclass
class Body:
    key: str
    name: str
    naif: int
    mass: float
    radius: float
    position: list
    velocity: list
    color: str
    visible: bool = True
    j2: float = 0.0
    equatorial_radius: float = 0.0
    pole: tuple = (0.0, 0.0, 1.0)

    def dict(self):
        return asdict(self)


# DE440s contains system barycentres for Mars and the outer planets. Keep those
# labels explicit; their individual moons are not separately integrated.
CATALOG = [
    ("sun", "太阳", 10, 695700, "#ffd280"),
    ("mercury", "水星", 199, 2439.4, "#baa698"),
    ("venus", "金星", 299, 6051.8, "#e8bd80"),
    ("earth", "地球", 399, 6371.0084, "#68b9ff"),
    ("moon", "月球", 301, 1737.4, "#dddddf"),
    ("mars", "火星系统", 4, 3389.5, "#e4886b"),
    ("jupiter", "木星系统", 5, 69911, "#dfb891"),
    ("saturn", "土星系统", 6, 58232, "#eadba2"),
    ("uranus", "天王星系统", 7, 25362, "#9ce1e3"),
    ("neptune", "海王星系统", 8, 24622, "#728ff3"),
    ("pluto", "冥王星系统", 9, 1188.3, "#bdaaa3"),
]


class Ephemeris:
    def __init__(self):
        for name in ("naif0012.tls", "gm_de440.tpc", "pck00011.tpc", "de440s.bsp"):
            spice.furnsh(str(DATA / name))

    def epoch(self, utc):
        return float(spice.str2et(utc))

    def utc(self, et):
        return spice.et2utc(et, "ISOC", 3)

    def states(self, et):
        # Geometric simultaneous states. Light-time corrections would be wrong
        # as initial data for an N-body system sharing one coordinate time.
        return np.array([spice.spkezr(str(row[2]), et, "ECLIPJ2000", "NONE", "0")[0]
                         for row in CATALOG]) * 1000

    def bodies(self, et):
        states = self.states(et)
        bodies = []
        for row, state in zip(CATALOG, states):
            key, name, naif, radius, color = row
            gm = spice.bodvcd(naif, "GM", 1)[1][0] * 1e9
            body = Body(key, name, naif, gm / G_SI, radius * 1000,
                        state[:3].tolist(), state[3:].tolist(), color)
            if key == "earth":
                body.j2 = 1.08262668e-3
                body.equatorial_radius = 6378136.3
                body.pole = tuple(spice.pxform("J2000", "ECLIPJ2000", 0) @ np.array([0, 0, 1.]))
            elif key == "sun":
                body.j2 = 2.2e-7
                body.equatorial_radius = radius * 1000
                ra, dec = np.radians([286.13, 63.87])
                pole = np.array([np.cos(dec)*np.cos(ra), np.cos(dec)*np.sin(ra), np.sin(dec)])
                body.pole = tuple(spice.pxform("J2000", "ECLIPJ2000", 0) @ pole)
            bodies.append(body)
        return bodies
