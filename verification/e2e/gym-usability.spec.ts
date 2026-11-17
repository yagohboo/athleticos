import { test, expect, type Page } from '@playwright/test';

async function startFocused(page: Page) {
  await page.goto('/#/workout?template=upper-a');
  const start = page.getByRole('button', { name: 'Start this workout', exact: true });
  const position = await start.boundingBox();
  expect(position).not.toBeNull();
  expect(position!.y + position!.height).toBeLessThan(page.viewportSize()!.height - 65);
  await start.click();
  await page
    .getByRole('combobox', { name: 'Current exercise', exact: true })
    .selectOption({ label: '2. Smith Machine Bench Press · 0/3 saved' });
}

test('a workout starts above the long preview and logs one set with optional tools closed', async ({
  page,
}, testInfo) => {
  await startFocused(page);
  await expect(page.getByRole('button', { name: 'Show all sets', exact: true })).toBeVisible();
  await expect(page.locator('form.set-editor:visible')).toHaveCount(1);
  await expect(page.locator('.workout-options')).not.toHaveAttribute('open');
  await page.screenshot({ path: testInfo.outputPath('workout-focused.png') });
  await page.getByLabel('Set 1 weight', { exact: true }).fill('100');
  await expect(page.getByLabel('Set 1 weight', { exact: true })).toHaveValue('100');
  await page.getByLabel('Set 1 reps', { exact: true }).fill('6');
  await page.getByRole('button', { name: 'Complete set', exact: true }).click();
  await page.getByLabel('Dismiss timer', { exact: true }).click();
  await expect(page.locator('form.set-editor:visible')).toHaveCount(1);
  await expect(page.locator('form.set-editor:visible')).toContainText('Set 2');
  await page.getByRole('button', { name: 'Show all sets', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Focus on next set', exact: true })).toBeVisible();
  await expect(page.locator('.session-plan-disclosure')).toBeVisible();
  await expect(page.locator('.saved-set').first()).toContainText('100 lb × 6 reps');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Focus on next set', exact: true })).toBeVisible();
  await page.locator('.exercise-rail-item').filter({ hasText: 'Smith Machine Bench Press' }).click();
  await expect(page.locator('.saved-set').first()).toContainText('100 lb × 6 reps');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('workout-all-sets.png') });
});

test('switching workout views keeps typed input and structural edits cannot overwrite it', async ({
  page,
}) => {
  await startFocused(page);
  await page.getByLabel('Set 1 weight', { exact: true }).fill('95');
  await page.getByLabel('Set 1 reps', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Show all sets', exact: true }).click();
  await expect(page.getByLabel('Set 1 weight', { exact: true })).toHaveValue('95');
  await page.getByRole('button', { name: 'Focus on next set', exact: true }).click();
  await expect(page.getByLabel('Set 1 reps', { exact: true })).toHaveValue('5');
  await page.getByText('Exercise tools & adjustments', { exact: true }).click();
  await page.getByText('Insert warm-up ramp', { exact: true }).click();
  await page.getByLabel('Working target for ramp (lb)', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Preview warm-up rows', exact: true }).click();
  await page.getByRole('button', { name: 'Approve and insert warm-up rows', exact: true }).click();
  await expect(
    page.getByText('Save or discard unfinished set edits for this exercise before changing its rows.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel('Set 1 weight', { exact: true })).toHaveValue('95');
  await expect(page.locator('form.set-editor')).toHaveCount(3);
});

test('Train opens today’s completed session instead of suggesting a duplicate start', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-16T15:00:00Z'));
  await startFocused(page);
  await page.getByLabel('Set 1 weight', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Complete set', exact: true }).click();
  await page.getByLabel('Dismiss timer', { exact: true }).click();
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('button', { name: 'Finish & save session', exact: true }).click();
  await expect(page.getByText('Work put in. Progress earned.', { exact: true })).toBeVisible();
  // Fresh installs have no selected program. Choosing the existing starter
  // through its normal editor must activate it without changing saved sessions.
  await page.goto('/#/schedule');
  await page.getByRole('button', { name: 'Edit program', exact: true }).click();
  const programChoice = page.getByRole('combobox', { name: 'Active training program', exact: true });
  await expect(programChoice).toHaveValue('');
  await programChoice.selectOption('planet-fitness');
  await expect(programChoice).toHaveValue('planet-fitness');
  await expect(programChoice).toBeEnabled();
  await page.goto('/#/train');
  await expect(page.getByRole('link', { name: 'View completed session', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'View completed session', exact: true }).click();
  await expect(page.getByText('Work put in. Progress earned.', { exact: true })).toBeVisible();
});

test('a workout draft keeps its original measurement unit across settings changes', async ({ page }) => {
  await startFocused(page);
  const workoutUrl = page.url();
  await page.getByLabel('Set 1 weight', { exact: true }).fill('95');
  await page.getByLabel('Set 1 reps', { exact: true }).fill('5');
  await expect(page.locator('.draft-recovery summary')).toContainText('unfinished');

  async function switchUnit(unit: 'lb' | 'kg') {
    await page.goto('/#/profile?section=settings');
    await page.getByLabel('Weight unit', { exact: true }).selectOption(unit);
    await page.getByRole('button', { name: 'Save settings', exact: true }).click();
    await expect(page.getByLabel(`Upper-body increment (${unit})`, { exact: true })).toBeVisible();
    await page.goto(workoutUrl);
    await page.getByRole('combobox', { name: 'Current exercise', exact: true }).selectOption({
      label: '2. Smith Machine Bench Press · 0/3 saved',
    });
    await page.locator('.draft-recovery summary').click();
    await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  }

  await switchUnit('kg');
  await expect(
    page.getByText(
      'This draft uses different measurement units. Switch back to the units used for the draft before restoring it.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel('Set 1 weight', { exact: true })).not.toHaveValue('95');
  await expect(page.locator('.draft-recovery')).toBeVisible();
  await switchUnit('lb');
  await expect(page.getByLabel('Set 1 weight', { exact: true })).toHaveValue('95');
  await expect(page.getByLabel('Set 1 reps', { exact: true })).toHaveValue('5');
  await page.getByRole('button', { name: 'Complete set', exact: true }).click();
  await page.getByLabel('Dismiss timer', { exact: true }).click();
  await page.getByRole('button', { name: 'Show all sets', exact: true }).click();
  await expect(page.locator('.saved-set').first()).toContainText('95 lb × 5 reps');
});
