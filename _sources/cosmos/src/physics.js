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
  collisionMode: 'merge',
  restitution: 1,
};

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
    if (!['merge', 'elastic', 'none'].includes(p.collisionMode)) throw new Error(`未知碰撞模型：${p.collisionMode}`);
    if (!(p.restitution >= 0 && p.restitution <= 1)) throw new Error('恢复系数必须在 0 到 1 之间。');
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
        if (d2 === 0) throw new Error('点质量引力奇点：两个天体中心重合。请移动天体或设置软化长度。');
        const factor = mu / (d2 * Math.sqrt(d2));
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

  _integrate(dt) {
    const size = this.bodies.length * 3;
    const x = new Float64Array(size);
    const v = new Float64Array(size);
    this.bodies.forEach((body, i) => {
      x.set(body.position, i * 3);
      v.set(body.velocity, i * 3);
    });
    const a1 = this._accelerations(x);
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
    this.bodies.forEach((body, i) => {
      for (let k = 0; k < 3; k++) {
        body.position[k] = x[i * 3 + k];
        body.velocity[k] = v[i * 3 + k];
      }
    });
  }

  _merge(i, j) {
    const a = this.bodies[i];
    const b = this.bodies[j];
    const mass = a.mass + b.mass;
    const position = a.position.map((x, k) => (a.mass * x + b.mass * b.position[k]) / mass);
    const velocity = a.velocity.map((v, k) => (a.mass * v + b.mass * b.velocity[k]) / mass);
    const la = cross(a.position.map((x, k) => x - position[k]), a.velocity.map((v, k) => a.mass * (v - velocity[k])));
    const lb = cross(b.position.map((x, k) => x - position[k]), b.velocity.map((v, k) => b.mass * (v - velocity[k])));
    const dominant = a.mass >= b.mass ? a : b;
    // Internal spin stores unresolved angular momentum; it is not angular velocity.
    const merged = {
      ...dominant,
      mass,
      radius: Math.cbrt(a.radius ** 3 + b.radius ** 3),
      position,
      velocity,
      spin: a.spin.map((s, k) => s + b.spin[k] + la[k] + lb[k]),
    };
    this.bodies[i] = merged;
    this.bodies.splice(j, 1);
    this.collisionCount++;
  }

  _bounce(a, b, distance, radius, delta) {
    const relativeVelocity = b.velocity.map((v, k) => v - a.velocity[k]);
    const speed = Math.hypot(...relativeVelocity);
    let rewind = 0;
    let contact = delta;
    if (distance < radius && speed > 0) {
      // Rewind linear relative motion to contact, then advance with the reflected velocity.
      // Unlike radial projection, this mass-weighted correction also preserves angular momentum.
      const rv = delta.reduce((sum, x, k) => sum + x * relativeVelocity[k], 0);
      const speed2 = speed * speed;
      rewind = (rv + Math.sqrt(rv * rv + speed2 * (radius * radius - distance * distance))) / speed2;
      contact = delta.map((x, k) => x - relativeVelocity[k] * rewind);
    }
    const contactDistance = Math.hypot(...contact);
    const normal = contactDistance > 0 ? contact.map(x => x / contactDistance) : [1, 0, 0];
    const normalVelocity = relativeVelocity.reduce((sum, v, k) => sum + v * normal[k], 0);
    if (normalVelocity < 0) {
      const impulse = -(1 + this.params.restitution) * normalVelocity / (1 / a.mass + 1 / b.mass);
      for (let k = 0; k < 3; k++) {
        const dva = -impulse * normal[k] / a.mass;
        const dvb = impulse * normal[k] / b.mass;
        a.velocity[k] += dva;
        b.velocity[k] += dvb;
        a.position[k] += dva * rewind;
        b.position[k] += dvb * rewind;
      }
      this.collisionCount++;
    }
    if (speed === 0 && distance < radius) {
      // Static overlap has no relative angular momentum; radial correction is sufficient.
      const overlap = radius - distance;
      const mass = a.mass + b.mass;
      for (let k = 0; k < 3; k++) {
        a.position[k] -= normal[k] * overlap * b.mass / mass;
        b.position[k] += normal[k] * overlap * a.mass / mass;
      }
    }
  }

  _resolveCollisions() {
    if (this.params.collisionMode === 'none') return;
    let before = null;
    // Restart the pair scan after merging because the merged radius and COM change.
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        const a = this.bodies[i];
        const b = this.bodies[j];
        const radius = a.radius + b.radius;
        const delta = b.position.map((x, k) => x - a.position[k]);
        const distance = Math.hypot(...delta);
        if (radius <= 0 || distance > radius) continue;
        if (before === null) before = this._mechanics();
        if (this.params.collisionMode === 'merge') {
          this._merge(i, j);
          i = -1;
          break;
        }
        this._bounce(a, b, distance, radius, delta);
      }
    }
    if (before !== null) {
      const after = this._mechanics();
      // Signed mechanical-energy transfer includes removed pair potential and projection work.
      this.dissipated += before.energy - after.energy;
      this.collisionKineticLoss += before.kinetic - after.kinetic;
    }
  }

  step(dt = this.params.dt) {
    this._checkParameters(dt);
    this._resolveCollisions();
    this._integrate(dt);
    this._checkState();
    this._resolveCollisions();
    this.time += dt;
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
          if (softenedDistance === 0) throw new Error('点质量引力奇点：两个天体中心重合。请移动天体或设置软化长度。');
          potential -= mu * a.mass * b.mass / softenedDistance;
          suggestedDt = Math.min(suggestedDt, 0.03 * Math.sqrt(softenedDistance ** 3 / (mu * (a.mass + b.mass))));
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
