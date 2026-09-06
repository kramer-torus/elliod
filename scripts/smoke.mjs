import { chromium } from 'playwright-core';
import fs from 'node:fs';
const out = process.env.SMOKE_OUT ?? 'smoke-out';
fs.mkdirSync(out, { recursive: true });
const exe = process.env.CHROME_PATH; // e.g. /opt/pw-browsers/chromium-1194/chrome-linux/chrome
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
// Freeze "today" to the Tuesday of week 3 so the Today screen shows a quality run in the foundation phase.
await page.addInitScript(() => {
  const fixed = new Date(2026, 8, 22, 9, 0, 0); // 22 Sep 2026
  const RealDate = Date;
  class MockDate extends RealDate {
    constructor(...a) { if (a.length === 0) { super(fixed.getTime()); } else { super(...a); } }
    static now() { return fixed.getTime(); }
  }
  // eslint-disable-next-line no-global-assign
  Date = MockDate;
});
await page.goto('http://localhost:4173/');
await page.waitForSelector('text=Start the block');
await page.fill('input[type=date]', '2026-09-07');
await page.screenshot({ path: `${out}/01-onboarding.png`, fullPage: true });
await page.click('text=Start the block');
await page.waitForSelector('text=Foundation');
await page.fill('input[placeholder$="kg"]', '79.6');
await page.click('button:has-text("Log")');
await page.screenshot({ path: `${out}/02-today.png`, fullPage: true });
// open today's run and log it
await page.click('.card.run');
await page.waitForSelector('text=Targets');
await page.screenshot({ path: `${out}/03-run.png`, fullPage: true });
await page.fill('input[placeholder="10"]', '10.2');
await page.locator('label:has-text("Time (minutes)") + input').fill('52');
await page.click('text=Mark done');
await page.waitForSelector('text=Saved');
// plan view → open Monday lift of week 3
await page.click('nav button:has-text("Plan")');
await page.waitForSelector('text=Plan');
await page.click('.weektabs button:has-text("W3")');
await page.screenshot({ path: `${out}/04-plan.png`, fullPage: true });
await page.locator('.card.lift').first().click();
await page.waitForSelector('text=Barbell Overhead Press');
// fill OHP sets: 3 sets 10 reps at 40 kg
const ohp = page.locator('.exercise').first();
const inputs = ohp.locator('.sets input');
await inputs.nth(1).fill('40'); // set1 weight → fills down
await ohp.locator('button:has-text("fill")').click();
await page.screenshot({ path: `${out}/05-lift.png`, fullPage: true });
await page.click('text=Mark done');
await page.waitForSelector('text=Saved');
// week 4 upper A should now suggest 42.5
await page.click('.weektabs button:has-text("W4")');
await page.locator('.card.lift').first().click();
await page.waitForSelector('text=Barbell Overhead Press');
const sug = await page.locator('.suggest').first().innerText();
console.log('SUGGESTION:', sug);
await page.goBack();
await page.click('nav button:has-text("Progress")');
await page.waitForSelector('text=Bodyweight');
await page.screenshot({ path: `${out}/06-progress.png`, fullPage: true });
await page.click('nav button:has-text("Guide")');
await page.waitForSelector('text=The honest trade-off');
await page.screenshot({ path: `${out}/07-guide.png`, fullPage: true });
await page.click('nav button:has-text("Settings")');
await page.waitForSelector('text=Export JSON');
await page.screenshot({ path: `${out}/08-settings.png`, fullPage: true });
// persistence: reload and check the log survived
await page.goto('http://localhost:4173/#/today');
await page.reload();
await page.waitForSelector('text=Foundation');
const done = await page.locator('.check.on').count();
console.log('DONE CHECKS AFTER RELOAD:', done);
const ls = await page.evaluate(() => JSON.parse(localStorage.getItem('elliod.v1')));
console.log('LOG KEYS:', Object.keys(ls.logs), 'WEIGHTS:', ls.weights);
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
