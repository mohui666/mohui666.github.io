import * as THREE from './vendor/three.module.js';
import { createWorld } from './world.js';
import { createVehicles } from './vehicles.js';
import { places, icons, projectsFor, islandProjects, profile } from './content.js';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#world');
const detail = $('#detail');
const guide = $('#guide');
const siteRoot = new URL('../', import.meta.url);
const safe = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url = (s) => new URL(s, siteRoot).href;
const visited = new Set();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let world, vehicleModels, nearest, vehicleMode = 'car', speed = 0, heading = Math.PI;
let keys = new Set(), touch = new THREE.Vector2(), boosting = false, braking = false;
let overview = false, previous = 0, elapsed = 0, toastUntil = 7, lastTrigger = null;
let orbitYaw = 0, orbitPitch = .33, cameraDistance = 10, lookUntil = 0;
let landscapeFog;
const center = new THREE.Vector3();
const projection = new THREE.Vector3();
const labels = new Map();
const garage = $('#garage');
const vehicleSpecs = {
  car: { name: '越野车', maxSpeed: 19, boost: 30, acceleration: 10, steering: 1.65, radius: 1.05, distance: 10 },
  bike: { name: '越野摩托', maxSpeed: 24, boost: 36, acceleration: 14, steering: 2.15, radius: .65, distance: 8 },
  boat: { name: '快艇', maxSpeed: 27, boost: 39, acceleration: 9, steering: 1.15, radius: 1.5, distance: 13 },
};

$('#destinations').innerHTML = places.map((p) => `<button class="destination" data-place="${p.id}"><svg viewBox="0 0 24 24" aria-hidden="true">${icons[p.id]}</svg><span>${p.short}</span></button>`).join('');
$('#landmarks').innerHTML = places.map((p, i) => `<button class="landmark" data-place="${p.id}" aria-label="查看${p.short}" hidden><span class="number">0${i + 1}</span>${p.short}<span aria-hidden="true">↗</span></button>`).join('');
for (const el of document.querySelectorAll('.landmark')) labels.set(el.dataset.place, el);

function projectCard(p, i) {
  const playable = !p.url.startsWith('https://github.com/');
  return `<article class="project-card"><div class="project-card-top"><h3>${safe(p.title[0])}</h3><span class="project-number">${String(i + 1).padStart(2, '0')}</span></div><p>${safe(p.description[0])}</p><span class="project-tech">${safe(p.tech)}</span><div class="project-links"><a href="${safe(url(p.url))}" target="_blank" rel="noopener noreferrer">${playable ? '打开作品' : '查看 GitHub'} ↗</a>${p.source ? `<a class="secondary" href="${safe(url(p.source))}" target="_blank" rel="noopener noreferrer">项目源码 ↗</a>` : ''}</div></article>`;
}
function visit(id) {
  visited.add(id);
  $('#journey-count').textContent = `${String(visited.size).padStart(2, '0')} / 06`;
  $('#journey-progress').style.width = `${visited.size / places.length * 100}%`;
  document.querySelectorAll(`[data-place="${id}"]`).forEach((el) => el.classList.add('visited'));
}
function releaseInput() {
  keys.clear(); touch.set(0, 0); speed = 0; boosting = false; braking = false;
  $('#sprint')?.setAttribute('aria-pressed', 'false');
  $('#joystick-knob').style.transform = '';
}
function showDialog(dialog) {
  releaseInput();
  if (!dialog.open) { lastTrigger = document.activeElement; dialog.showModal(); }
}
function openPlace(id) {
  const p = places.find((place) => place.id === id);
  visit(id);
  $('#detail-meta').textContent = `0${places.indexOf(p) + 1} / ${p.short} / ${p.en}`;
  let content = `<p class="eyebrow">${p.en}</p><h2 id="detail-title">${p.title}</h2><p class="section-note">${p.subtitle}</p>`;
  if (id === 'about') {
    content = `<p class="eyebrow">A SMALL PROFILE / 个人档案</p><div class="profile-heading"><img src="../images/Dianafufu.jpg" alt="mohui666 的头像"><div><h2 id="detail-title">Mo Hui</h2><p>@mohui666</p></div></div><p>写点项目，收点链接，也喜欢 ASOUL。</p><p>把想法做成能用的东西。这里收着我的 AI 应用、本地工具、游戏 Mod 和交互实验。</p><dl class="profile-facts"><div><dt>LEARNING / 学习</dt><dd>中国矿业大学（北京） · 在读<br>正在学习深度学习</dd></div><div><dt>BUILDING / 做些什么</dt><dd>AI 对话与编程智能体 · Android 应用<br>本地工具 · 游戏 Mod · Web 与图形学</dd></div><div><dt>APPROACH / 怎么做</dt><dd>Local-first. 从自己想用的东西开始。</dd></div></dl><p class="eyebrow">使用的技术 / FROM MY PROJECTS</p><div class="skill-list">${['React','TypeScript','Python','Rust','C#','Android','Unity','Three.js','OpenGL','DuckDB','PyTorch'].map((s) => `<span>${s}</span>`).join('')}</div><a class="solid-button" href="${profile.github}" target="_blank" rel="noopener noreferrer">GitHub · 查看公开项目 <span>↗</span></a><button class="solid-button secondary" data-book>阅读全部 ${islandProjects.length} 个岛上项目 <span>→</span></button>`;
  } else if (id === 'contact') {
    content += `<a class="contact-link" href="${profile.github}" target="_blank" rel="noopener noreferrer"><span>GitHub<small>@mohui666 · 代码与持续更新</small></span>↗</a><a class="contact-link" href="../blog/" target="_blank" rel="noopener noreferrer"><span>博客与笔记<small>项目开发记录，以及路上的想法</small></span>↗</a><a class="contact-link" href="https://b23.tv/NfPPuQr" target="_blank" rel="noopener noreferrer"><span>Bilibili<small>关注嘉然，顿顿解馋。</small></span>↗</a><a class="contact-link" href="../" target="_blank" rel="noopener noreferrer"><span>个人主页<small>更多项目、收藏与互联网邻居</small></span>↗</a><p class="credit">这座岛的游览方式受到 <a href="https://bruno-simon.com/" target="_blank" rel="noopener noreferrer">Bruno Simon 的作品集</a>启发，自然大岛的空间感参考 <a href="https://bigwalk.game/" target="_blank" rel="noopener noreferrer">Big Walk</a>。场景、建筑与载具为本站原创程序化模型。</p>`;
  } else content += projectsFor(id).map(projectCard).join('');
  $('#detail-body').innerHTML = content + `<button class="solid-button secondary" data-travel="${id}">快速前往${p.short} <span>→</span></button>`;
  $('#detail-body').scrollTop = 0;
  showDialog(detail);
}
function openBook(filter = 'all') {
  $('#detail-meta').textContent = `FIELD NOTES / ${islandProjects.length} 个项目 / GITHUB & WEB`;
  $('#detail-body').innerHTML = `<p class="eyebrow">THE PROJECT FIELD GUIDE</p><h2 id="detail-title">我的项目手册。</h2><p>停下来翻翻也好。每个项目，都通向真实的作品或公开仓库。</p><div class="book-tabs" aria-label="项目分区"><button data-filter="all" class="${filter === 'all' ? 'active' : ''}">全部 ${islandProjects.length}</button>${places.filter((p) => p.ids).map((p) => `<button data-filter="${p.id}" class="${filter === p.id ? 'active' : ''}">${p.short}</button>`).join('')}</div><div id="book-projects">${(filter === 'all' ? islandProjects : projectsFor(filter)).map(projectCard).join('')}</div>`;
  $('#detail-body').scrollTop = 0;
  showDialog(detail);
}
document.addEventListener('click', (event) => {
  const travel = event.target.closest('[data-travel]');
  if (travel) travelTo(travel.dataset.travel);
  const vehicle = event.target.closest('[data-vehicle]');
  if (vehicle) selectVehicle(vehicle.dataset.vehicle);
  const place = event.target.closest('[data-place]');
  if (place) openPlace(place.dataset.place);
  if (event.target.closest('[data-book]')) openBook();
  const filter = event.target.closest('[data-filter]');
  if (filter) { const id = filter.dataset.filter; openBook(id); document.querySelector(`[data-filter="${id}"]`).focus(); }
});
$('#directory').onclick = () => openBook();
$('#help').onclick = () => showDialog(guide);
$('#start-driving').onclick = () => guide.close();
for (const dialog of [detail, guide, garage]) {
  dialog.querySelector('.close-button').onclick = () => dialog.close();
  dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => { releaseInput(); if (lastTrigger?.isConnected) lastTrigger.focus({ preventScroll: true }); });
}
function toast(text) { $('#world-status').textContent = text; $('#world-status').classList.remove('quiet'); toastUntil = elapsed + 5; }
function setOverview(value) {
  overview = value;
  if (world) world.scene.fog = value ? null : landscapeFog;
  $('#camera').setAttribute('aria-pressed', String(value));
  $('#camera span').textContent = value ? '漫游' : '全岛';
  document.body.classList.toggle('overview', value);
  releaseInput();
  updateCamera(1, true);
}
function placeVehicle(x, z, angle = Math.PI) {
  releaseInput(); heading = angle;
  const y = vehicleMode === 'boat' ? world.waterLevel : world.groundHeight(x, z);
  world.player.position.set(x, y, z);
  world.player.rotation.set(0, heading, 0, 'YXZ');
  orbitYaw = heading + Math.PI;
  orbitPitch = .33;
  center.set(x, y + 1.2, z);
  updateCamera(1, true);
}
function resetCar() {
  if (!world) return;
  if (vehicleMode === 'boat') placeVehicle(world.boatSpawn.x, world.boatSpawn.z, world.boatSpawn.yaw);
  else placeVehicle(world.spawn.x, world.spawn.z, Math.PI);
  setOverview(false);
  toast(vehicleMode === 'boat' ? '快艇回到港湾。沿着海岸绕岛看看。' : '回到出发营地。顺着山路去看看远处。');
}
function selectVehicle(mode) {
  if (!world) return;
  const wasBoat = vehicleMode === 'boat';
  vehicleMode = mode;
  vehicleModels.setMode(mode);
  cameraDistance = vehicleSpecs[mode].distance;
  releaseInput();
  if (mode === 'boat') placeVehicle(world.boatSpawn.x, world.boatSpawn.z, world.boatSpawn.yaw);
  else if (wasBoat) {
    const dock = world.stations.find((s) => s.id === 'delivery');
    placeVehicle(dock.x, dock.z, Math.PI);
  } else placeVehicle(world.player.position.x, world.player.position.z, heading);
  updateVehicleUI();
  if (garage.open) garage.close();
  setOverview(false);
  toast(mode === 'boat' ? '快艇已在港口下水。WASD 驾驶，Shift 加速。' : `已换上${vehicleSpecs[mode].name}。W 前进，S 倒车，A / D 转向。`);
}
function updateVehicleUI() {
  document.querySelectorAll('[data-vehicle]').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.vehicle === vehicleMode)));
  $('#vehicles').setAttribute('aria-label', `交通工具，当前${vehicleSpecs[vehicleMode].name}`);
}
function travelTo(id) {
  if (!world) return;
  const station = world.stations.find((s) => s.id === id);
  if (vehicleMode === 'boat') { vehicleMode = 'car'; vehicleModels.setMode('car'); cameraDistance = 10; updateVehicleUI(); }
  if (detail.open) detail.close();
  setOverview(false);
  placeVehicle(station.x, station.z, Math.PI);
  toast(`抵达${station.label}。按 E 查看，或继续开车。`);
  canvas.focus({ preventScroll: true });
}
$('#reset').onclick = resetCar;
$('#camera').onclick = () => setOverview(!overview);
$('#vehicles').onclick = () => showDialog(garage);
$('#sprint').onclick = () => { boosting = !boosting; $('#sprint').setAttribute('aria-pressed', String(boosting)); };
$('#interact').onclick = () => { if (nearest) openPlace(nearest.id); };
const brakeButton = $('#brake');
brakeButton.addEventListener('pointerdown', (event) => { brakeButton.setPointerCapture(event.pointerId); braking = true; });
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) brakeButton.addEventListener(type, () => { braking = false; });
window.addEventListener('keydown', (event) => {
  if (detail.open || guide.open || garage.open || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target.closest('input,textarea,select,[contenteditable=true]')) return;
  const code = event.code;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','Space'].includes(code)) {
    if (code === 'Space' && event.target.closest('button,a') && Math.abs(speed) < .2) return;
    event.preventDefault(); keys.add(code);
  }
  if (event.repeat) return;
  if (code === 'KeyR') resetCar();
  if (code === 'KeyM') setOverview(!overview);
  if ((code === 'KeyE' || (code === 'Enter' && !event.target.closest('button,a'))) && nearest) { event.preventDefault(); openPlace(nearest.id); }
});
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', releaseInput);
document.addEventListener('visibilitychange', () => { releaseInput(); previous = 0; });

const joystick = $('#joystick');
let joystickPointer = null;
function moveJoystick(event) {
  const rect = joystick.getBoundingClientRect();
  const x = event.clientX - rect.left - rect.width / 2;
  const y = event.clientY - rect.top - rect.height / 2;
  const magnitude = Math.min(1, Math.hypot(x, y) / 33);
  const angle = Math.atan2(y, x);
  touch.set(Math.cos(angle) * magnitude, Math.sin(angle) * magnitude);
  $('#joystick-knob').style.transform = `translate(${touch.x * 29}px, ${touch.y * 29}px)`;
}
joystick.addEventListener('pointerdown', (event) => { if (joystickPointer !== null) return; joystickPointer = event.pointerId; joystick.setPointerCapture(event.pointerId); moveJoystick(event); });
joystick.addEventListener('pointermove', (event) => { if (event.pointerId === joystickPointer) moveJoystick(event); });
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) joystick.addEventListener(type, (event) => {
  if (event.pointerId === joystickPointer) { joystickPointer = null; touch.set(0, 0); $('#joystick-knob').style.transform = ''; }
});
let looking = null;
canvas.addEventListener('pointerdown', (event) => {
  if (looking) return;
  looking = { id: event.pointerId, x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId); canvas.focus({ preventScroll: true });
});
canvas.addEventListener('pointermove', (event) => {
  if (!looking || looking.id !== event.pointerId || overview) return;
  orbitYaw -= (event.clientX - looking.x) * .005;
  orbitPitch = THREE.MathUtils.clamp(orbitPitch + (event.clientY - looking.y) * .004, .10, 1.02);
  looking.x = event.clientX; looking.y = event.clientY;
  lookUntil = elapsed + 3;
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, (event) => { if (looking?.id === event.pointerId) looking = null; });
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
canvas.addEventListener('wheel', (event) => { event.preventDefault(); cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * .01, 5, 25); }, { passive: false });
window.addEventListener('resize', () => { if (world) world.resize(innerWidth, innerHeight); });

function drivable(x, z) {
  if (vehicleMode === 'boat') {
    const { bounds } = world;
    return x > bounds.minX - 170 && x < bounds.maxX + 170 && z > bounds.minZ - 170 && z < bounds.maxZ + 170 && world.groundHeight(x, z) < world.waterLevel - .35;
  }
  if (!world.isWalkable(x, z)) return false;
  return !world.colliders.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + vehicleSpecs[vehicleMode].radius);
}
let steeringValue = 0;
function drive(dt) {
  if (detail.open || guide.open || garage.open || overview) return;
  const spec = vehicleSpecs[vehicleMode];
  const throttle = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) - touch.y;
  steeringValue = THREE.MathUtils.clamp(Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + touch.x, -1, 1);
  const brake = braking || keys.has('Space');
  const maxSpeed = (boosting || keys.has('ShiftLeft') || keys.has('ShiftRight')) ? spec.boost : spec.maxSpeed;
  if (brake) speed = THREE.MathUtils.damp(speed, 0, 12, dt);
  else if (Math.abs(throttle) > .05) speed += THREE.MathUtils.clamp(throttle, -1, 1) * spec.acceleration * dt;
  else speed = THREE.MathUtils.damp(speed, 0, vehicleMode === 'boat' ? 1.1 : 2.3, dt);
  speed = THREE.MathUtils.clamp(speed, -maxSpeed * .4, maxSpeed);
  // Steering follows the wheels: reversing also reverses the turn direction.
  heading -= steeringValue * spec.steering * THREE.MathUtils.clamp(speed / 6, -1, 1) * dt;
  const dx = Math.sin(heading) * speed * dt, dz = Math.cos(heading) * speed * dt;
  const position = world.player.position;
  const nx = position.x + dx, nz = position.z + dz;
  if (drivable(nx, nz)) { position.x = nx; position.z = nz; }
  else {
    if (drivable(nx, position.z)) position.x = nx;
    if (drivable(position.x, nz)) position.z = nz;
    speed *= .35;
  }
  if (vehicleMode === 'boat') {
    position.y = world.waterLevel;
    world.player.rotation.set(0, heading, 0, 'YXZ');
  } else {
    const h = world.groundHeight(position.x, position.z);
    position.y = h + .07;
    const f = world.groundHeight(position.x + Math.sin(heading) * 1.2, position.z + Math.cos(heading) * 1.2);
    const b = world.groundHeight(position.x - Math.sin(heading) * 1.2, position.z - Math.cos(heading) * 1.2);
    const l = world.groundHeight(position.x - Math.cos(heading), position.z + Math.sin(heading));
    const r = world.groundHeight(position.x + Math.cos(heading), position.z - Math.sin(heading));
    world.player.rotation.set(Math.atan2(b - f, 2.4), heading, Math.atan2(r - l, 2), 'YXZ');
  }
  canvas.dataset.position = `${position.x.toFixed(2)},${position.z.toFixed(2)}`;
  canvas.dataset.vehicle = vehicleMode;
  canvas.dataset.speed = Math.abs(speed).toFixed(2);
}
const wantedCamera = new THREE.Vector3(), wantedCenter = new THREE.Vector3();
function updateCamera(dt, immediate = false) {
  if (!world) return;
  const damping = immediate || reducedMotion ? 1 : 1 - Math.exp(-dt * 7);
  if (overview) {
    wantedCenter.set(0, 0, 0);
    wantedCamera.set(0, innerWidth < 700 ? 1120 : 740, innerWidth < 700 ? 520 : 390);
  } else {
    if (!looking && elapsed > lookUntil && Math.abs(speed) > 1.5) {
      const targetYaw = heading + Math.PI;
      const angle = Math.atan2(Math.sin(targetYaw - orbitYaw), Math.cos(targetYaw - orbitYaw));
      orbitYaw += angle * Math.min(1, dt * 2);
    }
    wantedCenter.copy(world.player.position); wantedCenter.y += 1.2;
    center.lerp(wantedCenter, damping);
    wantedCamera.set(
      center.x + Math.sin(orbitYaw) * Math.cos(orbitPitch) * cameraDistance,
      center.y + Math.sin(orbitPitch) * cameraDistance,
      center.z + Math.cos(orbitYaw) * Math.cos(orbitPitch) * cameraDistance,
    );
    wantedCamera.y = Math.max(wantedCamera.y, world.groundHeight(wantedCamera.x, wantedCamera.z) + 1.1, world.waterLevel + 1.1);
  }
  if (overview) center.lerp(wantedCenter, immediate ? 1 : Math.min(1, dt * 4));
  world.camera.position.lerp(wantedCamera, damping);
  world.camera.lookAt(center);
  world.camera.updateMatrixWorld();
}
function mapPoint(x, z) {
  return [5 + (x - world.bounds.minX + 170) / (world.bounds.maxX - world.bounds.minX + 340) * 150,
    4 + (z - world.bounds.minZ + 170) / (world.bounds.maxZ - world.bounds.minZ + 340) * 104];
}
function buildMap() {
  const coastline = [];
  for (let i = 0; i < 96; i++) {
    const angle = i / 96 * Math.PI * 2;
    let low = 0, high = 650;
    for (let j = 0; j < 12; j++) {
      const radius = (low + high) / 2;
      if (world.groundHeight(Math.cos(angle) * radius, Math.sin(angle) * radius) > world.waterLevel) low = radius; else high = radius;
    }
    coastline.push(mapPoint(Math.cos(angle) * low, Math.sin(angle) * low).join(','));
  }
  const paths = world.mapPaths.map((points) => `<polyline points="${points.map(([x,z]) => mapPoint(x,z).join(',')).join(' ')}" fill="none" stroke="#f8edcb" stroke-width="1.6"/>`).join('');
  $('#minimap').innerHTML = `<polygon points="${coastline.join(' ')}" fill="#9bbd86" stroke="#e9d5aa" stroke-width="3"/>${paths}<g id="map-stations">${world.stations.map((s) => { const p = mapPoint(s.x,s.z); return `<circle cx="${p[0]}" cy="${p[1]}" r="2.4" fill="#3b6548"/>`; }).join('')}</g><path id="map-car" d="M0 -5 3.5 4 0 2 -3.5 4Z" fill="#e59b26" stroke="#fff9e9" stroke-width="1.2"/>`;
}
function frame(now) {
  requestAnimationFrame(frame);
  if (!world || document.hidden) return;
  const dt = previous ? Math.min((now - previous) / 1000, .2) : 0;
  previous = now; elapsed += dt;
  // Substeps keep ground collision stable when rendering a dense part of the forest.
  const steps = Math.max(1, Math.ceil(dt / .025));
  for (let i = 0; i < steps; i++) drive(dt / steps);
  const paused = detail.open || guide.open || garage.open;
  if (!reducedMotion && !paused) { world.update(elapsed, dt, speed); vehicleModels.update(vehicleMode, elapsed, speed, -steeringValue); }
  updateCamera(dt);
  nearest = world.stations.map((s) => ({ ...s, distance: Math.hypot(world.player.position.x - s.x, world.player.position.z - s.z) })).filter((s) => s.distance < s.r).sort((a,b) => a.distance-b.distance)[0];
  for (const station of world.stations) {
    const label = labels.get(station.id);
    const distance = Math.hypot(world.player.position.x - station.x, world.player.position.z - station.z);
    projection.set(station.x, station.labelY, station.z).project(world.camera);
    const x = (projection.x * .5 + .5) * innerWidth, y = (-projection.y * .5 + .5) * innerHeight;
    label.hidden = projection.z < -1 || projection.z > 1 || Math.abs(projection.x) > .92 || y < 80 || y > innerHeight - 105 || (!overview && distance > 190);
    label.style.left = `${x}px`; label.style.top = `${y}px`;
    label.classList.toggle('near', nearest?.id === station.id);
    document.querySelector(`.destination[data-place="${station.id}"]`).classList.toggle('active', nearest?.id === station.id);
  }
  $('#interact').hidden = !nearest || overview;
  if (nearest) $('#interact span').textContent = `查看${nearest.label}`;
  const p = mapPoint(world.player.position.x, world.player.position.z);
  $('#map-car').setAttribute('transform', `translate(${p[0]} ${p[1]}) rotate(${180 - THREE.MathUtils.radToDeg(heading)})`);
  if (elapsed > toastUntil) $('#world-status').classList.add('quiet');
  world.renderer.render(world.scene, world.camera);
}
try {
  world = createWorld(canvas);
  landscapeFog = world.scene.fog;
  vehicleModels = createVehicles(world.player);
  updateVehicleUI();
  world.resize(innerWidth, innerHeight);
  buildMap();
  placeVehicle(world.spawn.x, world.spawn.z, Math.PI);
  canvas.dataset.ready = 'true';
  toast('欢迎来到默绘岛。W 前进，A / D 转向，拖动画面看四周。');
  requestAnimationFrame(frame);
} catch (error) {
  console.error('Island initialization:', error);
  $('#world-status').textContent = '三维场景未能启动。仍可通过项目手册和下方地点阅读全部作品。';
  $('#world-status').classList.add('error');
}
