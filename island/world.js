import * as THREE from './vendor/three.module.js';

export function createWorld(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b6d7d1');
  scene.fog = new THREE.Fog('#b6d7d1', 170, 1000);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 700 ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const camera = new THREE.PerspectiveCamera(60, 1, 0.2, 1500);
  const player = new THREE.Group();
  scene.add(player);
  const spawn = { x: 0, z: 180, yaw: Math.PI };
  const waterLevel = 0;
  const boatSpawn = { x: 335, z: -140, yaw: Math.PI / 2 };
  const bounds = { minX: -430, maxX: 430, minZ: -340, maxZ: 340 };
  const colliders = [];
  const stations = [
    { id: 'about', x: 0, z: 180, r: 12, label: '个人灯塔' },
    { id: 'products', x: -150, z: 80, r: 12, label: '产品工坊' },
    { id: 'games', x: 140, z: 70, r: 12, label: '游戏街区' },
    { id: 'delivery', x: 240, z: -120, r: 12, label: '交付码头' },
    { id: 'lab', x: -80, z: -210, r: 12, label: '实验高地' },
    { id: 'contact', x: -250, z: -110, r: 12, label: '海风营地' },
  ];
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (v) => { const t = clamp(v); return t * t * (3 - 2 * t); };
  const random = seededRandom(72853);
  function outlineRadius(angle) {
    const bayAngle = Math.atan2(Math.sin(angle + 0.48), Math.cos(angle + 0.48));
    return 1 + Math.sin(angle * 3 + 0.4) * 0.035 + Math.cos(angle * 7) * 0.024 - Math.exp(-bayAngle * bayAngle / 0.085) * 0.16;
  }
  function coastDistance(x, z) { return Math.hypot(x / 400, z / 300) / outlineRadius(Math.atan2(z / 300, x / 400)); }
  function naturalHeight(x, z) {
    const q = coastDistance(x, z);
    if (q > 1) return -Math.min(24, (q - 1) * 95);
    const hill = (cx, cz, rx, rz, h) => h * Math.exp(-(((x - cx) / rx) ** 2) - ((z - cz) / rz) ** 2);
    const rolling = Math.sin(x * 0.018 + z * 0.011) * 2.6 + Math.cos(z * 0.027 - x * 0.008) * 1.7;
    const h = 5.5 + rolling + hill(-40, -55, 105, 105, 44) + hill(110, -175, 107, 90, 58) + hill(-220, -70, 105, 105, 31) + hill(165, 95, 125, 90, 16) + hill(-50, 175, 140, 85, 15);
    return Math.max(0, h) * smooth((1 - q) / 0.17);
  }
  const stationHeights = stations.map((s, i) => i === 0 ? 18 : i === 3 ? 4.5 : naturalHeight(s.x, s.z));
  function groundHeight(x, z) {
    let h = naturalHeight(x, z);
    if (coastDistance(x, z) > 1) return h;
    for (let i = 0; i < stations.length; i++) {
      const s = stations[i], d = Math.hypot(x - s.x, z - s.z), outer = s.id === 'delivery' ? 110 : 54;
      if (d < outer) h += (stationHeights[i] - h) * (1 - smooth((d - 28) / (outer - 28)));
    }
    return h;
  }
  function isWalkable(x, z) {
    if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ || coastDistance(x, z) > 0.996 || groundHeight(x, z) < 0.3) return false;
    const dx = (groundHeight(x + 1.5, z) - groundHeight(x - 1.5, z)) / 3;
    const dz = (groundHeight(x, z + 1.5) - groundHeight(x, z - 1.5)) / 3;
    return dx * dx + dz * dz < 1.1;
  }
  const mapOutline = Array.from({ length: 100 }, (_, i) => {
    const angle = i / 100 * Math.PI * 2, r = outlineRadius(angle);
    return [Math.cos(angle) * 400 * r, Math.sin(angle) * 300 * r];
  });
  scene.add(new THREE.HemisphereLight('#d8edf3', '#9a9976', 1.9));
  const sun = new THREE.DirectionalLight('#fff0cf', 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -66, right: 66, top: 66, bottom: -66, near: 1, far: 250 });
  sun.shadow.normalBias = 0.085; sun.shadow.bias = -0.00015;
  scene.add(sun, sun.target);
  const g = {
    box: new THREE.BoxGeometry(1, 1, 1), cylinder: new THREE.CylinderGeometry(1, 1, 1, 10),
    cone: new THREE.ConeGeometry(1, 1, 9), sphere: new THREE.IcosahedronGeometry(1, 1),
    rock: new THREE.IcosahedronGeometry(1, 0), roof: gableGeometry(), disc: new THREE.CylinderGeometry(1, 1, 1, 32),
  };
  const material = (color, extras = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.93, ...extras });
  const m = {
    cream: material('#eadfc4'), white: material('#f4ead4'), coral: material('#bc624a'), orange: material('#da8d39'),
    yellow: material('#e8ae2c'), blue: material('#517f88'), blueLight: material('#7eadae'), mint: material('#8ca48a'),
    dark: material('#293f41'), window: material('#345c68', { roughness: 0.3 }), stone: material('#929b86'),
    wood: material('#93714f'), woodLight: material('#b99a6b'), trunk: material('#6c624c'), pine: material('#587454'),
    pineLight: material('#70865b'), foliage: material('#748f62'), shrub: material('#839465'), road: material('#c4b898'),
    roadEdge: material('#abac82'), rock: material('#8e9382'), light: material('#e7c971', { emissive: '#dfa73f', emissiveIntensity: 0.3 }),
  };
  function mesh(geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, parent = scene) {
    const object = new THREE.Mesh(geo, mat); object.position.set(x, y, z); object.scale.set(sx, sy, sz);
    object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  const box = (mat, x, y, z, sx, sy, sz, parent) => mesh(g.box, mat, x, y, z, sx, sy, sz, parent);
  const column = (mat, x, y, z, radius, height, parent) => mesh(g.cylinder, mat, x, y, z, radius, height, radius, parent);
  function group(x, z, angle = 0, y = groundHeight(x, z)) {
    const object = new THREE.Group(); object.position.set(x, y, z); object.rotation.y = angle; scene.add(object); return object;
  }
  function link(mat, a, b, radius, parent = scene) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const object = column(mat, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, radius, start.distanceTo(end), parent);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize()); return object;
  }
  function sign(text, x, y, z, width, height, parent = scene, background = '#314c48') {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
    const ctx = c.getContext('2d'); ctx.fillStyle = background; ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = '#f4e9ce'; ctx.font = '700 103px Arial, "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 132, 955);
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false }));
    face.position.set(x, y, z); parent.add(face); box(m.wood, x, y, z - 0.12, width + 0.18, height + 0.18, 0.2, parent);
    return face;
  }
  const terrainGeo = new THREE.PlaneGeometry(860, 680, 180, 150);
  terrainGeo.rotateX(-Math.PI / 2);
  const positions = terrainGeo.attributes.position, colors = [];
  const sandColor = new THREE.Color('#d0bf98'), lowColor = new THREE.Color('#8eaa74'), highColor = new THREE.Color('#849477'), vertexColor = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i), h = groundHeight(x, z); positions.setY(i, h);
    const q = coastDistance(x, z), variation = Math.sin(x * 0.075 + z * 0.052) * Math.cos(z * 0.043 - x * 0.013) * 0.018;
    vertexColor.copy(lowColor).lerp(highColor, clamp((h - 18) / 55)).lerp(sandColor, smooth((q - 0.91) / 0.065)).offsetHSL(0, 0, variation);
    colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
  }
  terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); terrainGeo.computeVertexNormals();
  const terrain = mesh(terrainGeo, material('#ffffff', { vertexColors: true, flatShading: true }), 0, 0, 0); terrain.castShadow = false;
  const waterGeometry = new THREE.PlaneGeometry(6000, 6000); waterGeometry.rotateX(-Math.PI / 2);
  const water = mesh(waterGeometry, new THREE.MeshBasicMaterial({ color: '#79b8ae', toneMapped: false }), 0, waterLevel, 0);
  water.castShadow = false; water.receiveShadow = false;
  const mapPaths = [
    [[0, 180], [-8, 150], [-48, 125], [-100, 108], [-150, 80]],
    [[0, 180], [47, 160], [100, 123], [140, 70]],
    [[-150, 80], [-205, 50], [-256, 4], [-269, -56], [-250, -110]],
    [[-250, -110], [-220, -159], [-160, -190], [-80, -210]],
    [[-80, -210], [-15, -225], [64, -238], [143, -205], [198, -161], [240, -120]],
    [[240, -120], [237, -66], [209, -12], [173, 23], [140, 70]],
    [[-150, 80], [-105, 47], [-67, 9], [-28, -6], [38, 7], [93, 39], [140, 70]],
    [[-67, 9], [-97, -47], [-118, -106], [-109, -166], [-80, -210]],
  ];
  const roadPoints = [];
  function road(path, width, mat, lift) {
    const curve = new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.2);
    const steps = Math.ceil(curve.getLength() / 2), vertices = [], indices = [];
    for (let i = 0; i <= steps; i++) {
      const p = curve.getPoint(i / steps), t = curve.getTangent(i / steps), nx = -t.z * width / 2, nz = t.x * width / 2;
      const ax = p.x + nx, az = p.z + nz, bx = p.x - nx, bz = p.z - nz;
      vertices.push(ax, groundHeight(ax, az) + lift, az, bx, groundHeight(bx, bz) + lift, bz);
      if (i < steps) { const k = i * 2; indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      if (width < 9 && i % 2 === 0) roadPoints.push({ x: p.x, z: p.z });
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.setIndex(indices); geo.computeVertexNormals();
    mesh(geo, mat, 0, 0, 0).castShadow = false;
  }
  for (const path of mapPaths) { road(path, 10.6, m.roadEdge, 0.1); road(path, 8.5, m.road, 0.15); }
  const clearOfRoad = (x, z, distance) => roadPoints.every(p => (p.x - x) ** 2 + (p.z - z) ** 2 > distance * distance);
  for (const s of stations) {
    const h = groundHeight(s.x, s.z); mesh(g.disc, m.road, s.x, h + 0.035, s.z, 18, 0.05, 18).castShadow = false;
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.7, 3.0, 48), m.cream); ring.rotation.x = -Math.PI / 2; ring.position.set(s.x, h + 0.12, s.z); scene.add(ring);
  }
  function cottage(x, z, angle, wall = m.cream, roof = m.coral, scale = 1) {
    const house = group(x, z, angle);
    box(m.stone, 0, 0.25, 0, 10.2 * scale, 0.5, 8.4 * scale, house);
    box(wall, 0, 2.9 * scale, 0, 9.4 * scale, 5.3 * scale, 7.5 * scale, house);
    mesh(g.roof, roof, 0, 5.55 * scale, 0, 10.4 * scale, 5.2 * scale, 8.6 * scale, house);
    box(m.dark, 0, 1.8 * scale, 3.78 * scale, 1.65 * scale, 3.3 * scale, 0.12, house);
    box(m.wood, 0, 1.78 * scale, 3.87 * scale, 1.4 * scale, 3.1 * scale, 0.08, house);
    for (const xw of [-3, 3]) {
      box(m.white, xw * scale, 3 * scale, 3.81 * scale, 1.85 * scale, 1.82 * scale, 0.17, house);
      box(m.window, xw * scale, 3 * scale, 3.92 * scale, 1.55 * scale, 1.53 * scale, 0.05, house);
      box(m.white, xw * scale, 3 * scale, 3.97 * scale, 0.08, 1.6 * scale, 0.035, house);
    }
    box(m.stone, 3.1 * scale, 7.45 * scale, -1.8 * scale, 1, 3 * scale, 1.1, house);
    colliders.push({ x, z, r: 5.5 * scale }); return house;
  }
  function picnic(x, z, angle = 0) {
    const table = group(x, z, angle); box(m.woodLight, 0, 1.05, 0, 3.1, 0.2, 1.6, table);
    for (const xx of [-1.08, 1.08]) box(m.wood, xx, 0.5, 0, 0.2, 1, 2.4, table);
    for (const zz of [-1.18, 1.18]) box(m.woodLight, 0, 0.59, zz, 3.3, 0.16, 0.44, table);
  }
  function notice(x, z, angle, text) {
    const board = group(x, z, angle);
    for (const xx of [-1.9, 1.9]) column(m.wood, xx, 1.85, 0, 0.13, 3.7, board);
    sign(text, 0, 3, 0.16, 4, 1.2, board); mesh(g.roof, m.coral, 0, 3.9, 0, 4.7, 0.75, 1.65, board);
  }
  const lighthouse = group(23, 160);
  column(m.stone, 0, 0.7, 0, 5.2, 1.4, lighthouse);
  mesh(new THREE.CylinderGeometry(2.1, 3.7, 24, 20), m.white, 0, 13, 0, 1, 1, 1, lighthouse);
  mesh(new THREE.CylinderGeometry(2.93, 3.28, 5.2, 20), m.coral, 0, 9, 0, 1, 1, 1, lighthouse);
  mesh(new THREE.CylinderGeometry(2.3, 2.62, 4.8, 20), m.coral, 0, 19.5, 0, 1, 1, 1, lighthouse);
  column(m.dark, 0, 25.2, 0, 4, 0.65, lighthouse); column(m.cream, 0, 25.65, 0, 3.7, 0.3, lighthouse); column(m.light, 0, 28, 0, 1.6, 3.7, lighthouse);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; column(m.dark, Math.cos(a) * 2.5, 28, Math.sin(a) * 2.5, 0.13, 4.5, lighthouse); }
  column(m.dark, 0, 30.3, 0, 3.2, 0.35, lighthouse); mesh(g.cone, m.coral, 0, 32, 0, 4, 3.3, 4, lighthouse); column(m.dark, 0, 34.3, 0, 0.09, 1.4, lighthouse);
  box(m.dark, 0, 2.4, 3.6, 1.9, 4.2, 0.14, lighthouse); box(m.yellow, 0, 2.4, 3.72, 1.5, 3.8, 0.1, lighthouse);
  for (const yy of [8.9, 16.4, 22.2]) box(m.window, 0, yy, 3.2 - yy * 0.038, 0.85, 1.65, 0.13, lighthouse);
  colliders.push({ x: 23, z: 160, r: 4.9 });
  cottage(-23, 167, 0.28, m.cream, m.coral, 0.92); cottage(-24, 193, 0.95, m.mint, m.blue, 0.8); cottage(22, 198, -0.7, m.white, m.coral, 0.72);
  picnic(13, 188, -0.3); notice(-8.5, 169, 0, '山谷 ← 工坊 / 实验室'); notice(9, 181, -0.55, '欢迎来到默绘的小岛');
  stations[0].labelY = lighthouse.position.y + 35;
  const workshop = cottage(-168, 61, 0.5, m.cream, m.coral, 1.3);
  sign('MAKE / 产品工坊', 0, 5.85, 5.1, 9.3, 1.3, workshop); box(m.dark, 0, 2.5, 5.1, 5.3, 4.8, 0.18, workshop); box(m.yellow, 0, 3.85, 5.25, 5.1, 1.9, 0.1, workshop);
  for (let i = 0; i < 4; i++) box(m.wood, 0, 3.1 + i * 0.44, 5.31, 5.1, 0.07, 0.02, workshop);
  cottage(-128, 78, -0.4, m.mint, m.blue, 1); cottage(-174, 98, 1.7, m.white, m.blue, 0.85); cottage(-128, 99, -1.1, m.cream, m.coral, 0.77);
  const tower = group(-185, 66);
  for (const xx of [-2.2, 2.2]) for (const zz of [-2.2, 2.2]) box(m.wood, xx, 5.5, zz, 0.3, 11, 0.3, tower);
  column(m.blue, 0, 12.4, 0, 3.4, 4.1, tower); mesh(g.cone, m.dark, 0, 15.2, 0, 3.65, 1.55, 3.65, tower);
  picnic(-160, 91, 0.5); picnic(-139, 67, -0.7); notice(-142, 92, -0.7, 'BUILD SOMETHING'); stations[1].labelY = workshop.position.y + 15;
  const arcade = cottage(165, 62, -0.4, m.mint, m.blue, 1.35);
  sign('PLAY / 游戏街区', 0, 7, 5.93, 10, 1.7, arcade, '#a65c46');
  for (let i = 0; i < 5; i++) box(i % 2 ? m.white : m.coral, -4.2 + i * 2.1, 5.35, 6, 2, 0.6, 1.9, arcade);
  cottage(120, 48, 0.55, m.cream, m.coral, 1); cottage(165, 86, -1, m.white, m.coral, 0.85); cottage(117, 89, 1, m.mint, m.blue, 0.8);
  const sculpture = group(156, 92);
  for (let i = 0; i < 5; i++) box([m.coral, m.blue, m.yellow][i % 3], Math.sin(i * 1.1) * 0.9, 1.5 + i * 2.4, 0, 3.8 - i * 0.3, 2.7, 3.2 - i * 0.2, sculpture).rotation.y = i * 0.35;
  for (const xx of [-4, 4]) {
    box(m.coral, xx, 1.8, 7.2, 1.65, 3.3, 1.6, arcade); box(m.dark, xx, 2.4, 8.04, 1.34, 1.2, 0.06, arcade); box(m.blueLight, xx, 2.43, 8.08, 1.02, 0.89, 0.04, arcade); box(m.dark, xx, 1.3, 8.2, 1.7, 0.2, 0.6, arcade);
  }
  notice(130, 82, 0.3, 'PRESS PLAY'); picnic(151, 76); colliders.push({ x: 156, z: 92, r: 3 }); stations[2].labelY = arcade.position.y + 16;
  const port = cottage(249, -101, Math.PI * 0.7, m.cream, m.blue, 1);
  sign('PORT / 交付码头', 0, 5.8, 4.45, 7.8, 1.2, port);
  cottage(256, -142, -0.8, m.mint, m.blue, 0.95); cottage(219, -127, 0.4, m.cream, m.coral, 0.8); cottage(215, -104, 1.6, m.white, m.coral, 0.72);
  const pier = group(284, -121, 0, 3.2); box(m.wood, 0, -0.3, 0, 64, 0.65, 7, pier);
  for (let i = 0; i < 47; i++) box(m.woodLight, -31 + i * 1.34, 0.08, 0, 1.25, 0.17, 6.85, pier);
  for (let i = 0; i < 9; i++) for (const zz of [-3.2, 3.2]) { column(m.wood, -30 + i * 7.5, -2.4, zz, 0.26, 8, pier); column(m.white, -30 + i * 7.5, 1.67, zz, 0.3, 0.25, pier); }
  const shelter = group(306, -121, 0, 3.3);
  for (const xx of [-3, 3]) for (const zz of [-2.8, 2.8]) column(m.white, xx, 2.75, zz, 0.19, 5.5, shelter);
  mesh(g.roof, m.blue, 0, 5.5, 0, 7.5, 3.1, 7.5, shelter);
  for (let i = 0; i < 7; i++) { const px = 263 + i % 3 * 2, pz = -114 + Math.floor(i / 3) * 2; box(i % 2 ? m.woodLight : m.coral, px, groundHeight(px, pz) + 1, pz, 1.6, 2, 1.7); }
  notice(251, -128, Math.PI * 0.3, '海岸 / BOAT HOUSE'); stations[3].labelY = port.position.y + 13;
  const observatory = group(-94, -231, -0.4);
  column(m.stone, 0, 0.7, 0, 9.7, 1.4, observatory); column(m.white, 0, 5.6, 0, 7.6, 9.9, observatory); column(m.blue, 0, 10.7, 0, 8.3, 0.8, observatory);
  const dome = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2); mesh(dome, m.blueLight, 0, 11.1, 0, 8.1, 7.4, 8.1, observatory);
  const slit = new THREE.SphereGeometry(1, 3, 14, Math.PI * 0.39, Math.PI * 0.15, 0, Math.PI / 2); mesh(slit, m.dark, 0, 11.11, 0, 8.14, 7.44, 8.14, observatory);
  link(m.yellow, [0.6, 13.8, 4.8], [1.3, 20, 11.4], 1.12, observatory); link(m.dark, [1.3, 20, 11.4], [1.39, 20.8, 12.3], 1.4, observatory); link(m.window, [1.39, 20.8, 12.3], [1.41, 20.96, 12.48], 1.13, observatory);
  box(m.dark, 0, 3, 7.6, 2.9, 5.1, 0.2, observatory); box(m.yellow, 0, 3, 7.76, 2.45, 4.7, 0.1, observatory);
  for (const xx of [-4.7, 4.7]) box(m.window, xx, 5.7, 6.1, 1.5, 2.4, 0.15, observatory);
  cottage(-59, -230, -0.4, m.white, m.blue, 1); cottage(-58, -208, 2.4, m.cream, m.coral, 0.9); cottage(-58, -191, -2.3, m.mint, m.blue, 0.8);
  notice(-70, -218, 0, 'KEEP EXPLORING'); colliders.push({ x: -94, z: -231, r: 9.2 }); stations[4].labelY = observatory.position.y + 24;
  for (const [x, z, angle, color, scale] of [[-269, -127, 0.45, m.orange, 1], [-225, -116, -0.4, m.blue, 0.85], [-274, -95, 1.6, m.cream, 0.75], [-232, -92, -1.8, m.coral, 0.78]]) {
    const tent = group(x, z, angle); mesh(g.roof, color, 0, 0.03, 0, 8 * scale, 7.5 * scale, 9 * scale, tent);
    const entrance = new THREE.BufferGeometry(); entrance.setAttribute('position', new THREE.Float32BufferAttribute([-1.5, 0.04, 0, 1.5, 0.04, 0, 0, 3.35, 0], 3)); entrance.computeVertexNormals();
    mesh(entrance, m.dark, 0, 0, 4.51 * scale, scale, scale, scale, tent); link(m.wood, [0, 0, 4.55 * scale], [0, 5.4 * scale, 4.55 * scale], 0.08, tent); colliders.push({ x, z, r: 4.7 * scale });
  }
  cottage(-280, -116, 1.5, m.mint, m.blue, 0.8);
  const fire = group(-253, -124);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; mesh(g.rock, m.stone, Math.cos(a) * 1.8, 0.2, Math.sin(a) * 1.8, 0.55, 0.38, 0.5, fire); }
  const ember = mesh(g.cone, m.light, 0, 0.8, 0, 0.75, 1.6, 0.75, fire);
  picnic(-258, -100, 0.4); picnic(-238, -113, -0.8); notice(-260, -117, 0.6, 'SLOW DOWN / 海风营地');
  const mast = group(-277, -143);
  for (const xx of [-1.2, 1.2]) link(m.wood, [xx * 1.6, 0, 0], [xx * 0.4, 25, 0], 0.16, mast);
  for (let i = 0; i < 8; i++) box(m.wood, 0, 2.8 + i * 2.9, 0, 3.2 - i * 0.26, 0.14, 0.15, mast);
  column(m.dark, 0, 26.6, 0, 0.09, 4, mast); const flag = box(m.orange, 1.25, 27.7, 0, 2.4, 1.15, 0.07, mast); stations[5].labelY = groundHeight(-250, -110) + 14;
  const trunkMatrices = [], pineMatrices = [], pineTopMatrices = [], roundMatrices = [], shrubMatrices = [], rockMatrices = [], grassMatrices = [];
  const dummy = new THREE.Object3D();
  function matrix(list, x, y, z, sx, sy, sz, angle = 0) {
    dummy.position.set(x, y, z); dummy.rotation.set(0, angle, 0); dummy.scale.set(sx, sy, sz); dummy.updateMatrix(); list.push(dummy.matrix.clone());
  }
  const inClearing = (x, z, margin) => stations.some(s => (s.x - x) ** 2 + (s.z - z) ** 2 < margin * margin);
  for (let i = 0; i < 3900; i++) {
    const x = (random() * 2 - 1) * 391, z = (random() * 2 - 1) * 291, q = coastDistance(x, z), h = groundHeight(x, z);
    if (q > 0.945 || h < 2.5 || inClearing(x, z, 39) || !clearOfRoad(x, z, 7.5)) continue;
    const grove = Math.sin(x * 0.037) + Math.cos(z * 0.029) + Math.sin((x + z) * 0.017);
    if (grove < -0.75 && random() < 0.7) continue;
    const height = 6.5 + random() * 8, radius = 2 + random() * 1.8, angle = random() * 6.28;
    matrix(trunkMatrices, x, h + height * 0.28, z, 0.23 + height * 0.023, height * 0.56, 0.23 + height * 0.023);
    if (random() < 0.72) { matrix(pineMatrices, x, h + height * 0.59, z, radius, height * 0.67, radius, angle); matrix(pineTopMatrices, x, h + height * 0.81, z, radius * 0.73, height * 0.54, radius * 0.73, angle + 0.35); }
    else matrix(roundMatrices, x, h + height * 0.7, z, radius * 1.15, height * 0.38, radius * 1.04, angle);
    colliders.push({ x, z, r: 0.55 + height * 0.017 });
  }
  for (let i = 0; i < 1700; i++) {
    const x = (random() * 2 - 1) * 402, z = (random() * 2 - 1) * 298, q = coastDistance(x, z), h = groundHeight(x, z);
    if (q > 1.012 || h < -1 || inClearing(x, z, 33) || !clearOfRoad(x, z, 6.5)) continue;
    const size = 0.5 + random() * 2.9;
    if (i % 3 === 0 || q > 0.95) { matrix(rockMatrices, x, h + size * 0.26, z, size * 1.38, size * 0.75, size, random() * 6.28); if (size > 1.5) colliders.push({ x, z, r: size * 1.03 }); }
    else matrix(shrubMatrices, x, h + size * 0.28, z, size, size * 0.58, size * 0.83, random() * 6.28);
  }
  for (let i = 0; i < 2500; i++) {
    const x = (random() * 2 - 1) * 375, z = (random() * 2 - 1) * 275;
    if (coastDistance(x, z) > 0.94 || inClearing(x, z, 25) || !clearOfRoad(x, z, 5.4)) continue;
    matrix(grassMatrices, x, groundHeight(x, z) + 0.22, z, 0.22, 0.65 + random() * 0.6, 0.22, random() * 6.28);
  }
  function instances(geo, mat, list, shadows = true) {
    const object = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((value, i) => object.setMatrixAt(i, value)); object.castShadow = shadows; object.receiveShadow = true; scene.add(object); return object;
  }
  instances(g.cylinder, m.trunk, trunkMatrices); instances(g.cone, m.pine, pineMatrices); instances(g.cone, m.pineLight, pineTopMatrices); instances(g.sphere, m.foliage, roundMatrices);
  instances(g.rock, m.shrub, shrubMatrices); instances(g.rock, m.rock, rockMatrices); instances(g.cone, m.foliage, grassMatrices, false);
  const foamMatrices = [], foamMat = new THREE.MeshBasicMaterial({ color: '#c6e2d2', transparent: true, opacity: 0.5, toneMapped: false });
  for (let i = 0; i < 120; i++) {
    const angle = i / 120 * Math.PI * 2, r = outlineRadius(angle) + 0.012;
    matrix(foamMatrices, Math.cos(angle) * 400 * r, 0.04, Math.sin(angle) * 300 * r, 4 + random() * 8, 0.02, 0.5, -angle);
  }
  instances(g.box, foamMat, foamMatrices, false).receiveShadow = false;
  const distantMat = material('#849e94');
  for (const [x, z, sx, sy, sz] of [[-630, -500, 140, 58, 75], [590, -570, 190, 73, 94], [-650, 420, 170, 39, 86], [570, 410, 120, 48, 90]]) mesh(g.rock, distantMat, x, -sy * 0.24, z, sx, sy, sz).castShadow = false;
  const gullGeometry = new THREE.BufferGeometry();
  gullGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1.1, 0.12, 0.3, 0.7, 0, -0.17, 0, 0, 0, -0.7, 0, -0.17, -1.1, 0.12, 0.3], 3)); gullGeometry.computeVertexNormals();
  const gullMaterial = material('#f2ead5', { side: THREE.DoubleSide });
  const gulls = Array.from({ length: 9 }, () => mesh(gullGeometry, gullMaterial, 0, 80, 0));
  player.position.set(spawn.x, groundHeight(spawn.x, spawn.z), spawn.z); player.rotation.y = spawn.yaw;
  camera.position.set(0, player.position.y + 4.8, 191); camera.lookAt(0, player.position.y + 1.5, 170);
  function update(time, dt, speed = 0) {
    sun.position.set(player.position.x - 65, player.position.y + 100, player.position.z + 46); sun.target.position.copy(player.position); sun.target.updateMatrixWorld();
    flag.rotation.y = Math.sin(time * 0.9) * 0.1; ember.scale.y = 1.6 + Math.sin(time * 6) * 0.15;
    for (let i = 0; i < gulls.length; i++) {
      const a = time * 0.034 + i * 2.17; gulls[i].position.set(240 + Math.cos(a) * (100 + i * 9), 39 + Math.sin(a * 1.4) * 8 + i * 2, -100 + Math.sin(a) * 115); gulls[i].rotation.set(Math.sin(time * 1.4 + i) * 0.11, -a, Math.sin(time * 2.8 + i) * 0.1);
    }
  }
  function resize(width, height) {
    camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setPixelRatio(Math.min(window.devicePixelRatio, width < 700 ? 1.5 : 2)); renderer.setSize(width, height, false);
  }
  resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight); update(0, 0, 0);
  return { scene, camera, renderer, player, colliders, stations, spawn, groundHeight, isWalkable, terrain, bounds, mapPaths, mapOutline, waterLevel, boatSpawn, update, resize };
}

function seededRandom(seed) {
  return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function gableGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 0.7, 0.5, 0.5, 0, -0.5, -0.5, 0, -0.5, 0, 0.7, -0.5,
    -0.5, 0, -0.5, -0.5, 0, 0.5, 0, 0.7, 0.5, -0.5, 0, -0.5, 0, 0.7, 0.5, 0, 0.7, -0.5,
    0, 0.7, -0.5, 0, 0.7, 0.5, 0.5, 0, 0.5, 0, 0.7, -0.5, 0.5, 0, 0.5, 0.5, 0, -0.5,
  ], 3)); geometry.computeVertexNormals(); return geometry;
}
