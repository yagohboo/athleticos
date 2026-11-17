import { test, expect } from '@playwright/test';

test('logs real sets, edits and undoes them, resumes, and recommends an approved increase', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#/workout?template=upper-a');
  await page.getByRole('button', { name: 'Start this workout' }).click();
  await page.getByRole('button', { name: 'Show all sets', exact: true }).click();
  await page.locator('.exercise-rail-item').filter({ hasText: 'Smith Machine Bench Press' }).click();
  await expect(page.getByLabel('Set 1 weight', { exact: true })).toHaveValue('');
  await page.getByLabel('Set 1 weight', { exact: true }).fill('100');
  await page.getByLabel('Set 1 reps', { exact: true }).fill('6');
  await page.locator('form.set-editor').first().getByRole('button', { name: 'Complete set' }).click();
  await expect(page.locator('.saved-set').first()).toContainText('100 lb × 6 reps');
  await expect(page.getByLabel('Set 2 weight', { exact: true })).toHaveValue('100');
  await page.getByLabel('Dismiss timer', { exact: true }).click();
  await page.reload();
  await page.locator('.exercise-rail-item').filter({ hasText: 'Smith Machine Bench Press' }).click();
  await expect(page.locator('.saved-set').first()).toContainText('100 lb × 6 reps');
  await page.locator('.saved-set').first().getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Set 1 reps', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('.saved-set').first()).toContainText('100 lb × 5 reps');
  await page.getByLabel('Undo set 1', { exact: true }).click();
  await page.getByLabel('Set 1 reps', { exact: true }).fill('6');
  await page.locator('form.set-editor').first().getByRole('button', { name: 'Complete set' }).click();
  await page.getByLabel('Dismiss timer', { exact: true }).click();
  for (const number of [2, 3]) {
    await page.getByLabel(`Set ${number} reps`, { exact: true }).fill('6');
    await page.locator('form.set-editor').first().getByRole('button', { name: 'Complete set' }).click();
    await page.getByLabel('Dismiss timer', { exact: true }).click();
  }
  await page.screenshot({ path: 'artifacts/workout-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByLabel('Session notes', { exact: true }).fill('Clean reps, steady tempo.');
  await page.getByRole('button', { name: 'Finish & save session' }).click();
  await expect(page.getByText('Work put in. Progress earned.')).toBeVisible();
  await expect(page.locator('.completion-card')).toContainText('1,800'.replace(',', '')); // volume uses plain numeric display
  await page.locator('.saved-set').first().getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Set 1 RIR', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.goto('/#/workout?template=upper-a');
  await page.getByRole('button', { name: 'Start this workout' }).click();
  await page.getByRole('button', { name: 'Show all sets', exact: true }).click();
  await page.locator('.exercise-rail-item').filter({ hasText: 'Smith Machine Bench Press' }).click();
  await page.getByText('Previous load & progression', { exact: true }).click();
  await expect(page.locator('.load-insights')).toContainText('105 lb');
  await expect(page.getByLabel('Set 1 weight', { exact: true })).toHaveValue('100');
  await page.getByRole('button', { name: 'Use suggested load' }).click();
  await expect(page.getByLabel('Set 1 weight', { exact: true })).toHaveValue('105');
  await page.getByRole('button', { name: 'Cancel session', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your training', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('production PWA reloads offline with session and timer intact and no horizontal overflow', async ({
  page,
  context,
}) => {
  await page.goto('/#/workout?template=lower-a');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.getByRole('button', { name: 'Start this workout' }).click();
  await page.getByRole('button', { name: 'Show all sets', exact: true }).click();
  await page.getByLabel('Set 1 distance', { exact: true }).fill('1.8');
  await page.locator('form.set-editor').first().getByRole('button', { name: 'Complete set' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.connection')).toHaveText('Offline');
  await expect(page.locator('.saved-set').first()).toContainText('1.8m');
  await expect(page.getByRole('timer')).toBeVisible();
  await page.getByLabel('Pause timer', { exact: true }).click();
  const paused = await page.getByRole('timer').innerText();
  await page.reload();
  await expect(page.getByRole('timer')).toHaveText(paused);
  await page.getByLabel('Dismiss timer', { exact: true }).click();
  for (const route of [
    '/#/',
    '/#/workout',
    '/#/progress',
    '/#/schedule',
    '/#/profile',
    '/#/library',
    '/#/train',
    '/#/coach',
    '/#/health',
    '/#/tools',
  ]) {
    await page.goto(route);
    await expect(page.locator('main')).not.toContainText('Something needs attention');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await context.setOffline(false);
});
