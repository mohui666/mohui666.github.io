import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const url=process.argv[2]||'http://localhost:4186/cosmos/';
const output='/tmp/cosmos-impact-smoke';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1600,height:1000}});
const errors=[],checks=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const mass=bodies=>bodies.reduce((sum,body)=>sum+body.mass,0);
const pass=(name,detail)=>{checks.push({name,detail});console.log(`PASS ${name}: ${detail}`);};
async function pause(){
  if(await page.locator('#play-state').textContent()==='演化中')await page.locator('#play').click();
  await page.waitForFunction(()=>document.querySelector('#play-state').textContent==='已暂停');
}
async function save(){
  const pending=page.waitForEvent('download');
  await page.locator('#export').click();
  const download=await pending,stream=await download.createReadStream(),chunks=[];
  for await(const chunk of stream)chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}
async function launch(speed){
  await page.locator('[data-tab="body"]').click();
  await page.locator('.body-list-item[data-id="earth"]').click();
  await page.locator('#impact-body').click();
  assert.equal(await page.locator('#impact-mass').inputValue(),'15');
  if(speed!==undefined)await page.locator('#impact-speed').fill(String(speed));
  else assert.equal(await page.locator('#impact-speed').inputValue(),'50');
  await page.locator('#impact-form button[type="submit"]').click();
}
try{
  await mkdir(output,{recursive:true});
  await page.goto(url,{waitUntil:'networkidle'});
  await pause();
  const initial=await save(),earth=initial.bodies.find(body=>body.id==='earth');
  assert.equal(initial.bodies.length,10);
  const expectedTotal=mass(initial.bodies)+earth.mass*.15;

  await launch();
  await page.waitForFunction(()=>document.querySelector('#collision-log').textContent.includes('碎裂'),{},{timeout:45000});
  await pause();
  const fragmented=await save(),fragments=fragmented.bodies.filter(body=>body.isFragment);
  assert.equal(fragments.length,6);
  assert.equal(fragmented.bodies.some(body=>body.id==='earth'),false);
  assert.ok(Math.abs(mass(fragments)-earth.mass*1.15)<earth.mass*1e-12);
  assert.ok(Math.abs(mass(fragmented.bodies)-expectedTotal)<1e-14);
  assert.ok(Number(await page.locator('#collision-count').textContent())>=1);
  await page.locator('[data-tab="physics"]').click();
  await page.locator('#collision-log').scrollIntoViewIfNeeded();
  await page.screenshot({path:`${output}/earth-fragmentation.png`,fullPage:true});
  pass('default 15% / 50 km/s Earth impact',`six physical fragments; pair mass ${mass(fragments)} equals original Earth mass × 1.15; total mass conserved`);

  await page.locator('#play').click();
  await page.waitForTimeout(700);
  await pause();
  const evolved=await save();
  assert.ok(evolved.time>fragmented.time);
  const moving=fragments.filter(before=>{const after=evolved.bodies.find(body=>body.id===before.id);return after&&after.position.some((value,axis)=>value!==before.position[axis]);});
  assert.equal(moving.length,6);
  assert.ok(Math.abs(mass(evolved.bodies)-expectedTotal)<1e-14);
  pass('fragment dynamics',`all six fragments change position after ${evolved.time-fragmented.time} yr and mass remains conserved`);

  await page.locator('#reset').click();
  await pause();
  const reset=await save();
  assert.equal(reset.bodies.length,10);
  assert.equal(reset.bodies.some(body=>body.isFragment),false);
  await page.waitForFunction(()=>document.querySelector('#collision-count').textContent==='0');
  assert.match(await page.locator('#collision-log').textContent(),/尚未发生碰撞/);
  pass('reset', 'ten original solar-system bodies; collision counter and log cleared');

  await launch(1);
  await page.waitForFunction(()=>document.querySelector('#collision-log').textContent.includes('合并 / 吸收'),{},{timeout:45000});
  await pause();
  const merged=await save(),mergedEarth=merged.bodies.find(body=>body.id==='earth');
  assert.equal(merged.bodies.length,10);
  assert.equal(merged.bodies.some(body=>body.isFragment),false);
  assert.ok(Math.abs(mergedEarth.mass-earth.mass*1.15)<earth.mass*1e-12);
  assert.ok(Math.abs(mass(merged.bodies)-expectedTotal)<1e-14);
  await page.locator('[data-tab="physics"]').click();
  await page.locator('#collision-log').scrollIntoViewIfNeeded();
  await page.screenshot({path:`${output}/earth-accretion.png`,fullPage:true});
  pass('low-speed 1 km/s Earth impact', 'UI reports merge/accretion; Earth gains 15% mass and ten physical bodies remain');
  assert.deepEqual(errors,[]);
  pass('browser errors','no console errors or page exceptions');
}catch(error){
  console.error(error.stack);
  await page.screenshot({path:`${output}/failure.png`,fullPage:true});
  process.exitCode=1;
}finally{
  console.log(JSON.stringify({url,checks,errors,output},null,2));
  await browser.close();
}
