import test from 'node:test';
import assert from 'node:assert/strict';
import { G, PhysicsEngine } from '../src/physics.js';
import { createPreset } from '../src/presets.js';
const newtonian = (bodies, params = {}) => new PhysicsEngine(bodies, { integrator: 'verlet', ...params, gravityModel: 'newtonian' });

const norm = v => Math.hypot(...v);
const difference = (a, b) => norm(a.map((x, axis) => x - b[axis]));
const particle = (id, mass, position, velocity, radius = 0) => ({ id, name: id, mass, radius, color: '#ffffff', position, velocity, spin: [0, 0, 0] });

function circularOrbit(integrator, steps) {
  const mass = 0.001, totalMass = 1 + mass, relativeSpeed = Math.sqrt(G * totalMass);
  const initial = { bodies: [
    particle('primary', 1, [-mass / totalMass, 0, 0], [0, -relativeSpeed * mass / totalMass, 0]),
    particle('secondary', mass, [1 / totalMass, 0, 0], [0, relativeSpeed / totalMass, 0]),
  ], params: { collisionMode: 'none', softening: 0 } };
  const engine = newtonian(initial.bodies, { ...initial.params, integrator });
  const reference = engine.diagnostics();
  const period = 2 * Math.PI * Math.sqrt(1 / (G * 1.001));
  let maxEnergyError = 0;
  for (let i = 0; i < steps; i++) {
    engine.step(period / steps);
    maxEnergyError = Math.max(maxEnergyError, Math.abs(engine.diagnostics().energyError));
  }
  return { engine, reference, maxEnergyError, positionError: difference(engine.bodies[1].position, initial.bodies[1].position) };
}

test('Kepler two-body orbit: Verlet convergence, energy and conserved momenta', () => {
  const coarse = circularOrbit('verlet', 200);
  const fine = circularOrbit('verlet', 400);
  assert.ok(fine.positionError < coarse.positionError / 3.8, 'halving dt should reduce second-order phase error by approximately four');
  assert.ok(fine.positionError < 0.0006, 'one-orbit position error must remain below 0.0006 AU');
  assert.ok(fine.maxEnergyError < 2e-8);
  const final = fine.engine.diagnostics();
  assert.ok(difference(final.momentum, fine.reference.momentum) < 1e-13);
  assert.ok(difference(final.angularMomentum, fine.reference.angularMomentum) < 1e-13);
  console.log(`Verlet: one orbit error ${fine.positionError.toExponential(3)} AU; refinement ratio ${(coarse.positionError / fine.positionError).toFixed(3)}; max |ΔE/E₀| ${fine.maxEnergyError.toExponential(3)}`);
});

test('RK4 integrates the same independent Kepler orbit', () => {
  const result = circularOrbit('rk4', 200);
  assert.ok(result.positionError < 2e-7);
  assert.ok(result.maxEnergyError < 6e-9);
  console.log(`RK4: one orbit error ${result.positionError.toExponential(3)} AU; max |ΔE/E₀| ${result.maxEnergyError.toExponential(3)}`);
});

test('softened acceleration matches the gradient of the reported potential', () => {
  const bodies = [particle('a', 1.3, [0, 0, 0], [0, 0, 0]), particle('b', 0.7, [2, 0, 0], [0, 0, 0])];
  const params = { softening: 0.4, gravityScale: 0.8, collisionMode: 'none' };
  const potentialAt = x => {
    const sample = structuredClone(bodies);
    sample[0].position[0] = x;
    return newtonian(sample, params).diagnostics().potential;
  };
  const h = 1e-5;
  const forceFromPotential = -(potentialAt(h) - potentialAt(-h)) / (2 * h);
  const engine = newtonian(bodies, params);
  const dt = 1e-7;
  engine.step(dt);
  assert.ok(Math.abs(engine.bodies[0].mass * engine.bodies[0].velocity[0] / dt - forceFromPotential) < 1e-7);
});

test('merging preserves mass, linear and total angular momentum and records energy exchange', () => {
  const a = particle('a', 2, [-0.08, 0, 0], [1, 0.7, 0], 0.1);
  const b = particle('b', 3, [0.08, 0, 0], [-0.4, -0.2, 0], 0.1);
  a.spin = [0, 0, 0.3];
  b.spin = [0, 0, -0.1];
  const engine = newtonian([a, b], { gravityScale: 0, collisionMode: 'merge' });
  const before = engine.diagnostics();
  engine.step(1e-8);
  const after = engine.diagnostics();
  assert.equal(engine.bodies.length, 1);
  assert.equal(after.mass, 5);
  assert.ok(difference(before.momentum, after.momentum) < 1e-12);
  assert.ok(difference(before.angularMomentum, after.angularMomentum) < 1e-12);
  assert.ok(Math.abs(after.energy + after.dissipated - before.energy) < 1e-12);
  assert.ok(Math.abs(engine.bodies[0].radius ** 3 - 2 * 0.1 ** 3) < 1e-15);
  assert.equal(engine.collisionCount, 1);
});

test('oblique elastic contact preserves kinetic energy and total momentum', () => {
  const a = particle('a', 2, [-0.1, 0, 0], [1, 0.2, 0], 0.1);
  const b = particle('b', 1, [0.1, 0, 0], [-0.8, -0.1, 0], 0.1);
  const engine = newtonian([a, b], { gravityScale: 0, collisionMode: 'elastic', restitution: 1 });
  const before = engine.diagnostics();
  engine.step(1e-5);
  const after = engine.diagnostics();
  assert.equal(engine.collisionCount, 1);
  assert.ok(Math.abs(before.kinetic - after.kinetic) < 1e-12);
  assert.ok(difference(before.momentum, after.momentum) < 1e-12);
  assert.ok(difference(before.angularMomentum, after.angularMomentum) < 1e-12);
});

test('J2000 solar initialization preserves Kepler elements, the Earth–Moon barycenter and zero total momentum', () => {
  const initial = createPreset('solar');
  const engine = newtonian(initial.bodies, initial.params);
  assert.equal(engine.bodies.length, 10);
  const d = engine.diagnostics();
  assert.ok(norm(d.com) < 1e-14);
  assert.ok(norm(d.momentum) < 1e-14);
  const sun = engine.bodies.find(b => b.id === 'sun');
  const earth = engine.bodies.find(b => b.id === 'earth');
  const moon = engine.bodies.find(b => b.id === 'moon');
  const earthMoonMass = earth.mass + moon.mass;
  const barycenter = {
    mass: earthMoonMass,
    position: earth.position.map((x, axis) => (earth.mass * x + moon.mass * moon.position[axis]) / earthMoonMass),
    velocity: earth.velocity.map((v, axis) => (earth.mass * v + moon.mass * moon.velocity[axis]) / earthMoonMass),
  };
  const orbitalInvariants = (b, center) => {
    const r = b.position.map((x, axis) => x - center.position[axis]);
    const v = b.velocity.map((x, axis) => x - center.velocity[axis]);
    const mu = G * (b.mass + center.mass);
    const energy = norm(v) ** 2 / 2 - mu / norm(r);
    const h = [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]];
    return { a: -mu / (2 * energy), e: Math.sqrt(1 + 2 * energy * norm(h) ** 2 / mu ** 2), inclination: Math.acos(h[2] / norm(h)) * 180 / Math.PI };
  };
  const mercury = orbitalInvariants(engine.bodies.find(b => b.id === 'mercury'), sun);
  assert.ok(Math.abs(mercury.a - 0.38709927) < 1e-12);
  assert.ok(Math.abs(mercury.e - 0.20563593) < 1e-12);
  assert.ok(Math.abs(mercury.inclination - 7.00497902) < 1e-10);
  const emb = orbitalInvariants(barycenter, sun);
  assert.ok(Math.abs(emb.a - 1.00000261) < 1e-12);
  assert.ok(Math.abs(emb.e - 0.01671123) < 1e-11);
  const lunar = orbitalInvariants(moon, earth);
  assert.ok(Math.abs(lunar.a * 149597870.7 - 384400) < 1e-5);
  assert.ok(Math.abs(lunar.e - 0.0549) < 1e-10);
  assert.ok(Math.abs(lunar.inclination - 5.145) < 1e-9);
});

test('the complete ten-body solar system keeps a bound Moon and conserves energy over one Julian year', () => {
  const initial = createPreset('solar');
  const engine = newtonian(initial.bodies, initial.params);
  const reference = engine.diagnostics();
  let maxEnergyError = 0;
  let minimumLunarDistance = Infinity;
  let maximumLunarDistance = 0;
  for (let i = 0; i < 20000; i++) {
    engine.step(1 / 20000);
    if (i % 20 === 0) {
      maxEnergyError = Math.max(maxEnergyError, Math.abs(engine.diagnostics().energyError));
      const earth = engine.bodies.find(b => b.id === 'earth');
      const moon = engine.bodies.find(b => b.id === 'moon');
      const distance = difference(earth.position, moon.position);
      minimumLunarDistance = Math.min(minimumLunarDistance, distance);
      maximumLunarDistance = Math.max(maximumLunarDistance, distance);
    }
  }
  assert.ok(maxEnergyError < 2e-9);
  assert.ok(minimumLunarDistance > 0.0022 && maximumLunarDistance < 0.0029);
  assert.ok(difference(engine.diagnostics().angularMomentum, reference.angularMomentum) < 1e-12);
  assert.ok(norm(engine.diagnostics().momentum) < 1e-13);
  console.log(`Solar system: one Julian year, 10 bodies; max |ΔE/E₀| ${maxEnergyError.toExponential(3)}; lunar distance ${minimumLunarDistance.toFixed(6)}–${maximumLunarDistance.toFixed(6)} AU`);
});
