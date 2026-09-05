import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const url = process.env.COSMOS_URL || 'http://localhost:4186/cosmos/';
const output = process.env.COSMOS_MOBILE_OUTPUT || '/tmp/cosmos-mobile-review/final';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'] });
const checks = [], errors = [];
const record = (name, detail) => { checks.push({name, detail}); console.log(`PASS ${name}: ${detail}`); };
const visibleInScreen = async (page, selector) => {
  const box = await page.locator(selector).boundingBox();
  const size = page.viewportSize();
  assert.ok(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= size.width + 1 && box.y + box.height <= size.height + 1, `${selector} not within screen: ${JSON.stringify(box)}`);
  return box;
};
async function closed(page) {
  await page.waitForFunction(() => !document.querySelector('.mobile-open'));
  assert.equal(await page.locator('#panel-backdrop').isVisible(), false);
}
try {
  for (const [width, height] of [[320,568],[390,844],[844,390],[768,1024]]) {
    const name = `${width}×${height}`;
    const page = await browser.newPage({ viewport: {width,height}, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    page.setDefaultTimeout(7000);
    page.on('pageerror', error => errors.push(`${name}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${name}: ${message.text()}`); });
    await page.goto(url, {waitUntil:'networkidle'});
    await page.locator('#body-count').filter({hasText:'10'}).waitFor({state:'attached'});
    await page.locator('#play').click();
    assert.equal(await page.locator('#play-state').textContent(), '已暂停');
    const overflow = await page.evaluate(() => ({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
    assert.ok(overflow.width <= width && overflow.height <= height, `${name} document overflow ${JSON.stringify(overflow)}`);
    const play = await visibleInScreen(page, '#play');
    assert.ok(play.width >= 44 && play.height >= 44);
    for (const selector of ['#mobile-bodies','#mobile-parameters','#mobile-display','#mobile-data']) {
      const nav = await visibleInScreen(page, selector);
      assert.ok(nav.height >= 48 && nav.width >= 44);
    }
    await page.screenshot({path:`${output}/${width}x${height}-observer.png`});
    record(`${name} first screen`, 'no overflow; simulation, pause and four navigation buttons within viewport');

    await page.locator('#mobile-bodies').click();
    await page.locator('.body-list-item[data-id="moon"]').click();
    await page.waitForFunction(() => document.querySelector('#right-panel').classList.contains('mobile-open'));
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#selected-name').textContent(), '月球');
    const fonts = await page.locator('#body-form input:not([type="color"])').evaluateAll(inputs => inputs.map(input => getComputedStyle(input).fontSize));
    assert.ok(fonts.every(font => font === '16px'), JSON.stringify(fonts));
    await page.locator('#body-name').fill(`手机月球${width}`);
    await page.locator('#body-radius').fill('1800');
    await visibleInScreen(page, '#mobile-apply');
    await page.locator('#mobile-apply').click();
    await closed(page);
    await page.locator('#mobile-parameters').click();
    assert.equal(await page.locator('#selected-name').textContent(), `手机月球${width}`);
    assert.equal(await page.locator('#body-radius').inputValue(), '1800');
    await page.screenshot({path:`${output}/${width}x${height}-parameters.png`});
    await page.locator('#right-panel .sheet-close').click();
    await closed(page);
    record(`${name} body parameters`, 'scroll to Moon, automatic inspector, 16px fields, sticky submit persists name/radius and closes');

    await page.locator('#mobile-bodies').click();
    await page.locator('#left-panel .sheet-close').click();
    await closed(page);
    await page.locator('#mobile-parameters').click();
    await page.locator('#panel-backdrop').click({position:{x:8,y:3}});
    await closed(page);
    await page.locator('#mobile-display').click();
    await page.locator('#tab-display').waitFor({state:'visible'});
    assert.equal(await page.locator('#tab-display').isVisible(), true);
    assert.equal(await page.locator('.mobile-applybar').isVisible(), false);
    await page.locator('#right-panel .sheet-close').click();
    await closed(page);
    record(`${name} panel exits`, 'body/parameter close buttons, backdrop and display-tab navigation work');

    await page.locator('#mobile-data').click();
    assert.equal(await page.locator('.telemetry-numbers > div:visible').count(), 4);
    await page.locator('.telemetry-numbers > div:last-child').scrollIntoViewIfNeeded();
    await page.screenshot({path:`${output}/${width}x${height}-data.png`});
    await page.locator('.telemetry .sheet-close').click();
    await closed(page);
    record(`${name} conservation data`, 'all four numeric metrics exposed in scrollable data panel');

    if (width === 320 || width === 390) {
      await page.locator('#mobile-parameters').click();
      await page.locator('#body-radius').waitFor({state:'visible'});
      await page.locator('#body-radius').focus();
      await page.waitForTimeout(250);
      const reduced = width === 320 ? 320 : 420;
      await page.setViewportSize({width,height:reduced});
      await page.locator('#body-radius').fill('1810');
      await page.locator('#body-radius').scrollIntoViewIfNeeded();
      await visibleInScreen(page, '#body-radius');
      await visibleInScreen(page, '#mobile-apply');
      await page.screenshot({path:`${output}/${width}x${reduced}-keyboard-layout.png`});
      await page.locator('#mobile-apply').click();
      await closed(page);
      await page.setViewportSize({width,height});
      await page.locator('#mobile-parameters').click();
      assert.equal(await page.locator('#body-radius').inputValue(), '1810');
      await page.locator('#right-panel .sheet-close').click();
      record(`${name} reduced viewport`, `field and submit remain reachable at ${width}×${reduced}; saved radius persists`);
    }
    await page.close();
  }
  const desktop = await browser.newPage({viewport:{width:1440,height:900}});
  await desktop.goto(url,{waitUntil:'networkidle'});
  await desktop.locator('#body-count').filter({hasText:'10'}).waitFor({state:'attached'});
  assert.equal(await desktop.locator('.mobile-nav').isVisible(),false);
  assert.equal(await desktop.locator('#panel-backdrop').isVisible(),false);
  assert.equal(await desktop.locator('.mobile-sheet-heading').first().isVisible(),false);
  assert.equal(await desktop.locator('#left-panel').evaluate(el=>el.inert),false);
  assert.equal(await desktop.locator('#right-panel').evaluate(el=>el.inert),false);
  await visibleInScreen(desktop,'#left-panel');await visibleInScreen(desktop,'#right-panel');
  assert.equal(await desktop.locator('#apply-body').isVisible(),true);
  await desktop.screenshot({path:`${output}/desktop.png`});
  record('1440×900 desktop', 'both sidebars and desktop apply remain available; mobile UI hidden');
  assert.deepEqual(errors,[]);
} catch (error) {
  console.error(error.stack);
  process.exitCode=1;
} finally {
  await writeFile(`${output}/results.json`,JSON.stringify({checks,errors},null,2));
  await browser.close();
}
