// JPL DE440 solar GM; exact IAU au and Julian year (365.25 days).
// A solar mass here means GM_sun / G_SI, so body.mass is a solar-GM ratio.
// Source: https://ssd.jpl.nasa.gov/astro_par.html
export const AU_METERS = 149597870700;
export const YEAR_SECONDS = 31557600;
export const GM_SUN_SI = 1.32712440041279419e20;
export const G = GM_SUN_SI * YEAR_SECONDS ** 2 / AU_METERS ** 3;

const DEFAULTS = {
  gravityScale: 1,
  softening: 0,
  dt: 0.0005,
  integrator: 'verlet',
  collisionMode: 'fragment',
  restitution: 1,
  disruptionThreshold: 1,
  fragmentCount: 6,
};

const dot = (a, b) => a.reduce((sum, x, k) => sum + x * b[k], 0);
const subtract = (a, b) => a.map((x, k) => x - b[k]);

// Roots of a low-degree polynomial on [0, 1]. Splitting at derivative roots
// catches an interior minimum even when both ends of a swept trajectory miss.
function polynomialRoots(coefficients) {
  const c = [...coefficients];
  while (c.length > 1 && c[c.length - 1] === 0) c.pop();
  if (c.length === 1) return [];
  if (c.length === 2) {
    const root = -c[0] / c[1];
    return root > 0 && root < 1 ? [root] : [];
  }
  const evaluate = x => c.reduceRight((sum, value) => sum * x + value, 0);
  const breaks = [0, ...polynomialRoots(c.slice(1).map((value, index) => value * (index + 1))), 1];
  const roots = [];
  for (let index = 0; index < breaks.length - 1; index++) {
    let left = breaks[index], right = breaks[index + 1];
    let fl = evaluate(left), fr = evaluate(right);
    if (left > 0 && fl === 0) roots.push(left);
    if (fl * fr >= 0) continue;
    for (let iteration = 0; iteration < 56; iteration++) {
      const middle = (left + right) / 2;
      const fm = evaluate(middle);
      if ((fl > 0) === (fm > 0)) { left = middle; fl = fm; }
      else { right = middle; fr = fm; }
    }
    roots.push((left + right) / 2);
  }
  return roots.sort((a, b) => a - b);
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function copyBody(body) {
  if (!(body.mass > 0) || !Number.isFinite(body.mass) || !(body.radius >= 0) || !Number.isFinite(body.radius)) {
    throw new Error('天体质量必须为有限正数，物理半径必须为有限非负数。');
  }
  return { ...body, position: [...body.position], velocity: [...body.velocity], spin: [...(body.spin ?? [0, 0, 0])] };
}

export class PhysicsEngine {
  constructor(bodies, params = {}) {
    this.bodies = bodies.map(copyBody);
    this.params = { ...DEFAULTS, ...params };
    this.time = 0;
    this.collisionCount = 0;
    this.fragmentationCount = 0;
    this.destroyedCount = 0;
    this.events = [];
    this._eventId = 0;
    this._checkState();
    this._checkParameters(this.params.dt);
    this.resetReference();
  }

  _checkParameters(dt) {
    const p = this.params;
    if (!(dt > 0) || !Number.isFinite(dt)) throw new Error('积分步长必须为有限正数。');
    if (!(p.softening >= 0) || !Number.isFinite(p.softening) || !(p.gravityScale >= 0) || !Number.isFinite(p.gravityScale)) {
      throw new Error('引力倍率和软化长度必须为有限非负数。');
    }
    if (!['verlet', 'rk4'].includes(p.integrator)) throw new Error(`未知积分器：${p.integrator}`);
    if (!['fragment', 'merge', 'elastic', 'none'].includes(p.collisionMode)) throw new Error(`未知碰撞模型：${p.collisionMode}`);
    if (!(p.restitution >= 0 && p.restitution <= 1)) throw new Error('恢复系数必须在 0 到 1 之间。');
    if (!(p.disruptionThreshold > 0) || !Number.isFinite(p.disruptionThreshold)) throw new Error('碎裂阈值必须为有限正数。');
    if (!Number.isInteger(p.fragmentCount) || p.fragmentCount < 2 || p.fragmentCount > 12) throw new Error('碎片数必须是 2 到 12 之间的整数。');
  }

  _checkState() {
    for (const body of this.bodies) {
      if (![...body.position, ...body.velocity, ...body.spin].every(Number.isFinite)) {
        throw new Error('数值积分出现非有限值；请减小步长或调整过近的初始天体。');
      }
    }
  }

  _accelerations(positions) {
    const n = this.bodies.length;
    const a = new Float64Array(n * 3);
    const mu = G * this.params.gravityScale;
    if (mu === 0) return a;
    const eps2 = this.params.softening ** 2;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const k = i * 3;
        const l = j * 3;
        const dx = positions[l] - positions[k];
        const dy = positions[l + 1] - positions[k + 1];
        const dz = positions[l + 2] - positions[k + 2];
        const d2 = dx * dx + dy * dy + dz * dz + eps2;
        // A finite harmonic core only regularizes initially overlapping spheres.
        // The matching potential is C1 at contact; all non-overlapping spheres
        // retain Newton/Plummer forces. This is not a fluid-interior model.
        const core = this.params.collisionMode === 'none' ? 0 : this.bodies[i].radius + this.bodies[j].radius;
        const distance = Math.max(Math.sqrt(d2), core);
        if (distance === 0) throw new Error('点质量引力奇点：两个天体中心重合。请移动天体或设置软化长度。');
        const factor = mu / distance ** 3;
        const fi = factor * this.bodies[j].mass;
        const fj = factor * this.bodies[i].mass;
        // Equal and opposite pair forces preserve total linear momentum.
        a[k] += fi * dx;
        a[k + 1] += fi * dy;
        a[k + 2] += fi * dz;
        a[l] -= fj * dx;
        a[l + 1] -= fj * dy;
        a[l + 2] -= fj * dz;
      }
    }
    return a;
  }

  _integrate(dt, commit = true, initialAccelerations = null) {
    const size = this.bodies.length * 3;
    const x = new Float64Array(size);
    const v = new Float64Array(size);
    this.bodies.forEach((body, i) => {
      x.set(body.position, i * 3);
      v.set(body.velocity, i * 3);
    });
    const a1 = initialAccelerations ?? this._accelerations(x);
    if (this.params.integrator === 'verlet') {
      // Kick–drift–kick velocity Verlet, symplectic for a fixed step.
      for (let k = 0; k < size; k++) {
        v[k] += 0.5 * dt * a1[k];
        x[k] += dt * v[k];
      }
      const a2 = this._accelerations(x);
      for (let k = 0; k < size; k++) v[k] += 0.5 * dt * a2[k];
    } else {
      const x2 = new Float64Array(size);
      const v2 = new Float64Array(size);
      const x3 = new Float64Array(size);
      const v3 = new Float64Array(size);
      const x4 = new Float64Array(size);
      const v4 = new Float64Array(size);
      for (let k = 0; k < size; k++) {
        x2[k] = x[k] + 0.5 * dt * v[k];
        v2[k] = v[k] + 0.5 * dt * a1[k];
      }
      const a2 = this._accelerations(x2);
      for (let k = 0; k < size; k++) {
        x3[k] = x[k] + 0.5 * dt * v2[k];
        v3[k] = v[k] + 0.5 * dt * a2[k];
      }
      const a3 = this._accelerations(x3);
      for (let k = 0; k < size; k++) {
        x4[k] = x[k] + dt * v3[k];
        v4[k] = v[k] + dt * a3[k];
      }
      const a4 = this._accelerations(x4);
      for (let k = 0; k < size; k++) {
        x[k] += dt * (v[k] + 2 * v2[k] + 2 * v3[k] + v4[k]) / 6;
        v[k] += dt * (a1[k] + 2 * a2[k] + 2 * a3[k] + a4[k]) / 6;
      }
    }
    if (!commit) return { x, v };
    this.bodies.forEach((body, i) => {
      for (let k = 0; k < 3; k++) {
        body.position[k] = x[i * 3 + k];
        body.velocity[k] = v[i * 3 + k];
      }
    });
  }

  _pairState(a, b) {
    const mass = a.mass + b.mass;
    const position = a.position.map((x, k) => (a.mass * x + b.mass * b.position[k]) / mass);
    const velocity = a.velocity.map((v, k) => (a.mass * v + b.mass * b.velocity[k]) / mass);
    const la = cross(subtract(a.position, position), subtract(a.velocity, velocity).map(v => a.mass * v));
    const lb = cross(subtract(b.position, position), subtract(b.velocity, velocity).map(v => b.mass * v));
    return { mass, position, velocity,
      spin: a.spin.map((value, k) => value + b.spin[k] + la[k] + lb[k]),
      radius: Math.cbrt(a.radius ** 3 + b.radius ** 3),
      impactSpeed: Math.hypot(...subtract(b.velocity, a.velocity)),
      dominant: a.mass >= b.mass ? a : b };
  }

  _emit(type, a, b, pair, resultIds, extra = {}) {
    this.events.push({ id: ++this._eventId, type, time: this.time,
      position: [...pair.position], radius: pair.radius,
      names: [a.name, b.name], resultIds, impactSpeed: pair.impactSpeed, ...extra });
    if (this.events.length > 32) this.events.shift();
    this.collisionCount++;
  }

  _merge(i, j, extra = {}) {
    const a = this.bodies[i], b = this.bodies[j];
    const pair = this._pairState(a, b);
    // spin is unresolved internal ANGULAR MOMENTUM, not angular velocity.
    // Its rotational/thermal energy is not part of the orbital-energy diagnostic.
    const merged = { ...pair.dominant, mass: pair.mass, radius: pair.radius,
      position: pair.position, velocity: pair.velocity, spin: pair.spin };
    delete merged.referenceOrbit;
    delete merged.orbitalElements;
    delete merged.referenceCenter;
    delete merged.referenceCenterId;
    this.bodies[i] = merged;
    this.bodies.splice(j, 1);
    this.destroyedCount++;
    this._emit('merge', a, b, pair, [merged.id], extra);
  }

  _fragment(i, j, before) {
    const a = this.bodies[i], b = this.bodies[j];
    const pair = this._pairState(a, b);
    const mu = G * this.params.gravityScale;
    const impactEnergy = 0.5 * a.mass * b.mass / pair.mass * pair.impactSpeed ** 2;
    const bindingEnergy = 0.6 * mu * pair.mass ** 2 / pair.radius;
    const disruptionEnergy = this.params.disruptionThreshold * bindingEnergy;
    const extra = { impactEnergy, disruptionEnergy };
    const star = pair.dominant.id === 'sun' || pair.dominant.kind === 'star' || pair.dominant.type === 'star';
    const stellarAccretion = star && Math.min(a.mass, b.mass) / Math.max(a.mass, b.mass) <= 0.1;
    // Gravity-rubble approximation inspired by the center-of-mass impact energy
    // in Leinhardt & Stewart (2012), https://arxiv.org/abs/1106.6084 .
    // This adjustable binding-energy threshold is NOT their calibrated Q*_RD law:
    // strength, impact-angle scaling, shock/thermal physics and SPH are unresolved.
    // Debris reaccumulates through merging; it is not subdivided indefinitely.
    if (stellarAccretion || a.isFragment || b.isFragment || impactEnergy <= disruptionEnergy) {
      this._merge(i, j, { ...extra, reason: stellarAccretion ? 'stellar-accretion' :
        a.isFragment || b.isFragment ? 'debris-reaccumulation' : 'below-disruption-threshold' });
      return;
    }
    const count = this.params.fragmentCount;
    const fragmentRadius = pair.radius / Math.cbrt(count);
    const ringRadius = fragmentRadius * 1.08 / Math.sin(Math.PI / count);
    const relative = subtract(b.velocity, a.velocity);
    const axis = relative.map(x => x / pair.impactSpeed);
    const helper = Math.abs(axis[2]) < 0.8 ? [0, 0, 1] : [0, 1, 0];
    const transverse = cross(axis, helper);
    const length = Math.hypot(...transverse);
    const basis = transverse.map(x => x / length);
    const fragments = [];
    let assignedMass = 0;
    for (let k = 0; k < count; k++) {
      const mass = k === count - 1 ? pair.mass - assignedMass : pair.mass / count;
      assignedMass += mass;
      const angle = k * 2 * Math.PI / count;
      const offset = axis.map((x, d) => ringRadius * (x * Math.cos(angle) + basis[d] * Math.sin(angle)));
      fragments.push({ id: `${pair.dominant.id}-fragment-${this._eventId + 1}-${k + 1}`,
        name: `${pair.dominant.name}·碎片${k + 1}`, color: pair.dominant.color,
        mass, radius: pair.radius * Math.cbrt(mass / pair.mass),
        position: pair.position.map((x, d) => x + offset[d]),
        velocity: [...pair.velocity], spin: pair.spin.map(x => x * mass / pair.mass),
        isFragment: true, kind: 'fragment' });
    }
    // A regular polygon guarantees finite, non-overlapping initial fragments.
    // Remove floating-point COM drift before evaluating their potential energy.
    const drift = [0, 0, 0];
    for (const f of fragments) for (let k = 0; k < 3; k++) drift[k] += f.mass * (f.position[k] - pair.position[k]) / pair.mass;
    for (const f of fragments) f.position = f.position.map((x, k) => x - drift[k]);
    const original = this.bodies;
    const others = original.filter((_, index) => index !== i && index !== j);
    if (fragments.some(f => others.some(other => Math.hypot(...subtract(f.position, other.position)) <= f.radius + other.radius))) {
      // A simultaneous, crowded multi-body impact needs a collective material
      // solver. This rubble model accretes it instead of spawning inside a body.
      this._merge(i, j, { ...extra, reason: 'crowded-contact-accretion' });
      return;
    }
    this.bodies = others.concat(fragments);
    const atRest = this._mechanics();
    const selfBinding = body => body.radius > 0 ? -0.6 * mu * body.mass ** 2 / body.radius : 0;
    const separationWork = Math.max(0, fragments.reduce((sum, f) => sum + selfBinding(f), 0) - selfBinding(a) - selfBinding(b));
    // The budget includes the potential change against ALL other bodies, plus
    // work against the unresolved uniform-sphere self-binding. Only 35% of excess
    // impact energy can become radial ejecta kinetic energy; the rest is internal
    // energy. No random explosion speed and no injected orbital mechanical energy.
    const allowed = before.energy - atRest.energy - separationWork;
    if (allowed <= 0) {
      this.bodies = original;
      this._merge(i, j, { ...extra, reason: 'insufficient-separation-energy' });
      return;
    }
    const ejectaEnergy = Math.min(0.35 * (impactEnergy - disruptionEnergy), allowed);
    const offsets = fragments.map(f => subtract(f.position, pair.position));
    const inertia = fragments.reduce((sum, f, k) => sum + f.mass * dot(offsets[k], offsets[k]), 0);
    const expansion = Math.sqrt(2 * ejectaEnergy / inertia);
    fragments.forEach((f, index) => {
      f.velocity = pair.velocity.map((v, k) => v + expansion * offsets[index][k]);
    });
    // Store round-off-sized unresolved orbital residual in spin as well.
    const actualSpin = [0, 0, 0];
    for (const f of fragments) {
      const orbital = cross(subtract(f.position, pair.position), subtract(f.velocity, pair.velocity).map(v => f.mass * v));
      for (let k = 0; k < 3; k++) actualSpin[k] += orbital[k] + f.spin[k];
    }
    for (let k = 0; k < 3; k++) fragments[count - 1].spin[k] += pair.spin[k] - actualSpin[k];
    this.fragmentationCount++;
    this.destroyedCount += 2;
    this._emit('fragment', a, b, pair, fragments.map(f => f.id), { ...extra, ejectaEnergy, separationWork, fragmentCount: count });
  }

  _bounce(a, b) {
    const pair = this._pairState(a, b);
    const delta = subtract(b.position, a.position);
    const distance = Math.hypot(...delta);
    const relative = subtract(b.velocity, a.velocity);
    const speed = Math.hypot(...relative);
    const normal = distance > 0 ? delta.map(x => x / distance) : speed > 0 ? relative.map(x => -x / speed) : [1, 0, 0];
    const normalVelocity = dot(relative, normal);
    const penetration = a.radius + b.radius - distance;
    if (normalVelocity < 0) {
      const impulse = -(1 + this.params.restitution) * normalVelocity / (1 / a.mass + 1 / b.mass);
      for (let k = 0; k < 3; k++) {
        a.velocity[k] -= impulse * normal[k] / a.mass;
        b.velocity[k] += impulse * normal[k] / b.mass;
      }
      this._emit('bounce', a, b, pair, [a.id, b.id]);
    }
    if (penetration > 0) {
      // Only user-created overlap needs projection. Real swept contacts already
      // lie on the surface. Preserve COM and transfer projection's angular
      // momentum difference to unresolved spin instead of silently losing it.
      const before = this._pairState(a, b).spin;
      const margin = (a.radius + b.radius) * 1e-12;
      for (let k = 0; k < 3; k++) {
        a.position[k] -= normal[k] * (penetration + margin) * b.mass / pair.mass;
        b.position[k] += normal[k] * (penetration + margin) * a.mass / pair.mass;
      }
      const after = this._pairState(a, b).spin;
      for (let k = 0; k < 3; k++) a.spin[k] += before[k] - after[k];
    }
  }

  _contact(i, j) {
    const before = this._mechanics();
    if (this.params.collisionMode === 'merge') this._merge(i, j);
    else if (this.params.collisionMode === 'fragment') this._fragment(i, j, before);
    else this._bounce(this.bodies[i], this.bodies[j]);
    const after = this._mechanics();
    // Signed transfer of ORBITAL mechanical energy; this is not a heat meter.
    this.dissipated += before.energy - after.energy;
    this.collisionKineticLoss += before.kinetic - after.kinetic;
  }

  _resolveCollisions() {
    if (this.params.collisionMode === 'none') return;
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        const a = this.bodies[i], b = this.bodies[j];
        const radius = a.radius + b.radius;
        const delta = subtract(b.position, a.position);
        const distance = Math.hypot(...delta);
        if (radius <= 0 || distance > radius) continue;
        if (this.params.collisionMode === 'elastic' && distance >= radius && dot(delta, subtract(b.velocity, a.velocity)) >= 0) continue;
        this._contact(i, j);
        if (this.params.collisionMode !== 'elastic') { i = -1; break; }
      }
    }
  }

  _encounterStep(dt, accelerations) {
    let result = dt;
    const mu = G * this.params.gravityScale;
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        const a = this.bodies[i], b = this.bodies[j];
        const relativePosition = subtract(b.position, a.position);
        const r = Math.hypot(...relativePosition);
        const radius = a.radius + b.radius;
        const relativeVelocity = subtract(b.velocity, a.velocity);
        const speed = Math.hypot(...relativeVelocity);
        // Resolve gravitational curvature, including near-misses that focus into
        // impacts; a chord test alone cannot do this. Small ordinary solar-system
        // steps pass through unchanged. Adaptive steps are not globally symplectic.
        if (mu > 0) {
          const fraction = radius > 0 && r < radius * 5 ? 0.004 : 0.02;
          result = Math.min(result, fraction * Math.sqrt(Math.max(r, radius, this.params.softening) ** 3 / (mu * (a.mass + b.mass))));
        }
        if (speed > 0 && dot(relativePosition, relativeVelocity) < 0) result = Math.min(result, 0.2 * Math.max(r, radius) / speed);
        if (radius > 0 && r < radius * 5) {
          const relativeAcceleration = [0, 1, 2].map(k => accelerations[3 * j + k] - accelerations[3 * i + k]);
          const curvature = Math.hypot(...relativeAcceleration);
          if (curvature > 0) result = Math.min(result, Math.sqrt(0.002 * radius / curvature));
        }
      }
    }
    return result;
  }

  _firstContact(dt, accelerations) {
    let earliest = null;
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        const a = this.bodies[i], b = this.bodies[j];
        const radius = a.radius + b.radius;
        if (radius <= 0) continue;
        const r = subtract(b.position, a.position);
        const v = subtract(b.velocity, a.velocity).map(x => x * dt);
        const acceleration = [0, 1, 2].map(k => 0.5 * dt * dt * (accelerations[3 * j + k] - accelerations[3 * i + k]));
        const initialDistance = Math.hypot(...r);
        // Exact displacement bound for the Verlet drift: distant pairs cannot
        // contact anywhere in this step and need no polynomial root search.
        if (this.params.integrator === 'verlet' && initialDistance - Math.hypot(...v) - Math.hypot(...acceleration) > radius) continue;
        // Velocity Verlet's drift trajectory is exactly this quadratic. Locate
        // EVERY interior distance extremum, then bisect the first surface entry.
        const derivative = [dot(r, v), dot(v, v) + 2 * dot(r, acceleration), 3 * dot(v, acceleration), 2 * dot(acceleration, acceleration)];
        const breaks = [0, ...polynomialRoots(derivative), 1];
        let evaluate = t => Math.hypot(...r.map((x, k) => x + v[k] * t + acceleration[k] * t * t)) - radius;
        if (this.params.integrator === 'rk4') {
          // RK4 has no Verlet drift polynomial. Use its actual integrated states
          // for root refinement and a minimum search on the bounded encounter
          // interval. The time-scale limit keeps this local path smooth; accuracy
          // remains that of a finite numerical step, not an exact N-body orbit.
          const chordMinimum = Math.min(...breaks.map(evaluate));
          const curvatureBound = Math.hypot(...acceleration) * 2;
          if (chordMinimum > curvatureBound + radius * 0.01) continue;
          evaluate = t => {
            if (t === 0) return initialDistance - radius;
            const { x } = this._integrate(t * dt, false, accelerations);
            return Math.hypot(x[3 * j] - x[3 * i], x[3 * j + 1] - x[3 * i + 1], x[3 * j + 2] - x[3 * i + 2]) - radius;
          };
          let left = 0, right = 1;
          for (let k = 0; k < 48; k++) {
            const one = left + (right - left) / 3, two = right - (right - left) / 3;
            if (evaluate(one) < evaluate(two)) right = two;
            else left = one;
          }
          breaks.splice(1, breaks.length - 2, (left + right) / 2);
        }
        for (let k = 1; k < breaks.length; k++) {
          let left = breaks[k - 1], right = breaks[k];
          if (evaluate(right) > 0) continue;
          if (evaluate(left) <= 0) {
            if (left === 0 && dot(r, v) < 0) right = 0;
            else continue;
          } else {
            for (let n = 0; n < 52; n++) {
              const middle = (left + right) / 2;
              if (evaluate(middle) > 0) left = middle;
              else right = middle;
            }
          }
          const time = right * dt;
          if (earliest === null || time < earliest.time) earliest = { i, j, time };
          break;
        }
      }
    }
    return earliest;
  }

  step(dt = this.params.dt) {
    this._checkParameters(dt);
    if (this.params.collisionMode === 'none') {
      this._integrate(dt);
      this._checkState();
      this.time += dt;
      return;
    }
    const end = this.time + dt;
    let remaining = dt;
    let substeps = 0;
    while (remaining > 0) {
      if (++substeps > 4096) throw new Error('单步中的近距离相遇过多；请减小积分步长后继续。');
      this._resolveCollisions();
      const positions = Float64Array.from(this.bodies.flatMap(b => b.position));
      const accelerations = this._accelerations(positions);
      const h = this._encounterStep(remaining, accelerations);
      const contact = this._firstContact(h, accelerations);
      const advance = contact ? contact.time : h;
      if (advance > 0) {
        if (remaining - advance === remaining) throw new Error('接触时间低于浮点分辨率；请调整天体的尺度或初始位置。');
        this._integrate(advance, true, accelerations);
        this.time += advance;
        remaining -= advance;
        this._checkState();
      }
      if (contact) this._contact(contact.i, contact.j);
      if (!contact && advance === 0) throw new Error('无法解析当前引力相遇；请调整天体尺度或初始位置。');
    }
    this.time = end;
    this._resolveCollisions();
  }

  _mechanics() {
    let mass = 0;
    let kinetic = 0;
    let potential = 0;
    let suggestedDt = Infinity;
    const momentum = [0, 0, 0];
    const angularMomentum = [0, 0, 0];
    const com = [0, 0, 0];
    const mu = G * this.params.gravityScale;
    const eps2 = this.params.softening ** 2;
    for (let i = 0; i < this.bodies.length; i++) {
      const a = this.bodies[i];
      mass += a.mass;
      const p = a.velocity.map(v => a.mass * v);
      const l = cross(a.position, p);
      kinetic += 0.5 * a.mass * a.velocity.reduce((sum, v) => sum + v * v, 0);
      for (let k = 0; k < 3; k++) {
        momentum[k] += p[k];
        angularMomentum[k] += l[k] + a.spin[k];
        com[k] += a.mass * a.position[k];
      }
      for (let j = i + 1; j < this.bodies.length; j++) {
        const b = this.bodies[j];
        const r = Math.hypot(...a.position.map((x, k) => x - b.position[k]));
        const softenedDistance = Math.sqrt(r * r + eps2);
        if (mu > 0) {
          const core = this.params.collisionMode === 'none' ? 0 : a.radius + b.radius;
          if (Math.max(softenedDistance, core) === 0) throw new Error('点质量引力奇点：两个天体中心重合。请移动天体或设置软化长度。');
          potential -= mu * a.mass * b.mass * (softenedDistance < core
            ? (3 - softenedDistance ** 2 / core ** 2) / (2 * core) : 1 / softenedDistance);
          suggestedDt = Math.min(suggestedDt, 0.03 * Math.sqrt(Math.max(softenedDistance, core) ** 3 / (mu * (a.mass + b.mass))));
        }
        const relativeSpeed = Math.hypot(...a.velocity.map((v, k) => v - b.velocity[k]));
        if (relativeSpeed > 0) {
          const radius = this.params.collisionMode === 'none' ? 0 : a.radius + b.radius;
          const scale = Math.max(r - radius, radius * 0.1, this.params.softening);
          suggestedDt = Math.min(suggestedDt, 0.05 * scale / relativeSpeed);
        }
      }
    }
    if (mass > 0) for (let k = 0; k < 3; k++) com[k] /= mass;
    const comVelocity = momentum.map(p => mass > 0 ? p / mass : 0);
    return { mass, kinetic, potential, energy: kinetic + potential, momentum, angularMomentum, com, comVelocity, suggestedDt };
  }

  resetReference() {
    const d = this._mechanics();
    this.referenceEnergy = d.energy;
    this.referenceEnergyScale = Math.abs(d.energy) || (d.kinetic + Math.abs(d.potential)) || 1;
    this.dissipated = 0;
    this.collisionKineticLoss = 0;
  }

  diagnostics() {
    const d = this._mechanics();
    return {
      ...d,
      energyError: (d.energy - this.referenceEnergy) / this.referenceEnergyScale,
      correctedEnergyError: (d.energy + this.dissipated - this.referenceEnergy) / this.referenceEnergyScale,
      dissipated: this.dissipated,
      collisionKineticLoss: this.collisionKineticLoss,
    };
  }
}
