import * as THREE from './vendor/three.module.js';

// All vehicles face local +Z. The controller owns the parent transform.
export function createVehicles(parent) {
  const paint = (color, roughness = 0.65, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const materials = {
    yellow: paint(0xf8b923), gold: paint(0xe68c13),
    teal: paint(0x188d97), mint: paint(0x64d0c3),
    coral: paint(0xee6958), cream: paint(0xffedc8),
    tire: paint(0x243537), dark: paint(0x32464a),
    window: paint(0x174c59, 0.25, 0.15),
    steel: paint(0x9eb8b3, 0.4, 0.35),
    skin: paint(0xf4b889), brown: paint(0x9a6951),
    lamp: new THREE.MeshStandardMaterial({ color: 0xfff4bf, emissive: 0xffd66b, emissiveIntensity: 0.3 }),
    red: paint(0xcd4e41), blue: paint(0x287290),
  };
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 12);
  const sphereGeometry = new THREE.SphereGeometry(1, 12, 8);

  function mesh(group, geometry, material, x, y, z, sx = 1, sy = 1, sz = 1) {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(x, y, z);
    item.scale.set(sx, sy, sz);
    item.castShadow = true;
    item.receiveShadow = true;
    group.add(item);
    return item;
  }
  const box = (g, m, x, y, z, sx, sy, sz) => mesh(g, boxGeometry, m, x, y, z, sx, sy, sz);
  const ball = (g, m, x, y, z, sx, sy = sx, sz = sx) => mesh(g, sphereGeometry, m, x, y, z, sx, sy, sz);
  const cylinder = (g, m, x, y, z, radius, height) => mesh(g, cylinderGeometry, m, x, y, z, radius, height, radius);
  function bar(group, material, from, to, radius) {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const direction = b.clone().sub(a);
    const center = a.clone().add(b).multiplyScalar(0.5);
    const item = cylinder(group, material, center.x, center.y, center.z, radius, direction.length());
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return item;
  }

  const car = new THREE.Group();
  const bike = new THREE.Group();
  const boat = new THREE.Group();
  car.name = '金黄越野车';
  bike.name = '青绿越野摩托';
  boat.name = '珊瑚红快艇';
  parent.add(car, bike, boat);

  const carWheels = [];
  const frontSteering = [];
  const bikeWheels = [];
  function wheel(group, x, y, z, radius, width, rimMaterial, wheelList) {
    const steering = new THREE.Group();
    steering.position.set(x, y, z);
    group.add(steering);
    const spinning = new THREE.Group();
    steering.add(spinning);
    const tire = cylinder(spinning, materials.tire, 0, 0, 0, radius, width);
    tire.rotation.z = Math.PI / 2;
    for (const side of [-1, 1]) {
      const rim = cylinder(spinning, rimMaterial, side * (width / 2 + 0.006), 0, 0, radius * 0.59, 0.025);
      rim.rotation.z = Math.PI / 2;
      if (x === 0 || Math.sign(x) === side) {
        const spoke = box(spinning, materials.dark, side * (width / 2 + 0.023), 0, 0, 0.027, radius * 0.17, radius * 0.83);
        spoke.rotation.x = Math.PI / 5;
      }
    }
    wheelList.push({ spinning, radius });
    return steering;
  }

  // Short-wheelbase adventure car, with a cheerful open cabin and luggage.
  box(car, materials.dark, 0, 0.53, 0, 1.5, 0.24, 2.8);
  box(car, materials.yellow, 0, 0.85, 0, 1.65, 0.48, 3.0);
  box(car, materials.yellow, 0, 1.19, 0.9, 1.6, 0.33, 1.16);
  box(car, materials.gold, 0, 1.18, -1.12, 1.6, 0.35, 0.72);
  box(car, materials.dark, 0, 0.74, 1.63, 1.82, 0.17, 0.22);
  box(car, materials.dark, 0, 0.71, -1.59, 1.78, 0.16, 0.18);
  box(car, materials.dark, 0, 1.14, 1.495, 0.79, 0.23, 0.045);
  for (const side of [-1, 1]) {
    const headlight = cylinder(car, materials.lamp, side * 0.57, 1.17, 1.515, 0.16, 0.05);
    headlight.rotation.x = Math.PI / 2;
    box(car, materials.red, side * 0.64, 1.13, -1.502, 0.2, 0.14, 0.035);
    box(car, materials.yellow, side * 0.79, 1.29, -0.29, 0.1, 0.39, 1.02);
    box(car, materials.dark, side * 0.855, 0.72, -0.18, 0.19, 0.11, 0.88);
    box(car, materials.gold, side * 0.86, 1.015, 1.0, 0.3, 0.13, 0.94);
    box(car, materials.gold, side * 0.86, 1.015, -1.04, 0.3, 0.13, 0.94);
    bar(car, materials.cream, [side * 0.74, 1.38, 0.35], [side * 0.66, 1.97, 0.17], 0.052);
    bar(car, materials.cream, [side * 0.74, 1.31, -1.0], [side * 0.66, 1.97, -0.91], 0.052);
    box(car, materials.dark, side * 0.38, 1.08, -0.4, 0.53, 0.19, 0.63);
    const seat = box(car, materials.brown, side * 0.38, 1.36, -0.67, 0.51, 0.55, 0.17);
    seat.rotation.x = -0.1;
    for (const z of [-1.04, 1.0]) {
      const mount = wheel(car, side * 0.89, 0.45, z, 0.45, 0.29, materials.cream, carWheels);
      if (z > 0) frontSteering.push(mount);
    }
  }
  const windscreen = box(car, materials.window, 0, 1.67, 0.25, 1.33, 0.48, 0.045);
  windscreen.rotation.x = -0.28;
  box(car, materials.yellow, 0, 2.02, -0.37, 1.58, 0.13, 1.32);
  box(car, materials.dark, 0, 2.13, -0.47, 1.16, 0.055, 0.75);
  box(car, materials.teal, -0.19, 2.28, -0.55, 0.61, 0.27, 0.55);
  box(car, materials.cream, -0.19, 2.28, -0.55, 0.07, 0.28, 0.56);
  const bedroll = cylinder(car, materials.coral, 0.36, 2.28, -0.47, 0.16, 0.66);
  bedroll.rotation.x = Math.PI / 2;
  box(car, materials.blue, -0.35, 1.48, -0.38, 0.34, 0.39, 0.26);
  ball(car, materials.skin, -0.35, 1.8, -0.31, 0.19);
  ball(car, materials.coral, -0.35, 1.92, -0.33, 0.205, 0.12, 0.205);
  box(car, materials.coral, -0.35, 1.89, -0.11, 0.26, 0.035, 0.19);
  bar(car, materials.skin, [-0.51, 1.57, -0.31], [-0.49, 1.45, 0.04], 0.061);
  bar(car, materials.skin, [-0.19, 1.57, -0.31], [-0.22, 1.45, 0.04], 0.061);

  // Narrow trail bike: visible forks, triangular frame, a helmeted rider.
  wheel(bike, 0, 0.43, -0.89, 0.43, 0.18, materials.cream, bikeWheels);
  const bikeFront = wheel(bike, 0, 0.43, 0.96, 0.43, 0.18, materials.cream, bikeWheels);
  bar(bike, materials.teal, [0, 0.58, -0.7], [0, 1.19, -0.29], 0.078);
  bar(bike, materials.teal, [0, 0.58, -0.7], [0, 0.64, 0.24], 0.078);
  bar(bike, materials.teal, [0, 0.64, 0.24], [0, 1.19, -0.29], 0.078);
  bar(bike, materials.teal, [0, 1.19, -0.29], [0, 1.17, 0.59], 0.075);
  for (const side of [-1, 1]) {
    bar(bike, materials.steel, [side * 0.13, 0.44, 0.96], [side * 0.13, 1.33, 0.55], 0.043);
    bar(bike, materials.dark, [side * 0.12, 0.44, -0.89], [side * 0.12, 0.71, -0.1], 0.048);
  }
  box(bike, materials.dark, 0, 0.79, -0.07, 0.38, 0.35, 0.36);
  const tank = box(bike, materials.mint, 0, 1.19, 0.21, 0.41, 0.27, 0.57);
  tank.rotation.x = -0.12;
  box(bike, materials.dark, 0, 1.27, -0.39, 0.39, 0.13, 0.7);
  const rearFender = box(bike, materials.teal, 0, 0.98, -0.95, 0.28, 0.09, 0.56);
  rearFender.rotation.x = -0.12;
  const frontFender = box(bike, materials.teal, 0, 0.98, 1.02, 0.28, 0.09, 0.63);
  frontFender.rotation.x = 0.12;
  bar(bike, materials.steel, [-0.36, 1.48, 0.45], [0.36, 1.48, 0.45], 0.045);
  bar(bike, materials.steel, [0, 1.17, 0.59], [0, 1.48, 0.45], 0.049);
  const bikeLight = cylinder(bike, materials.lamp, 0, 1.28, 0.71, 0.14, 0.1);
  bikeLight.rotation.x = Math.PI / 2;
  bar(bike, materials.steel, [0.29, 0.65, -0.04], [0.29, 0.9, -0.9], 0.079);
  const riderBody = box(bike, materials.coral, 0, 1.65, -0.17, 0.37, 0.51, 0.26);
  riderBody.rotation.x = 0.26;
  ball(bike, materials.cream, 0, 2.06, -0.04, 0.24, 0.26, 0.25);
  ball(bike, materials.window, 0, 2.075, 0.145, 0.192, 0.105, 0.11);
  for (const side of [-1, 1]) {
    bar(bike, materials.coral, [side * 0.2, 1.78, -0.09], [side * 0.3, 1.48, 0.42], 0.076);
    bar(bike, materials.blue, [side * 0.16, 1.4, -0.29], [side * 0.3, 1.01, 0.13], 0.1);
    bar(bike, materials.blue, [side * 0.3, 1.01, 0.13], [side * 0.26, 0.72, -0.12], 0.08);
    box(bike, materials.dark, side * 0.26, 0.7, -0.02, 0.17, 0.13, 0.33);
  }

  // A seven-point tapered hull: the bow is +Z and the keel sits below water.
  const outline = [[-0.85, -1.95], [0.85, -1.95], [1, 0.12], [0.73, 1.55], [0, 2.48], [-0.73, 1.55], [-1, 0.12]];
  const hullVertices = [];
  const hullIndices = [];
  for (const [x, z] of outline) hullVertices.push(x, 0.39, z);
  for (const [x, z] of outline) hullVertices.push(x * 0.68, -0.26, z * 0.89);
  for (let i = 0; i < outline.length; i++) {
    const next = (i + 1) % outline.length;
    hullIndices.push(i, next, i + 7, next, next + 7, i + 7);
  }
  hullVertices.push(0, -0.34, 0);
  for (let i = 0; i < outline.length; i++) hullIndices.push(14, i + 7, ((i + 1) % 7) + 7);
  const hullGeometry = new THREE.BufferGeometry();
  hullGeometry.setAttribute('position', new THREE.Float32BufferAttribute(hullVertices, 3));
  hullGeometry.setIndex(hullIndices);
  hullGeometry.computeVertexNormals();
  mesh(boat, hullGeometry, materials.coral, 0, 0, 0);
  const deckShape = new THREE.Shape();
  outline.forEach(([x, z], index) => index ? deckShape.lineTo(x, -z) : deckShape.moveTo(x, -z));
  deckShape.closePath();
  const deck = mesh(boat, new THREE.ShapeGeometry(deckShape), materials.cream, 0, 0.4, 0);
  deck.rotation.x = -Math.PI / 2;
  box(boat, materials.teal, 0, 0.43, -0.48, 1.43, 0.07, 1.9);
  for (const side of [-1, 1]) {
    bar(boat, materials.cream, [side * 0.84, 0.46, -1.82], [side * 0.97, 0.46, 0.07], 0.085);
    bar(boat, materials.cream, [side * 0.97, 0.46, 0.07], [side * 0.7, 0.46, 1.48], 0.075);
    bar(boat, materials.cream, [side * 0.7, 0.46, 1.48], [0, 0.46, 2.38], 0.075);
    box(boat, materials.cream, side * 0.39, 0.6, -0.76, 0.56, 0.25, 0.69);
    const seat = box(boat, materials.cream, side * 0.39, 0.89, -1.02, 0.56, 0.47, 0.16);
    seat.rotation.x = -0.13;
  }
  box(boat, materials.coral, 0, 0.66, 0.5, 1.4, 0.44, 0.47);
  const boatScreen = box(boat, materials.window, 0, 1.03, 0.48, 1.48, 0.43, 0.05);
  boatScreen.rotation.x = -0.28;
  bar(boat, materials.cream, [-0.74, 1.25, 0.42], [0.74, 1.25, 0.42], 0.032);
  box(boat, materials.coral, 0, 0.69, -1.6, 1.5, 0.35, 0.42);
  box(boat, materials.dark, 0, 0.51, -2.02, 0.4, 0.55, 0.43);
  box(boat, materials.steel, 0, -0.13, -2.02, 0.09, 0.76, 0.18);
  box(boat, materials.yellow, -0.38, 0.99, -0.63, 0.34, 0.41, 0.25);
  ball(boat, materials.skin, -0.38, 1.3, -0.57, 0.19);
  ball(boat, materials.teal, -0.38, 1.43, -0.6, 0.2, 0.1, 0.21);
  box(boat, materials.teal, -0.38, 1.4, -0.39, 0.27, 0.035, 0.17);
  bar(boat, materials.skin, [-0.54, 1.13, -0.57], [-0.53, 1.0, -0.15], 0.06);
  bar(boat, materials.skin, [-0.22, 1.13, -0.57], [-0.23, 1.0, -0.15], 0.06);
  cylinder(boat, materials.cream, 0, 0.53, 1.84, 0.085, 0.16);

  const models = { car, bike, boat };
  let lastTime;
  function setMode(mode) {
    for (const [name, model] of Object.entries(models)) model.visible = name === mode;
  }
  setMode('car');

  function update(mode, time, speed, steer) {
    const dt = lastTime === undefined ? 0 : Math.min(0.05, Math.max(0, time - lastTime));
    lastTime = time;
    const wheels = mode === 'car' ? carWheels : mode === 'bike' ? bikeWheels : [];
    for (const { spinning, radius } of wheels) spinning.rotation.x += speed * dt / radius;
    for (const front of frontSteering) front.rotation.y = steer * 0.43;
    bikeFront.rotation.y = steer * 0.35;
    const moving = Math.min(1, Math.abs(speed) / 7);
    bike.rotation.z = -steer * moving * 0.2;
    bike.position.y = Math.sin(time * 13) * moving * 0.015;
    car.rotation.z = -steer * moving * 0.025;
    car.position.y = Math.sin(time * 12) * moving * 0.012;
    boat.position.y = Math.sin(time * 1.9) * 0.045;
    boat.rotation.x = Math.sin(time * 1.6) * 0.014 - moving * 0.045;
    boat.rotation.z = -steer * moving * 0.07 + Math.sin(time * 1.3) * 0.013;
  }

  return { models, setMode, update };
}
