import test from 'node:test';
import assert from 'node:assert/strict';
import { G, PhysicsEngine } from '../src/physics.js';
import { createPreset } from '../src/presets.js';

const body = (id, mass, position, velocity, radius) => ({ id, name: id, mass, position, velocity, radius, spin: [0, 0, 0] });
const difference = (a, b) => Math.hypot(...a.map((x, k) => x - b[k]));

test('continuous contact catches a high-speed crossing and integrates the remaining time', () => {
  for (const integrator of ['verlet', 'rk4']) {
    const engine = new PhysicsEngine([
      body('a', 1, [-1, 0, 0], [100, 0, 0], 0.001),
      body('b', 1, [1, 0, 0], [-100, 0, 0], 0.001),
    ], { gravityScale: 0, collisionMode: 'elastic', integrator });
    engine.step(0.05);
    assert.equal(engine.time, 0.05);
    assert.equal(engine.collisionCount, 1);
    assert.equal(engine.events[0].type, 'bounce');
    assert.ok(Math.abs(engine.events[0].time - 0.00999) < 1e-12);
    assert.ok(Math.abs(engine.bodies[0].position[0] + 4.002) < 1e-11);
    assert.ok(Math.abs(engine.bodies[1].position[0] - 4.002) < 1e-11);
  }
});

test('a high-speed near-miss does not turn into a collision', () => {
  for (const integrator of ['verlet', 'rk4']) {
    const engine = new PhysicsEngine([
      body('a', 1, [-1, 0, 0], [100, 0, 0], 0.001),
      body('b', 1, [1, 0.002001, 0], [-100, 0, 0], 0.001),
    ], { gravityScale: 0, collisionMode: 'fragment', integrator });
    engine.step(0.05);
    assert.equal(engine.bodies.length, 2);
    assert.equal(engine.collisionCount, 0);
    assert.equal(engine.time, 0.05);
  }
});

test('swept oblique merging preserves mass and linear/total angular momentum', () => {
  const a = body('a', 2, [-1, 0, 0], [100, 2, 0], 0.03);
  const b = body('b', 3, [1, 0.025, 0], [-100, 0, 0], 0.03);
  a.spin = [0.1, 0, 0.3];
  const engine = new PhysicsEngine([a, b], { gravityScale: 0, collisionMode: 'merge' });
  const before = engine.diagnostics();
  engine.step(0.02);
  const after = engine.diagnostics();
  assert.equal(engine.bodies.length, 1);
  assert.equal(engine.events[0].type, 'merge');
  assert.equal(after.mass, before.mass);
  assert.ok(difference(after.momentum, before.momentum) < 1e-12);
  assert.ok(difference(after.angularMomentum, before.angularMomentum) < 1e-12);
  assert.ok(Math.abs(after.correctedEnergyError) < 1e-14);
});

test('gravitational focusing turns a straight-line near-miss into a resolved curved impact', () => {
  const radius = 0.00101;
  // The initial impact parameter 0.0012 exceeds the combined physical radii.
  // Attraction bends this hyperbolic encounter into contact.
  const exactContactSpeed = Math.sqrt(1 + 2 * G * 0.000101 * (1 / radius - 1 / Math.hypot(0.01, 0.0012)));
  for (const integrator of ['verlet', 'rk4']) {
    const engine = new PhysicsEngine([
      body('target', 0.0001, [0, 0, 0], [0, 0, 0], 0.001),
      body('projectile', 0.000001, [-0.01, 0.0012, 0], [1, 0, 0], 0.00001),
    ], { integrator, collisionMode: 'merge' });
    engine.step(0.02);
    assert.equal(engine.collisionCount, 1);
    assert.equal(engine.time, 0.02);
    assert.ok(Math.abs(engine.events[0].impactSpeed / exactContactSpeed - 1) < 0.0001);
    assert.ok(engine.events[0].time > 0.006 && engine.events[0].time < 0.008);
  }
});

test('energetic impacts produce non-overlapping gravitating fragments within an energy budget', () => {
  const a = body('a', 2e-6, [-0.0001, 0, 0], [10, 1.2, 0], 0.0001);
  const b = body('b', 1e-6, [0.0001, 0, 0], [-12, -0.8, 0.2], 0.0001);
  a.spin = [1e-11, 2e-11, 3e-11];
  const engine = new PhysicsEngine([a, b], { collisionMode: 'fragment', fragmentCount: 6 });
  const before = engine.diagnostics();
  engine.step(1e-9);
  const after = engine.diagnostics();
  const event = engine.events[0];
  assert.equal(event.type, 'fragment');
  assert.equal(engine.fragmentationCount, 1);
  assert.equal(engine.destroyedCount, 2);
  assert.equal(engine.bodies.length, 6);
  assert.ok(engine.bodies.every(f => f.isFragment && f.mass > 0));
  assert.ok(Math.abs(after.mass - before.mass) < 1e-20);
  assert.ok(difference(after.momentum, before.momentum) < 1e-18);
  assert.ok(difference(after.angularMomentum, before.angularMomentum) < 1e-22);
  assert.ok(after.energy <= before.energy);
  assert.ok(event.ejectaEnergy <= 0.35 * (event.impactEnergy - event.disruptionEnergy));
  assert.ok(Math.abs(after.correctedEnergyError) < 1e-11);
  for (let i = 0; i < engine.bodies.length; i++) {
    for (let j = i + 1; j < engine.bodies.length; j++) {
      assert.ok(difference(engine.bodies[i].position, engine.bodies[j].position) > engine.bodies[i].radius + engine.bodies[j].radius);
    }
  }
  // They are active massive particles, so their velocities continue to change.
  const velocities = engine.bodies.map(f => [...f.velocity]);
  engine.step(1e-7);
  assert.ok(engine.bodies.some((f, k) => difference(f.velocity, velocities[k]) > 1e-6));
  assert.equal(engine.fragmentationCount, 1);
});

test('coincident finite spheres have finite reference energy and stars accrete small impactors', () => {
  const engine = new PhysicsEngine([
    body('sun', 1, [0, 0, 0], [0, 0, 0], 0.005),
    body('impactor', 1e-6, [0, 0, 0], [10000, 0, 0], 0.00005),
  ], { collisionMode: 'fragment', softening: 0 });
  engine.resetReference();
  const before = engine.diagnostics();
  assert.ok(Number.isFinite(before.energy));
  engine.step(1e-9);
  assert.equal(engine.bodies.length, 1);
  assert.equal(engine.bodies[0].id, 'sun');
  assert.equal(engine.events[0].reason, 'stellar-accretion');
  assert.ok(difference(engine.diagnostics().momentum, before.momentum) < 1e-14);
});

test('enabling continuous impacts preserves the default one-year solar-system accuracy', () => {
  const initial = createPreset('solar');
  const engine = new PhysicsEngine(initial.bodies, { ...initial.params, collisionMode: 'fragment' });
  let maximumError = 0;
  for (let i = 0; i < 20000; i++) {
    engine.step(0.00005);
    if (i % 20 === 0) maximumError = Math.max(maximumError, Math.abs(engine.diagnostics().energyError));
  }
  assert.equal(engine.bodies.length, 10);
  assert.equal(engine.collisionCount, 0);
  assert.ok(maximumError < 2e-9);
  console.log(`Continuous-contact solar system: one-year maximum energy error ${maximumError.toExponential(3)}`);
});
