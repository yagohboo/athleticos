/* global document, window, navigator, localStorage, caches, Image */
// Uses disposable browser contexts only. No sign-in, user profile, or remote data writes.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { URL } from 'node:url';
import { chromium, webkit, devices, expect } from '@playwright/test';

if (process.argv.includes('--help')) {
  console.log(
    'Usage: node scripts/check-hosted-pwa.mjs [https://host/athleticos/] [--chromium-only|--webkit-only]',
  );
  process.exit(0);
}
const args = process.argv.slice(2);
const chromiumOnly = args.includes('--chromium-only');
const webkitOnly = args.includes('--webkit-only');
assert(!(chromiumOnly && webkitOnly), 'Choose one engine restriction or neither for both engines.');
const base = new URL(args.find((arg) => !arg.startsWith('--')) ?? 'https://yagohboo.github.io/athleticos/');
assert.equal(base.protocol, 'https:', 'Hosted verification requires HTTPS.');
assert(!base.username && !base.password, 'Use an anonymous URL without credentials.');
base.hash = '';
base.search = '';
if (!base.pathname.endsWith('/')) base.pathname += '/';
const output = path.resolve('artifacts', 'hosted-pwa', new Date().toISOString().replaceAll(/[:.]/g, '-'));
await mkdir(output, { recursive: true });
const check = expect.configure({ timeout: 15000 });
const reports = [];

async function verify(name, browserType, options) {
  let browser;
  let context;
  let page;
  let stage = 'launch';
  const errors = [];
  const report = { browser: name, url: base.href, passed: false, checks: [], pageErrors: errors };
  const url = (route) => `${base.href}#${route}`;
  async function checkLayout() {
    await check(page.locator('main')).not.toContainText('Something needs attention');
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      `${stage}: horizontal overflow`,
    );
    assert.deepEqual(errors, [], `${stage}: uncaught page errors`);
  }
  try {
    browser = await browserType.launch({ headless: true });
    context = await browser.newContext({ ...options, serviceWorkers: 'allow' });
    page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(60000);
    page.on('pageerror', (error) => errors.push(error.message));

    stage = 'anonymous HTTPS load';
    const response = await page.goto(base.href, { waitUntil: 'domcontentloaded' });
    assert(response?.ok(), `Initial response was ${response?.status() ?? 'missing'}. Is Pages deployed?`);
    assert.equal(new URL(page.url()).origin, base.origin, 'Unexpected redirect to a different host.');
    assert.equal(new URL(page.url()).pathname, base.pathname, 'Unexpected deployment path.');
    assert(await page.evaluate(() => window.isSecureContext), 'Page is not a secure context.');
    await check(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
    await checkLayout();
    report.checks.push(stage);

    stage = 'manifest, icons and scope';
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    assert(manifestHref, 'No manifest link.');
    const manifestUrl = new URL(manifestHref, page.url());
    assert(manifestUrl.href.startsWith(base.href), 'Manifest escaped the deployment subpath.');
    const manifestResponse = await context.request.get(manifestUrl.href);
    assert(manifestResponse.ok(), 'Manifest could not be fetched anonymously.');
    const manifest = await manifestResponse.json();
    assert.equal(manifest.display, 'standalone');
    assert.equal(
      new URL(manifest.scope, manifestUrl).href,
      base.href,
      'Manifest scope must match the hosted subpath.',
    );
    assert(
      new URL(manifest.start_url, manifestUrl).href.startsWith(base.href),
      'Start URL escaped the hosted subpath.',
    );
    for (const size of [192, 512]) {
      const icon = manifest.icons?.find((entry) => entry.sizes?.split(/\s+/).includes(`${size}x${size}`));
      assert(icon, `Missing ${size}px manifest icon.`);
      const iconUrl = new URL(icon.src, manifestUrl).href;
      assert(iconUrl.startsWith(base.href), 'Icon escaped the deployment subpath.');
      const dimensions = await page.evaluate(async (src) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        return [image.naturalWidth, image.naturalHeight];
      }, iconUrl);
      assert.deepEqual(dimensions, [size, size], `Invalid ${size}px icon image.`);
    }
    report.checks.push(stage);

    stage = 'service-worker activation and control';
    await page.waitForFunction(
      async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated',
      null,
      { timeout: 60000 },
    );
    const registration = await page.evaluate(async () => {
      const worker = await navigator.serviceWorker.ready;
      return { scope: worker.scope, script: worker.active?.scriptURL };
    });
    assert.equal(registration.scope, base.href, 'Service worker must be scoped to the hosted subpath.');
    assert(registration.script?.startsWith(base.href), 'Worker script escaped the hosted subpath.');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    report.checks.push(stage);

    stage = 'home and training photograph load offline';
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await check(page.getByRole('heading', { name: 'Today', level: 1, exact: true })).toBeVisible();
    const photo = page.locator('.today-workout-photo');
    await check(photo).toBeVisible();
    const imageUrl = await photo.evaluate((element) => {
      const style = window.getComputedStyle(element);
      const source = style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
      return source?.[1];
    });
    assert(
      imageUrl && new URL(imageUrl).href.startsWith(base.href),
      'Expected a bundled training photograph.',
    );
    const photoSize = await page.evaluate(async (src) => {
      const cached = await caches.match(src, { ignoreSearch: true });
      if (!cached?.ok) throw new Error('The training photograph is missing from offline storage.');
      const image = new Image();
      image.src = src;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    }, imageUrl);
    assert(
      photoSize.every((dimension) => dimension > 0),
      'The offline training photograph did not decode.',
    );
    report.checks.push(stage);

    stage = 'bundled fonts load offline';
    const fonts = await page.evaluate(async () => {
      const families = await Promise.all(
        Array.from(document.fonts, async (face) => (await face.load()).family),
      );
      const fontFiles = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          if (new URL(request.url).pathname.endsWith('.woff2')) fontFiles.push(new URL(request.url).pathname);
        }
      }
      return { families, fontFiles };
    });
    assert(new Set(fonts.families).size >= 2, 'Both display and body font families must load offline.');
    for (const filename of ['dm-sans-latin-wght-normal', 'dm-serif-display-latin-400-normal']) {
      assert(
        fonts.fontFiles.some((file) => file.includes(filename)),
        `Missing offline font ${filename}`,
      );
    }
    await context.setOffline(false);
    report.checks.push(stage);

    stage = 'save workout set and running timer';
    await page.goto(url('/workout?template=upper-a'));
    await page.getByRole('button', { name: 'Start this workout', exact: true }).click();
    await page.getByRole('button', { name: 'Show all sets', exact: true }).click();
    const bench = () => page.locator('.exercise-rail-item').filter({ hasText: 'Smith Machine Bench Press' });
    await bench().click();
    await page.getByLabel('Set 1 weight', { exact: true }).fill('100');
    await page.getByLabel('Set 1 reps', { exact: true }).fill('6');
    await page
      .locator('form.set-editor')
      .first()
      .getByRole('button', { name: 'Complete set', exact: true })
      .click();
    await check(page.locator('.saved-set').first()).toContainText('100 lb × 6 reps');
    await check(page.getByRole('timer')).toBeVisible();
    const timerEnd = await page.evaluate(
      () => JSON.parse(localStorage.getItem('athleticos-rest-timer-v1')).state.end,
    );
    assert(
      Number.isFinite(timerEnd) && timerEnd > Date.now(),
      'Rest timer did not persist a future deadline.',
    );
    report.checks.push(stage);

    stage = 'offline reload, persisted set and timer';
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await check(page.locator('.connection')).toHaveText('Offline');
    assert.equal(await page.evaluate(() => navigator.onLine), false);
    await bench().click();
    await check(page.locator('.saved-set').first()).toContainText('100 lb × 6 reps');
    await check(page.getByRole('timer')).toBeVisible();
    assert.equal(
      await page.evaluate(() => JSON.parse(localStorage.getItem('athleticos-rest-timer-v1')).state.end),
      timerEnd,
      'Reload restarted or lost the rest deadline.',
    );
    await page.getByLabel('Pause timer', { exact: true }).click();
    const paused = await page.getByRole('timer').innerText();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await check(page.getByRole('timer')).toHaveText(paused);
    await check(page.getByLabel('Resume timer', { exact: true })).toBeVisible();
    await checkLayout();
    await page.screenshot({ path: path.join(output, `${name}-offline-workout.png`), fullPage: true });
    await page.getByLabel('Dismiss timer', { exact: true }).click();
    report.checks.push(stage);

    // These lazy routes have not been visited online in this fresh context.
    for (const [route, heading] of [
      ['/coach', 'Coaching'],
      ['/health', 'Your daily foundations'],
      ['/health?tab=mobility', 'A few minutes, done consistently.'],
      ['/health?tab=movement', 'Sitting and movement breaks'],
      ['/profile', 'Profile & settings'],
      ['/progress', 'Exercise performance'],
      ['/schedule', 'Your training week'],
      ['/library', 'Exercise library'],
      ['/train', 'Training'],
      ['/tools', 'Training toolkit.'],
    ]) {
      stage = `offline route ${route}`;
      await page.goto(url(route));
      await check(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await check(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      await checkLayout();
      report.checks.push(stage);
    }
    await page.screenshot({ path: path.join(output, `${name}-offline-tools.png`), fullPage: true });
    report.passed = true;
    console.log(`PASS ${name}: ${report.checks.length} hosted PWA checks`);
  } catch (error) {
    report.failure = { stage, message: error instanceof Error ? error.message : String(error) };
    console.error(`FAIL ${name} (${stage}): ${report.failure.message}`);
    await page
      ?.screenshot({ path: path.join(output, `${name}-failure.png`), fullPage: true })
      .catch(() => {});
  } finally {
    await context?.close();
    await browser?.close();
    reports.push(report);
  }
}

if (!webkitOnly) await verify('chromium-desktop', chromium, { viewport: { width: 1440, height: 1000 } });
if (!chromiumOnly) await verify('webkit-iphone13', webkit, devices['iPhone 13']);
await writeFile(path.join(output, 'report.json'), `${JSON.stringify(reports, null, 2)}\n`);
console.log(`Report and screenshots: ${output}`);
console.log(
  'WebKit emulation checks the web app; physical iPhone installation and OS notification delivery require a separate device check.',
);
if (reports.some((report) => !report.passed)) process.exitCode = 1;
