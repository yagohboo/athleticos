import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.use({
  locale: 'en-US',
  timezoneId: 'America/New_York',
  ...(process.env.PLANNING_BASE_URL ? { baseURL: process.env.PLANNING_BASE_URL } : {}),
});
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-18T17:00:00Z'));
});
async function rows(page: Page, table: string): Promise<Record<string, unknown>[]> {
  return page.evaluate(
    async (name) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const request = indexedDB.open('AthleticOS');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const read = db.transaction(name, 'readonly').objectStore(name).getAll();
          read.onsuccess = () => {
            resolve(read.result as Record<string, unknown>[]);
            db.close();
          };
          read.onerror = () => {
            reject(read.error);
            db.close();
          };
        };
      }),
    table,
  );
}
async function createProtocol(page: Page, name: string, date = '2026-11-18') {
  await page.goto('/#/coach?tab=testing');
  await page.getByRole('button', { name: 'New testing protocol', exact: true }).click();
  await page.getByLabel('Protocol name', { exact: true }).fill(name);
  await page.getByLabel('Planned test date', { exact: true }).fill(date);
  await page.getByLabel('Measurement method', { exact: true }).fill('Tape from line to nearest heel');
  await page.getByLabel('Test surface', { exact: true }).fill('Dry indoor floor');
  await page.getByLabel('Test equipment', { exact: true }).fill('Same tape');
  await page
    .getByLabel('Conditions and technique standard', { exact: true })
    .fill('Two-foot start, stable landing');
  await page.getByLabel('Result to save', { exact: true }).selectOption('median');
  await page.getByRole('button', { name: 'Save testing protocol', exact: true }).click();
  await expect(
    page.locator('.testing-protocol').filter({ has: page.getByRole('heading', { name, exact: true }) }),
  ).toBeVisible();
}

test('rescheduling is previewed and approved, and calendar export contains plans only', async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-11-16T17:00:00Z'));
  await page.goto('/#/schedule');
  await expect(page.getByRole('heading', { name: 'Your training week', exact: true })).toBeVisible();
  const original = await rows(page, 'templates');
  await page.clock.setFixedTime(new Date('2026-11-18T17:00:00Z'));
  await page.reload();
  await page.getByText('Recover an unlogged workout this week', { exact: true }).click();
  await page.getByLabel('Unlogged earlier day', { exact: true }).selectOption('2026-11-16');
  await page.getByLabel('Move to remaining day', { exact: true }).selectOption('2026-11-18');
  await page.getByLabel('Reschedule reason', { exact: true }).fill('Work ran late');
  await page.getByRole('button', { name: 'Preview reschedule', exact: true }).click();
  expect(await rows(page, 'scheduled')).toHaveLength(0);
  await expect(page.locator('.planning-preview')).toContainText('2026-11-16');
  await page.getByRole('button', { name: 'Approve reschedule', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Reschedule approved' })).toBeVisible();
  const changed = await rows(page, 'scheduled');
  expect(changed).toHaveLength(2);
  expect(changed.find((row) => row.date === '2026-11-16')?.templateId).toBeNull();
  expect(changed.find((row) => row.date === '2026-11-18')?.templateId).toBe('upper-a');
  expect(await rows(page, 'templates')).toEqual(original);
  expect(await rows(page, 'sessions')).toHaveLength(0);
  await createProtocol(page, 'Planned jump, repeat; safely', '2026-11-19');
  await page.goto('/#/schedule');
  await page.getByText('Export plans to your calendar', { exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download calendar (.ics)', exact: true }).click();
  const download = await downloadPromise;
  const path = testInfo.outputPath('plans.ics');
  await download.saveAs(path);
  const text = await readFile(path, 'utf8');
  expect(text).toContain('SUMMARY:Testing: Planned jump\\, repeat\\; safely');
  expect(text).toContain('DTSTART;VALUE=DATE:20261119');
  expect(text).toContain('DTEND;VALUE=DATE:20261120');
  expect(await rows(page, 'athleticTests')).toHaveLength(0);
});

test('restart and emphasis previews preserve original program and apply only after approval', async ({
  page,
}) => {
  await page.goto('/#/coach?tab=planning');
  await page.getByRole('button', { name: 'Restart & emphasis', exact: true }).click();
  const original = await rows(page, 'templates');
  await page.getByLabel('Days since your last actual training', { exact: true }).fill('21');
  await page.getByRole('button', { name: 'Preview restart block', exact: true }).click();
  expect(await rows(page, 'trainingBlocks')).toHaveLength(0);
  await expect(page.locator('.planning-preview').first()).toContainText('3 → 2');
  await page.getByRole('button', { name: 'Approve restart block', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Restart block approved' })).toBeVisible();
  expect(await rows(page, 'trainingBlocks')).toHaveLength(1);
  expect(await rows(page, 'templates')).toEqual(original);
  await page.getByLabel('Training emphasis', { exact: true }).selectOption('muscle');
  await page.getByLabel('New program name', { exact: true }).fill('My approved muscle plan');
  await page.getByRole('button', { name: 'Preview emphasis changes', exact: true }).click();
  expect(await rows(page, 'programs')).toHaveLength(1);
  await page.getByRole('button', { name: 'Approve separate program copy', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Separate program copy saved' })).toBeVisible();
  expect(await rows(page, 'programs')).toHaveLength(2);
  expect((await rows(page, 'settings'))[0].activeProgramId).toBe('planet-fitness');
  expect((await rows(page, 'templates')).filter((row) => row.programId === 'planet-fitness')).toEqual(
    original,
  );
  await page.reload();
  await page.getByRole('button', { name: 'Restart & emphasis', exact: true }).click();
  await expect(page.getByLabel('Program for planning', { exact: true })).toContainText(
    'My approved muscle plan',
  );
});

test('testing preserves valid and invalid attempts, rest, median result, and protocol identity', async ({
  page,
}, testInfo) => {
  await createProtocol(page, 'Repeatable broad jump');
  const card = page.locator('.testing-protocol');
  await card.getByRole('button', { name: 'Preparation complete · begin test', exact: true }).click();
  await card.getByLabel('Attempt result (cm)', { exact: true }).fill('200');
  await card.getByRole('button', { name: 'Record attempt', exact: true }).click();
  await expect(card.getByRole('timer')).toContainText('2:00');
  await card.getByLabel('I choose to record before the planned rest ends', { exact: true }).check();
  await card.getByLabel('Attempt validity', { exact: true }).selectOption('invalid');
  await card.getByLabel('Attempt result (cm)', { exact: true }).fill('999');
  await card.getByLabel('Attempt note / invalid reason', { exact: true }).fill('Stepped over the line');
  await card.getByRole('button', { name: 'Record attempt', exact: true }).click();
  await expect(card.locator('tbody tr')).toHaveCount(2);
  await card.getByLabel('I choose to record before the planned rest ends', { exact: true }).check();
  await card.getByLabel('Attempt validity', { exact: true }).selectOption('valid');
  await card.getByLabel('Attempt result (cm)', { exact: true }).fill('210');
  await card.getByRole('button', { name: 'Record attempt', exact: true }).click();
  await expect(card.locator('tbody tr')).toHaveCount(3);
  await expect(card).toContainText('Small sample: fewer than three valid attempts.');
  await page.reload();
  await expect(card.getByRole('timer')).toContainText('2:00');
  await expect(card.locator('tbody tr')).toHaveCount(3);
  await card.getByRole('button', { name: 'Save result to athletic history', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Update saved athletic result', exact: true })).toBeVisible();
  expect(await rows(page, 'athleticTests')).toEqual([
    expect.objectContaining({ value: 205, unit: 'cm', customName: 'Repeatable broad jump' }),
  ]);
  await card.getByRole('button', { name: 'Update saved athletic result', exact: true }).click();
  await expect(card.getByRole('status')).toContainText('Measured result saved');
  expect(await rows(page, 'athleticTests')).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('planning-testing-mobile.png') });
  await card.getByRole('button', { name: 'Repeat this protocol', exact: true }).click();
  await expect(page.locator('.testing-protocol')).toHaveCount(2);
  expect(await rows(page, 'athleticTests')).toHaveLength(1);
});

test('weekly priorities and accepted-versus-applied Coach follow-up persist honestly', async ({ page }) => {
  await page.goto('/#/coach?tab=planning');
  await expect(page.getByText('No completed sessions in this window.', { exact: true })).toBeVisible();
  await page.getByLabel('Priority 1', { exact: true }).fill('Complete and log two comfortable sessions');
  await page.getByLabel('Priority 2 · optional', { exact: true }).fill('Use the same exercise tempo');
  await page
    .getByLabel('Weekly review notes', { exact: true })
    .fill('Review actual work at the end of the week.');
  await page.getByRole('button', { name: 'Save weekly review', exact: true }).click();
  await expect(page.getByText(/Review saved \d/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Priority 1', { exact: true })).toHaveValue(
    'Complete and log two comfortable sessions',
  );
  await page.goto('/#/health?tab=cardio');
  const cardio = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Record a cardio session', exact: true }) });
  await cardio.getByLabel('Duration (minutes)', { exact: true }).fill('10');
  await cardio.getByLabel('Equipment or route', { exact: true }).fill('Park loop');
  await cardio.getByLabel('Conditions, pace or resistance', { exact: true }).fill('Flat comfortable walk');
  await cardio.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(cardio).toContainText('Walking · 10 min');
  await page.goto('/#/coach');
  const insight = page.locator('.insight-card').filter({
    has: page.getByRole('heading', { name: 'Review this week’s recorded aerobic activity', exact: true }),
  });
  await insight.getByRole('button', { name: 'Accept intention', exact: true }).click();
  await expect(insight).toHaveCount(0);
  await page.goto('/#/coach?tab=planning');
  await page.getByRole('button', { name: 'Advice follow-up', exact: true }).click();
  const follow = page.locator('.planning-followup');
  await expect(follow).toContainText('Only your intention was recorded');
  await follow.getByLabel('Application status', { exact: true }).selectOption('applied');
  await follow.getByLabel('Date actually applied', { exact: true }).fill('2026-11-18');
  await follow.getByLabel('Your observed outcome', { exact: true }).selectOption('unclear');
  await follow
    .getByLabel('What you changed and what you noticed', { exact: true })
    .fill('Added a short walk; too early to tell.');
  await follow.getByRole('button', { name: 'Save advice follow-up', exact: true }).click();
  await expect(follow).toContainText('Saved application status: applied');
  await page.reload();
  await page.getByRole('button', { name: 'Advice follow-up', exact: true }).click();
  await expect(follow.getByLabel('Application status', { exact: true })).toHaveValue('applied');
  await expect(follow).toContainText('No matched strength comparison');
});
