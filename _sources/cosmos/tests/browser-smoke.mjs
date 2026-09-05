import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'] });
const errors = [], warnings = [], checks = [];
let phase = 'initialization';
function record(page) {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); else if (msg.type() === 'warning') warnings.push(msg.text()); });
}
const check = (name, detail) => { checks.push({ name, detail }); console.log(`PASS ${name}: ${detail}`); };
async function savedState(page) {
  const waiting = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await waiting;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}
async function pause(page) {
  if (await page.locator('#play-state').textContent() === '演化中') await page.locator('#play').click();
  await page.waitForFunction(() => document.querySelector('#play-state').textContent === '已暂停');
}
async function visibleSelectedLabel(page, name) {
  const label = page.locator('.body-label.selected');
  await label.waitFor({ state: 'visible' });
  assert.equal(await label.textContent(), name);
  const [labelBox, viewport] = await Promise.all([label.boundingBox(), page.locator('#viewport').boundingBox()]);
  assert.ok(labelBox && viewport && labelBox.x + labelBox.width > viewport.x && labelBox.x < viewport.x + viewport.width && labelBox.y + labelBox.height > viewport.y && labelBox.y < viewport.y + viewport.height);
}
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  record(page);
  await page.goto((process.argv[2]||'http://localhost:4186/cosmos/'), { waitUntil: 'networkidle' });
  await page.locator('#body-count').filter({ hasText: '10' }).waitFor();
  await pause(page);
  const start = await savedState(page);
  assert.equal(start.bodies.length, 10);
  assert.deepEqual(start.bodies.map(b => b.id), ['sun','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','moon']);
  check('10-body solar system', 'Sun, eight planets and Moon loaded with physical state');

  phase = 'pause and single step';
  await page.waitForTimeout(300);
  const paused = await savedState(page);
  assert.equal(paused.time, start.time);
  await page.locator('#step').click();
  const stepped = await savedState(page);
  assert.ok(Math.abs(stepped.time - paused.time - paused.params.dt) < 1e-10);
  assert.equal(await page.locator('#play-state').textContent(), '已暂停');
  check(phase, `paused time unchanged; one step advances ${stepped.params.dt} Julian yr`);

  phase = 'Earth–Moon view';
  await page.locator('[data-view="moon"]').click();
  await page.waitForFunction(() => { const v = Number.parseFloat(document.querySelector('#orbit-period').textContent); return v > 0.065 && v < 0.085; });
  assert.equal(await page.locator('#selected-name').textContent(), '月球');
  const moonPeriod = Number.parseFloat(await page.locator('#orbit-period').textContent());
  assert.ok(moonPeriod > 0.065 && moonPeriod < 0.085);
  await visibleSelectedLabel(page, '月球');
  check(phase, `Moon selected and visible, period ${moonPeriod} yr`);

  phase = 'body property edit';
  await page.locator('.body-list-item[data-id="earth"]').click();
  await page.locator('#body-name').fill('验收地球');
  await page.locator('#body-mass').fill('0.000004');
  await page.locator('#body-radius').fill('6500');
  await page.locator('#apply-body').click();
  const edited = await savedState(page);
  const earth = edited.bodies.find(b => b.id === 'earth');
  assert.equal(earth.name, '验收地球');
  assert.equal(earth.mass, 0.000004);
  assert.ok(Math.abs(earth.radius * 149597870.7 - 6500) < 1e-6);
  check(phase, 'name, mass and physical radius changed in exported state');

  phase = 'empty numeric input rejection';
  await page.locator('#body-mass').fill('');
  await page.locator('#apply-body').click();
  assert.equal(await page.locator('#body-mass').evaluate(e => e.validity.valueMissing), true);
  const invalid = await savedState(page);
  assert.equal(invalid.bodies.find(b => b.id === 'earth').mass, earth.mass);
  await page.locator('#body-mass').fill('0.000004');
  await page.locator('#apply-body').click();
  check(phase, 'empty mass field is invalid and existing mass remains unchanged');

  phase = 'six orbital elements edit';
  await page.locator('#edit-orbit').click();
  await page.locator('#edit-a').fill('1.2');
  await page.locator('#edit-e').fill('0.1');
  await page.locator('#edit-i').fill('17');
  await page.locator('#edit-node').fill('42');
  await page.locator('#edit-peri').fill('73');
  await page.locator('#edit-nu').fill('125');
  await page.locator('#orbit-form button[type="submit"]').click();
  await page.waitForFunction(() => Number.parseFloat(document.querySelector('#orbit-a').textContent) === 1.2 && Number.parseFloat(document.querySelector('#orbit-i').textContent) === 17);
  assert.equal(Number.parseFloat(await page.locator('#orbit-a').textContent()), 1.2);
  assert.equal(Number.parseFloat(await page.locator('#orbit-e').textContent()), 0.1);
  assert.equal(Number.parseFloat(await page.locator('#orbit-i').textContent()), 17);
  await page.locator('#edit-orbit').click();
  for (const [key, value] of Object.entries({a:1.2,e:0.1,i:17,node:42,peri:73,nu:125})) assert.ok(Math.abs(Number(await page.locator(`#edit-${key}`).inputValue()) - value) < 1e-6, `${key}: expected ${value}, got ${await page.locator(`#edit-${key}`).inputValue()}`);
  await page.locator('#orbit-close').click();
  check(phase, 'all six parameters round-trip; live a/e/i = 1.2 AU / 0.1 / 17°');

  phase = 'isolated selection and 2D/3D';
  await page.locator('#isolate-body').click();
  await page.locator('#view-top').click();
  await page.waitForTimeout(200);
  await visibleSelectedLabel(page, '验收地球');
  await page.locator('#view-3d').click();
  await page.waitForTimeout(200);
  await visibleSelectedLabel(page, '验收地球');
  assert.equal(await page.locator('#isolate-badge').isVisible(), true);
  await page.locator('#exit-isolate').click();
  check(phase, 'selected Earth label stays within viewport in isolated 2D and 3D');

  phase = 'manual body add and delete';
  await page.locator('#add-body').click();
  await page.locator('#new-method').selectOption('manual');
  await page.locator('#new-name').fill('手动验收天体');
  await page.locator('#new-mass').fill('0.00000001');
  await page.locator('#new-radius').fill('100');
  for (const [key, value] of Object.entries({px:3,py:2,pz:1,vx:0.1,vy:0.2,vz:0.3})) await page.locator(`#new-${key}`).fill(String(value));
  await page.locator('#add-form button[type="submit"]').click();
  assert.equal(await page.locator('#body-count').textContent(), '11');
  const withManual = await savedState(page);
  const manual = withManual.bodies.find(b => b.name === '手动验收天体');
  assert.deepEqual(manual.position, [3,2,1]);
  assert.deepEqual(manual.velocity, [0.1,0.2,0.3]);
  await page.locator('#delete-body').click();
  assert.equal(await page.locator('#body-count').textContent(), '10');
  const deleted = await savedState(page);
  assert.equal(deleted.bodies.some(b => b.id === manual.id), false);
  check(phase, 'manual r/v applied exactly; only new body removed');

  phase = 'physics controls';
  await page.locator('[data-tab="physics"]').click();
  await page.locator('#gravity-model').selectOption('newtonian');
  await page.locator('#gravity').fill('0.8');
  await page.locator('#gravity').press('Tab');
  await page.locator('#integrator').selectOption('rk4');
  await page.locator('#timestep').fill('0.0001');
  await page.locator('#timestep').press('Tab');
  await page.locator('#softening').fill('0.001');
  await page.locator('#softening').press('Tab');
  await page.locator('#collision-mode').selectOption('elastic');
  await page.locator('#restitution').fill('0.6');
  const physics = await savedState(page);
  assert.deepEqual(physics.params, {dt:0.0001,softening:0.001,gravityScale:0.8,gravityModel:'newtonian',integrator:'rk4',collisionMode:'elastic',restitution:0.6,disruptionThreshold:1,fragmentCount:6});
  check(phase, 'gravity / integrator / dt / softening / contact / restitution update physical state');

  phase = 'JSON export/import round-trip';
  await page.locator('#import-file').setInputFiles({ name:'roundtrip.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(physics)) });
  await page.locator('#scene-title').filter({ hasText:'我的宇宙' }).waitFor();
  const restored = await savedState(page);
  assert.deepEqual(restored.bodies, physics.bodies);
  assert.deepEqual(restored.params, physics.params);
  assert.equal(restored.time, physics.time);
  assert.equal(restored.speed, physics.speed);
  check(phase, 'native JSON download reimport preserves all body data, parameters and simulation time');

  phase = 'mobile 390×844';
  const mobile = await browser.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:1, isMobile:true, hasTouch:true });
  record(mobile);
  await mobile.goto((process.argv[2]||'http://localhost:4186/cosmos/'), {waitUntil:'networkidle'});
  await pause(mobile);
  await mobile.locator('#mobile-bodies').click();
  await mobile.locator('.body-list-item[data-id="mars"]').click();
  await mobile.locator('#body-name').fill('手机火星');
  await mobile.locator('#body-radius').fill('3400');
  await mobile.locator('#mobile-apply').click();
  assert.equal(await mobile.locator('#selected-name').textContent(), '手机火星');
  assert.equal(await mobile.locator('#body-radius').inputValue(), '3400');
  check(phase, 'sidebar selection, name/radius input and application work by touch-sized viewport');

  await mkdir('/tmp/cosmos-browser-smoke', {recursive:true});
  await page.screenshot({path:'/tmp/cosmos-browser-smoke/desktop.png',fullPage:true});
  await mobile.screenshot({path:'/tmp/cosmos-browser-smoke/mobile.png',fullPage:true});
  assert.equal(errors.length, 0, 'browser console/page errors');
} catch (error) {
  console.error(`FAIL ${phase}: ${error.stack}`);
  process.exitCode = 1;
} finally {
  console.log(JSON.stringify({checks,errors,warnings},null,2));
  await browser.close();
}
