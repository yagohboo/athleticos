/* global navigator, indexedDB */
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit, devices, expect } from '@playwright/test';

const fromV31 = process.argv.includes('--from-v31');
const fromV3 = process.argv.includes('--from-v3') || fromV31;
assert(!(fromV31 && process.argv.includes('--from-v3')), 'Choose one historical baseline.');
const chromiumOnly = process.argv.includes('--chromium-only');
const webkitOnly = process.argv.includes('--webkit-only');
assert(!(chromiumOnly && webkitOnly), 'Choose one engine restriction or neither for both engines.');
const sourceVersion = fromV31 ? '3.1.0' : fromV3 ? '3.0.0' : '2.0.0';
const targetVersion = '3.2.0';
const oldRoot = path.resolve(
  fromV31 ? 'artifacts/baseline-v31' : fromV3 ? 'artifacts/baseline-v3' : 'artifacts/baseline-v2',
);
const newRoot = path.resolve('dist');
await stat(path.join(oldRoot, 'sw.js'));
await stat(path.join(newRoot, 'sw.js'));
const output = path.resolve('artifacts/release-upgrade', new Date().toISOString().replaceAll(/[:.]/g, '-'));
await mkdir(output, { recursive: true });
let stage = 'old';
const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (!url.pathname.startsWith('/athleticos/')) {
      response.writeHead(404).end();
      return;
    }
    const relative = decodeURIComponent(url.pathname.slice('/athleticos/'.length)) || 'index.html';
    if (relative.split(/[\\/]/).some((part) => part.startsWith('.'))) {
      response.writeHead(404).end();
      return;
    }
    const root = stage === 'old' ? oldRoot : newRoot;
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep)) {
      response.writeHead(404).end();
      return;
    }
    let body = await readFile(target);
    if (stage === 'next' && relative === 'sw.js')
      body = Buffer.concat([body, Buffer.from('\n// upgrade-check-next-revision\n')]);
    response.writeHead(200, {
      'Content-Type': mime[path.extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/athleticos/`;
const check = expect.configure({ timeout: 20000 });
const results = [];

async function selectBench(page) {
  // Newer releases default to one visible set; reveal saved rows through the real control.
  const exercise = page.locator('.exercise-rail-item').filter({ hasText: 'Smith Machine Bench Press' });
  await exercise.waitFor({ state: 'attached' });
  const showAll = page.getByRole('button', { name: 'Show all sets', exact: true });
  if (await showAll.isVisible()) {
    await showAll.click();
    await check(exercise).toBeVisible();
  } else if (!(await exercise.isVisible())) {
    const plan = page.locator('.session-plan-disclosure > summary');
    if (await plan.isVisible()) await plan.click();
  }
  await exercise.click();
}

async function readDatabase(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('AthleticOS');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const names = Array.from(database.objectStoreNames);
          const transaction = database.transaction(names, 'readonly');
          const tables = {};
          for (const name of names) {
            const query = transaction.objectStore(name).getAll();
            query.onsuccess = () => {
              tables[name] = query.result;
            };
          }
          transaction.oncomplete = () => {
            const version = database.version;
            database.close();
            resolve({ version, tables });
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
  );
}
async function verify(label, type, device) {
  stage = 'old';
  const browser = await type.launch({ headless: true });
  const context = await browser.newContext({ ...device, serviceWorkers: 'allow' });
  let page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const report = { browser: label, sourceVersion, targetVersion, passed: false, checks: [] };
  try {
    await page.goto(`${base}#/workout?template=upper-a`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.getByRole('button', { name: 'Start this workout', exact: true }).click();
    await selectBench(page);
    await page.getByLabel('Set 1 weight', { exact: true }).fill('100');
    await page.getByLabel('Set 1 reps', { exact: true }).fill('6');
    await page
      .locator('form.set-editor')
      .first()
      .getByRole('button', { name: 'Complete set', exact: true })
      .click();
    await check(page.locator('.saved-set').first()).toContainText('100 lb × 6 reps');
    // Fixture writes touch only this disposable browser using the selected published baseline.
    await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open('AthleticOS');
          request.onsuccess = () => {
            const database = request.result;
            const transaction = database.transaction(
              ['profiles', 'templates', 'bodyweights', 'nutrition', 'photos'],
              'readwrite',
            );
            for (const [table, id, change] of [
              ['profiles', 'main', { name: 'Upgrade retention athlete' }],
              ['templates', 'upper-a', { name: 'My preserved custom upper day' }],
            ]) {
              const store = transaction.objectStore(table);
              const query = store.get(id);
              query.onsuccess = () => store.put({ ...query.result, ...change });
            }
            transaction.objectStore('bodyweights').put({
              id: 'upgrade-weight',
              date: '2026-11-13',
              weightKg: 99,
              notes: 'Keep this measurement',
              createdAt: '2026-11-13T10:00:00.000Z',
            });
            transaction.objectStore('nutrition').put({
              id: 'upgrade-meal',
              date: '2026-11-13',
              name: 'Saved meal',
              calories: 500,
              protein: 40,
              carbs: 50,
              fat: 15,
              createdAt: '2026-11-13T10:00:00.000Z',
            });
            transaction.objectStore('photos').put({
              id: 'upgrade-photo',
              date: '2026-11-13',
              label: 'Saved original photo',
              dataUrl:
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1cAAAAASUVORK5CYII=',
              createdAt: '2026-11-13T10:00:00.000Z',
            });
            transaction.oncomplete = () => {
              database.close();
              resolve();
            };
            transaction.onerror = () => reject(transaction.error);
          };
          request.onerror = () => reject(request.error);
        }),
    );
    let before = await readDatabase(page);
    assert.equal(before.version, fromV3 ? 60 : 50, 'Fixture must use the previously published database.');
    const originalSessionId = before.tables.sessions.find((row) => row.status === 'active').id;
    report.checks.push(
      `Published ${sourceVersion} saved workout, customized profile/program, measurement, meal and photo`,
    );
    stage = 'new';
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration()).update();
    });
    if (fromV3) {
      await check(page.getByRole('button', { name: 'Update after this session', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Update after this session', exact: true }).click();
      await check(page.getByRole('button', { name: 'Cancel queued update', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Cancel queued update', exact: true }).click();
      await page.getByRole('button', { name: 'Finish', exact: true }).click();
      await page.getByRole('button', { name: 'Finish & save session', exact: true }).click();
      await check(page.getByRole('button', { name: 'Finish', exact: true })).toHaveCount(0);
      // Keep an actual old-release draft, including its original field keys, across the update.
      await page.goto(`${base}#/profile${fromV31 ? '?section=personal' : ''}`);
      await page
        .getByLabel('Your name', { exact: true })
        .fill(`Preserved unfinished ${sourceVersion} profile`);
      await check(page.locator('.draft-recovery summary')).toContainText('unfinished');
      await page.goto(`${base}#/workout?session=${originalSessionId}`);
      before = await readDatabase(page);
      report.checks.push(`Previously published ${sourceVersion} correctly defers while a workout is active`);
    }
    await check(page.getByRole('button', { name: 'Update app', exact: true })).toBeVisible();
    await Promise.all([
      page.waitForEvent('framenavigated', { predicate: (frame) => frame === page.mainFrame() }),
      page.getByRole('button', { name: 'Update app', exact: true }).click(),
    ]);
    await check(page.locator('.reliability-strip')).toBeVisible();
    const after = await readDatabase(page);
    assert.equal(after.version, 60);
    for (const [name, rows] of Object.entries(before.tables)) {
      if (name === 'recoverySnapshots') continue;
      assert.deepEqual(after.tables[name], rows, `${name} changed during release upgrade`);
    }
    if (!fromV3) assert(after.tables.recoverySnapshots.some((row) => row.id === 'before-v3-upgrade'));
    report.checks.push(
      `True service-worker replacement preserved all ${Object.keys(before.tables).filter((name) => name !== 'recoverySnapshots').length} original data tables exactly`,
    );
    if (fromV3) {
      await page.goto(`${base}#/profile?section=personal`);
      await check(page.getByLabel('Your name', { exact: true })).toBeVisible();
      await page.locator('.draft-recovery summary').click();
      await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
      await check(page.getByLabel('Your name', { exact: true })).toHaveValue(
        `Preserved unfinished ${sourceVersion} profile`,
      );
      await page.getByRole('button', { name: 'Discard draft', exact: true }).click();
      await check(page.getByLabel('Your name', { exact: true })).toHaveValue('Upgrade retention athlete');
      report.checks.push(
        `A real ${sourceVersion} profile draft restores inside the reorganized profile and discards safely`,
      );
      await page.goto(`${base}#/workout?template=upper-a`);
      await page.getByRole('button', { name: 'Start this workout', exact: true }).click();
      await check(page.getByRole('button', { name: 'Finish', exact: true })).toBeVisible();
      await selectBench(page);
      await page.getByLabel('Set 1 weight', { exact: true }).fill('100');
      await page.getByLabel('Set 1 reps', { exact: true }).fill('6');
      await page
        .locator('form.set-editor')
        .first()
        .getByRole('button', { name: 'Complete set', exact: true })
        .click();
      await check(page.locator('.saved-set').first()).toContainText('100 lb × 6 reps');
    }
    const retainedSetCount = (await readDatabase(page)).tables.sets.length;
    await selectBench(page);
    await check(page.locator('.saved-set').first()).toContainText('100 lb × 6 reps');
    await context.setOffline(true);
    await page.reload();
    await selectBench(page);
    await check(page.locator('.saved-set').first()).toContainText('100 lb × 6 reps');
    await check(page.locator('.connection')).toHaveText('Offline');
    report.checks.push('Upgraded installation reloads offline with old workout intact');
    await page.getByLabel('Set 2 reps', { exact: true }).fill('7');
    await check(page.locator('.draft-recovery summary')).toContainText('unfinished');
    await page.reload();
    await selectBench(page);
    await page.locator('.draft-recovery summary').click();
    await page.getByRole('button', { name: 'Restore draft', exact: true }).first().click();
    await check(page.getByLabel('Set 2 reps', { exact: true })).toHaveValue('7');
    report.checks.push('Unfinished set draft recovers after an offline restart');
    await context.setOffline(false);
    stage = 'next';
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration()).update();
    });
    await check(page.getByRole('button', { name: 'Update after this session', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Update after this session', exact: true }).click();
    await check(page.getByRole('button', { name: 'Cancel queued update', exact: true })).toBeVisible();
    await check(page.getByLabel('Set 2 reps', { exact: true })).toHaveValue('7');
    await page.getByRole('button', { name: 'Cancel queued update', exact: true }).click();
    report.checks.push('Subsequent update waits for active training/unfinished fields without reloading');
    const other = await context.newPage();
    await other.goto(`${base}#/profile?section=personal`);
    await check(other.getByText('This window is read-only.', { exact: true })).toBeVisible();
    await page.close();
    page = other;
    await Promise.all([
      page.waitForEvent('framenavigated', { predicate: (frame) => frame === page.mainFrame() }),
      page.getByRole('button', { name: 'Use this window', exact: true }).click(),
    ]);
    await page.waitForLoadState('domcontentloaded');
    await check(page.getByRole('heading', { name: 'Personal profile', exact: true })).toBeVisible();
    await check(page.locator('.editing-notice')).toHaveCount(0);
    assert.equal((await readDatabase(page)).tables.sets.length, retainedSetCount);
    report.checks.push('Only one window can edit; closing it permits explicit safe takeover');
    await page.goto(`${base}#/workout`);
    await page.getByRole('button', { name: 'Finish', exact: true }).click();
    await page.getByRole('button', { name: 'Finish & save session', exact: true }).click();
    await check(page.getByRole('button', { name: 'Finish', exact: true })).toHaveCount(0);
    const beforeSafeUpdate = await readDatabase(page);
    await check(page.getByRole('button', { name: 'Update app', exact: true })).toBeVisible();
    await Promise.all([
      page.waitForEvent('framenavigated', { predicate: (frame) => frame === page.mainFrame() }),
      page.getByRole('button', { name: 'Update app', exact: true }).click(),
    ]);
    await check(page.locator('.reliability-strip')).toBeVisible();
    const afterSafeUpdate = await readDatabase(page);
    for (const [name, rows] of Object.entries(beforeSafeUpdate.tables)) {
      if (['recoverySnapshots', 'drafts'].includes(name)) continue;
      assert.deepEqual(afterSafeUpdate.tables[name], rows, `${name} changed during safe update`);
    }
    assert(afterSafeUpdate.tables.recoverySnapshots.some((row) => row.reason === 'Before app update'));
    report.checks.push(
      'Finished-session update saves a recovery copy, activates, and preserves all saved records',
    );
    await page.goto(`${base}#/profile?section=updates`);
    await check(page.getByRole('heading', { name: 'App updates', exact: true })).toBeVisible();
    await check(page.getByText(`AthleticOS ${targetVersion}`, { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(output, `${label}-upgraded.png`), fullPage: true });
    assert.deepEqual(errors, []);
    report.passed = true;
    console.log(`PASS ${label}: ${report.checks.length} update-retention workflows`);
  } catch (error) {
    report.error = error.stack ?? String(error);
    console.error(`FAIL ${label}: ${error.message}`);
    await page.screenshot({ path: path.join(output, `${label}-failed.png`), fullPage: true }).catch(() => {});
  } finally {
    await context.close();
    await browser.close();
    results.push(report);
  }
}
try {
  if (!webkitOnly) await verify('chromium', chromium, { viewport: { width: 390, height: 844 } });
  if (!chromiumOnly) await verify('webkit-iphone13', webkit, devices['iPhone 13']);
} finally {
  await new Promise((resolve) => server.close(resolve));
}
await writeFile(path.join(output, 'report.json'), JSON.stringify(results, null, 2));
console.log(`Evidence: ${output}`);
if (results.some((result) => !result.passed)) process.exitCode = 1;
