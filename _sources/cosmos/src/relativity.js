// Harmonic-coordinate, order-reduced Einstein–Infeld–Hoffmann equations.
// Independent implementation of the 1PN equations and EIH Lagrangian integrals.
// Derivation: https://fiteoweb.unige.ch/~maggiore/GWVol1/EIHLagrangian.pdf
// All bodies contribute; terms beyond c^-2 and radiation reaction are omitted.
export const LIGHT_SPEED = 299792458 * 31557600 / 149597870700; // AU / Julian yr
const INV_C2 = 1 / LIGHT_SPEED ** 2;

export function relativisticState(bodies, positions, velocities, gravity, contactCore = false) {
  const count = bodies.length, potentials = new Float64Array(count), pairs = [];
  let maximum = 0;
  for (let i = 0; i < count; i++) {
    const k = i * 3;
    const v2 = velocities[k] ** 2 + velocities[k + 1] ** 2 + velocities[k + 2] ** 2;
    maximum = Math.max(maximum, v2 * INV_C2);
    for (let j = i + 1; j < count; j++) {
      const l = j * 3;
      const r = [positions[k] - positions[l], positions[k + 1] - positions[l + 1], positions[k + 2] - positions[l + 2]];
      const distance = Math.hypot(...r);
      // Only an overlapping initial/contact trial state uses the finite core.
      // Contact is resolved before further evolution; this is not an interior metric.
      const d = contactCore ? Math.max(distance, bodies[i].radius + bodies[j].radius) : distance;
      if (d === 0) throw new Error('1PN 点质量中心重合：请设置非零碰撞半径或分开天体。');
      const inverse = 1 / d, n = r.map(x => x * inverse);
      potentials[i] += gravity * bodies[j].mass * inverse;
      potentials[j] += gravity * bodies[i].mass * inverse;
      pairs.push({ i, j, r, n, inverse });
    }
  }
  for (const potential of potentials) maximum = Math.max(maximum, potential * INV_C2);
  return { potentials, pairs, maximum };
}

export function eihAcceleration(bodies, x, v, newtonian, gravity, state) {
  const result = Float64Array.from(newtonian);
  for (const pair of state.pairs) {
    for (const reverse of [false, true]) {
      const i = reverse ? pair.j : pair.i, j = reverse ? pair.i : pair.j;
      const k = i * 3, l = j * 3, sign = reverse ? -1 : 1;
      let vi2 = 0, vj2 = 0, vivj = 0, nvj = 0, ra = 0, radialVelocity = 0;
      for (let axis = 0; axis < 3; axis++) {
        vi2 += v[k + axis] ** 2; vj2 += v[l + axis] ** 2;
        vivj += v[k + axis] * v[l + axis];
        nvj += sign * pair.n[axis] * v[l + axis];
        ra += sign * pair.r[axis] * newtonian[l + axis];
        radialVelocity += sign * pair.n[axis] * (4 * v[k + axis] - 3 * v[l + axis]);
      }
      const scalar = 4 * state.potentials[i] + state.potentials[j] - vi2 - 2 * vj2 + 4 * vivj + 1.5 * nvj ** 2 + 0.5 * ra;
      const factor = gravity * bodies[j].mass * pair.inverse ** 2 * INV_C2;
      for (let axis = 0; axis < 3; axis++) {
        result[k + axis] += factor * (sign * pair.n[axis] * scalar
          + radialVelocity * (v[k + axis] - v[l + axis]) + 3.5 * newtonian[l + axis] / pair.inverse);
      }
    }
  }
  return result;
}

export function eihIntegrals(bodies, velocities, gravity, state) {
  const momenta = new Float64Array(velocities.length), clockRates = [], compactness = [];
  let energy = 0;
  for (let i = 0; i < bodies.length; i++) {
    const k = 3 * i, mass = bodies[i].mass;
    const v2 = velocities[k] ** 2 + velocities[k + 1] ** 2 + velocities[k + 2] ** 2;
    energy += (3 / 8 * mass * v2 ** 2 + 0.5 * mass * state.potentials[i] ** 2) * INV_C2;
    for (let axis = 0; axis < 3; axis++) momenta[k + axis] = mass * velocities[k + axis] * (1 + 0.5 * v2 * INV_C2);
    clockRates.push(1 - (0.5 * v2 + state.potentials[i]) * INV_C2);
    compactness.push(bodies[i].radius > 0 ? gravity * mass / bodies[i].radius * INV_C2 : 0);
  }
  for (const { i, j, n, inverse } of state.pairs) {
    const k = i * 3, l = j * 3;
    let vi2 = 0, vj2 = 0, vivj = 0, nvi = 0, nvj = 0;
    for (let axis = 0; axis < 3; axis++) {
      vi2 += velocities[k + axis] ** 2; vj2 += velocities[l + axis] ** 2;
      vivj += velocities[k + axis] * velocities[l + axis];
      nvi += n[axis] * velocities[k + axis]; nvj += n[axis] * velocities[l + axis];
    }
    const factor = gravity * bodies[i].mass * bodies[j].mass * inverse * 0.5 * INV_C2;
    energy += factor * (3 * (vi2 + vj2) - 7 * vivj - nvi * nvj);
    for (let axis = 0; axis < 3; axis++) {
      momenta[k + axis] += factor * (6 * velocities[k + axis] - 7 * velocities[l + axis] - n[axis] * nvj);
      momenta[l + axis] += factor * (6 * velocities[l + axis] - 7 * velocities[k + axis] - n[axis] * nvi);
    }
  }
  return { energy, momenta, clockRates, compactness };
}
