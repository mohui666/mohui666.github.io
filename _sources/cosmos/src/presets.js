import { G } from './physics.js';

const TAU = Math.PI * 2;
const AU_KM = 149597870.7;
const SOLAR_GM = 132712440041.27942; // km³/s²; JPL DE440

export const PRESETS = [
  { id: 'solar', name: '太阳系', subtitle: 'SOLAR SYSTEM', description: '太阳、八大行星与月球的 EIH 1PN 广义相对论弱场模拟。行星采用 JPL 的 J2000 近似轨道元素；月球采用平均地心椭圆与人为相位。不是实时或高精度星历。', scale: 35, dt: 0.00005, softening: 0, speed: 0.35 },
];

function body(id, name, mass, radius, color, position, velocity) {
  return { id, name, mass, radius, color, position, velocity, spin: [0, 0, 0] };
}

function rotate(vector, angle) {
  const [x, y, z] = vector;
  return [x, y * Math.cos(angle) - z * Math.sin(angle), y * Math.sin(angle) + z * Math.cos(angle)];
}

function recenter(bodies) {
  const mass = bodies.reduce((total, b) => total + b.mass, 0);
  const com = [0, 0, 0];
  const velocity = [0, 0, 0];
  for (const b of bodies) for (let axis = 0; axis < 3; axis++) {
    com[axis] += b.mass * b.position[axis] / mass;
    velocity[axis] += b.mass * b.velocity[axis] / mass;
  }
  for (const b of bodies) {
    b.position = b.position.map((x, axis) => x - com[axis]);
    b.velocity = b.velocity.map((v, axis) => v - velocity[axis]);
    if (b.referenceOrbit) b.referenceOrbit = b.referenceOrbit.map(p => p.map((x, axis) => x - com[axis]));
    if (b.referenceCenter) b.referenceCenter = b.referenceCenter.map((x, axis) => x - com[axis]);
  }
  return bodies;
}

// a: semi-major axis, f: true anomaly. Velocities are relative to the primary.
function keplerState(a, e, f, totalMass) {
  const p = a * (1 - e * e);
  const r = p / (1 + e * Math.cos(f));
  const v = Math.sqrt(G * totalMass / p);
  return { position: [r * Math.cos(f), r * Math.sin(f), 0], velocity: [-v * Math.sin(f), v * (e + Math.cos(f)), 0] };
}

function orientOrbit(vector, inclination, node, peri) {
  const i = inclination * Math.PI / 180;
  const o = node * Math.PI / 180;
  const w = peri * Math.PI / 180;
  const x = vector[0] * Math.cos(w) - vector[1] * Math.sin(w);
  const y = vector[0] * Math.sin(w) + vector[1] * Math.cos(w);
  return [x * Math.cos(o) - y * Math.cos(i) * Math.sin(o), x * Math.sin(o) + y * Math.cos(i) * Math.cos(o), y * Math.sin(i)];
}

function elementState(a, e, inclination, longitude, longPeri, node, totalMass) {
  const mean = ((longitude - longPeri) * Math.PI / 180 + 3 * Math.PI) % TAU - Math.PI;
  let eccentric = e < 0.8 ? mean : Math.sign(mean || 1) * Math.PI;
  for (let k = 0; k < 20; k++) {
    const correction = (eccentric - e * Math.sin(eccentric) - mean) / (1 - e * Math.cos(eccentric));
    eccentric -= correction;
    if (Math.abs(correction) < 1e-14) break;
  }
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(eccentric / 2), Math.sqrt(1 - e) * Math.cos(eccentric / 2));
  const state = keplerState(a, e, nu, totalMass);
  const peri = longPeri - node;
  const transform = v => orientOrbit(v, inclination, node, peri);
  return {
    position: transform(state.position), velocity: transform(state.velocity),
    orbitalElements: { a, e, i: inclination, node, peri, nu: nu * 180 / Math.PI, centralId: 'sun' },
    referenceOrbit: Array.from({ length: 257 }, (_, k) => transform(keplerState(a, e, TAU * k / 256, totalMass).position)),
  };
}

function solar(options) {
  // JPL approximate planetary elements, 1800–2050 table, J2000 epoch.
  // Columns: a [AU], e, I, L, longitude of perihelion, ascending node [degrees].
  // The Earth row is the Earth–Moon barycenter; it is split below, preserving that state.
  const planets = [
    ['mercury', '水星', 22031.868551, 2439.4, '#baad9e', 0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593],
    ['venus', '金星', 324858.592, 6051.8, '#e7be81', 0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
    ['earth', '地球', 398600.435507, 6371.0084, '#6dbdf5', 1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0],
    ['mars', '火星', 42828.375816, 3389.5, '#ef866a', 1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    ['jupiter', '木星', 126712764.1, 69911, '#e2b888', 5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    ['saturn', '土星', 37940584.8418, 58232, '#d5c59c', 9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    ['uranus', '天王星', 5794556.4, 25362, '#98dfdf', 19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503],
    ['neptune', '海王星', 6836527.10058, 24622, '#758ef7', 30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
  ];
  const moonMass = 4902.800118 / SOLAR_GM;
  const bodies = [body('sun', '太阳', 1, 695700 / AU_KM, '#ffd28d', [0, 0, 0], [0, 0, 0])];
  for (const [id, name, gm, radiusKm, color, a, originalE, originalI, longitude, longPeri, node] of planets) {
    const mass = gm / SOLAR_GM;
    const e = options.eccentricity ?? originalE;
    const inclination = options.inclination ?? originalI;
    const state = elementState(a, e, inclination, longitude, longPeri, node, 1 + mass + (id === 'earth' ? moonMass : 0));
    const planet = { ...body(id, name, mass, radiusKm / AU_KM, color, state.position, state.velocity),
      orbitalElements: state.orbitalElements, referenceOrbit: state.referenceOrbit, referenceCenterId: 'sun', referenceCenter: [0, 0, 0] };
    bodies.push(planet);
  }
  const earth = bodies.find(b => b.id === 'earth');
  const earthMoonMass = earth.mass + moonMass;
  // Mean lunar a/e/I, with intentionally chosen L=45°, perihelion longitude=0°, node=0°.
  const lunar = elementState(384400 / AU_KM, 0.0549, 5.145, 45, 0, 0, earthMoonMass);
  const barycenterPosition = [...earth.position];
  const barycenterVelocity = [...earth.velocity];
  earth.position = earth.position.map((x, axis) => x - lunar.position[axis] * moonMass / earthMoonMass);
  earth.velocity = earth.velocity.map((v, axis) => v - lunar.velocity[axis] * moonMass / earthMoonMass);
  earth.elementReference = 'Earth–Moon barycenter';
  const moon = body('moon', '月球', moonMass, 1737.4 / AU_KM, '#c8cbd4',
    barycenterPosition.map((x, axis) => x + lunar.position[axis] * earth.mass / earthMoonMass),
    barycenterVelocity.map((v, axis) => v + lunar.velocity[axis] * earth.mass / earthMoonMass));
  moon.orbitalElements = { ...lunar.orbitalElements, centralId: 'earth' };
  moon.referenceCenterId = 'earth';
  moon.referenceCenter = [...earth.position];
  moon.referenceOrbit = lunar.referenceOrbit.map(p => p.map((x, axis) => x + earth.position[axis]));
  bodies.push(moon);
  const maximumRadius = Math.max(...bodies.filter(b => b.orbitalElements?.centralId === 'sun').map(b => b.orbitalElements.a * (1 + b.orbitalElements.e)));
  return { bodies, viewScale: maximumRadius * 1.15 };
}

export function createPreset(id, options = {}) {
  const preset = PRESETS.find(item => item.id === id);
  if (!preset) throw new Error(`未知场景：${id}`);
  const generators = { solar };
  const softening = options.softening ?? preset.softening;
  const result = generators[id](options, softening);
  const tilt = 0;
  for (const b of result.bodies) {
    b.position = rotate(b.position, tilt);
    b.velocity = rotate(b.velocity.map(v => v * (options.velocityScale ?? 1)), tilt);
    if (b.referenceOrbit) b.referenceOrbit = b.referenceOrbit.map(p => rotate(p, tilt));
  }
  recenter(result.bodies);
  return {
    ...result,
    params: { dt: preset.dt, softening, gravityScale: 1, gravityModel: 'gr1pn', integrator: 'rk4', collisionMode: 'fragment', restitution: 1 },
    viewScale: result.viewScale ?? preset.scale,
    speed: preset.speed,
    description: preset.description,
  };
}
