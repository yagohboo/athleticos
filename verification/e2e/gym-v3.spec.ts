import { test, expect } from '@playwright/test';

async function begin(page: import('@playwright/test').Page) {
  await page.goto('/#/workout?template=upper-a');
  await page.getByRole('button', { name: 'Start this workout', exact: true }).click();
  await page.getByRole('button', { name: 'Show all sets', exact: true }).click();
  await page.locator('.exercise-rail-item').filter({ hasText: 'Smith Machine Bench Press' }).click();
}
async function open(page: import('@playwright/test').Page, title: string) {
  const tools = page.locator('.workout-options');
  if ((await tools.count()) && (await tools.getAttribute('open')) === null)
    await tools.locator(':scope > summary').click();
  const summary = page.locator('summary').filter({ hasText: title }).first();
  await summary.click();
  return summary.locator('..');
}

test('time budgets preserve priorities and machine profiles keep exact setup history', async ({ page }) => {
  await page.goto('/#/workout?template=upper-a');
  const budget = await open(page, 'Time budget');
  await budget.getByLabel('Available workout time').selectOption('45');
  await budget.getByRole('button', { name: 'Approve time-budget preview' }).click();
  await expect(budget).toContainText('Approved for the next start');
  await page.getByRole('button', { name: 'Start this workout', exact: true }).click();
  await page.getByRole('button', { name: 'Show all sets', exact: true }).click();
  await page.locator('.exercise-rail-item').filter({ hasText: 'Smith Machine Bench Press' }).click();
  const machine = await open(page, 'Exact machine & setup profiles');
  await machine.getByRole('button', { name: 'Create machine profile' }).click();
  await machine.getByLabel('Machine name / ID').fill('Smith A');
  await machine.getByLabel('Gym location').fill('Main gym');
  await machine.getByLabel('Seat setting').fill('2');
  await machine.getByLabel('Pad setting').fill('3');
  await machine.getByLabel('Grip / attachment').fill('Medium');
  await machine.getByLabel('Starting resistance (lb)').fill('20');
  await machine.getByRole('button', { name: 'Save exact machine profile' }).click();
  await machine.getByRole('button', { name: 'Use Smith A', exact: true }).click();
  await expect(page.locator('.exercise-focus h2')).toHaveText('Smith Machine Bench Press · Smith A');
  const notes = await open(page, 'Pinned setup notes');
  await notes.getByRole('button', { name: 'Add favorite', exact: true }).click();
  await expect(notes.getByRole('button', { name: 'Remove favorite', exact: true })).toBeVisible();
  await notes.getByLabel('Pinned setup notes').fill('Use the medium hooks');
  await notes.getByRole('button', { name: 'Save pinned notes' }).click();
  await expect(page.getByText('Setup notes pinned.', { exact: true })).toBeVisible();
  await page.reload();
  await page
    .locator('.exercise-rail-item')
    .filter({ hasText: 'Smith Machine Bench Press · Smith A' })
    .click();
  await expect(page.getByText('Use the medium hooks', { exact: false }).first()).toBeVisible();
  await page.goto('/#/library');
  await page.getByRole('button', { name: 'Favorites', exact: true }).click();
  await expect(page.locator('.exercise-library-item')).toHaveCount(1);
  await expect(page.locator('.exercise-library-item')).toContainText('Smith A');
});

test('warmup ramps, confirmed quick entry, measured rest and focused mode survive reload', async ({
  page,
}) => {
  await begin(page);
  const ramp = await open(page, 'Insert warm-up ramp');
  await ramp.getByLabel('Working target for ramp (lb)').fill('100');
  await ramp.getByRole('button', { name: 'Preview warm-up rows' }).click();
  await ramp.getByRole('button', { name: 'Approve and insert warm-up rows' }).click();
  await expect(page.locator('form.set-editor')).toHaveCount(7);
  await expect(page.locator('.exercise-focus-top')).toContainText('3 sets × 4–6');
  await page.getByRole('button', { name: 'Focus on next set', exact: true }).click();
  let row = page.locator('form.set-editor:visible').first();
  await expect(page.locator('form.set-editor:visible')).toHaveCount(1);
  await row.getByRole('button', { name: 'Start this set', exact: true }).click();
  await row.locator('summary').filter({ hasText: 'Quick text log' }).click();
  await row.getByLabel('Quick set text').fill('40 x 8, 4 RIR');
  await row.getByRole('button', { name: 'Preview quick set' }).click();
  await row.getByRole('button', { name: 'Confirm and log quick set' }).click();
  await page.getByLabel('Dismiss timer', { exact: true }).click();
  row = page.locator('form.set-editor:visible').first();
  await expect(row).toContainText('Set 2');
  await row.getByRole('button', { name: 'Start this set', exact: true }).click();
  await expect(row).toContainText('Rest before this set:');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Show all sets', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show all sets', exact: true }).click();
  await page.locator('.exercise-rail-item').filter({ hasText: 'Smith Machine Bench Press' }).click();
  await expect(page.locator('.saved-set').first()).toContainText('40 lb × 8 reps');
});

test('superset alternates with distinct rest and approved remaining loads preserve completed work', async ({
  page,
}) => {
  await begin(page);
  const groups = await open(page, 'Superset / circuit sequencing');
  await groups.getByLabel('Smith Machine Bench Press', { exact: true }).check();
  await groups.getByLabel('Chest-Supported Row Machine', { exact: true }).check();
  await groups.getByRole('button', { name: 'Save sequencing group' }).click();
  await page.getByLabel('Set 1 weight', { exact: true }).fill('100');
  await page.getByLabel('Set 1 reps', { exact: true }).fill('6');
  await page
    .locator('form.set-editor')
    .first()
    .getByRole('button', { name: 'Complete set', exact: true })
    .click();
  await expect(page.locator('.exercise-focus h2')).toHaveText('Chest-Supported Row Machine');
  await page.getByLabel('Dismiss timer', { exact: true }).click();
  await page.getByLabel('Set 1 weight', { exact: true }).fill('80');
  await page
    .locator('form.set-editor')
    .first()
    .getByRole('button', { name: 'Start this set', exact: true })
    .click();
  await page
    .locator('form.set-editor')
    .first()
    .getByRole('button', { name: 'Complete set', exact: true })
    .click();
  await expect(page.locator('.exercise-focus h2')).toHaveText('Smith Machine Bench Press');
  await page.getByLabel('Dismiss timer', { exact: true }).click();
  const adjust = await open(page, 'Trial calibration & remaining-set adjustment');
  await adjust.getByLabel('Remaining load (lb)').fill('90');
  await adjust.getByRole('button', { name: 'Preview remaining-set change' }).click();
  await adjust.getByRole('button', { name: 'Approve remaining targets' }).click();
  await expect(page.getByLabel('Set 2 weight', { exact: true })).toHaveValue('90');
  await expect(page.locator('.saved-set').first()).toContainText('100 lb × 6 reps');
  const busy = await open(page, 'Occupied equipment & alternatives');
  await busy.getByLabel('This equipment is occupied').check();
  await busy.getByRole('button', { name: 'Approve available exercises first' }).click();
  await expect(page.locator('.exercise-rail-item').last()).toContainText('Smith Machine Bench Press');
});

test('plate quantities persist and offline technique steps remain navigable', async ({ page }) => {
  await page.goto('/#/tools');
  await page.getByLabel('Target total resistance (lb)').fill('100');
  await page.getByLabel('Starting bar resistance (lb)').fill('0');
  await page.getByLabel('Available plates (lb:quantity, comma-separated)').fill('45:1, 25:2, 10:2');
  await expect(page.getByText('70 lb total', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Save plate inventory' }).click();
  await expect(page.getByText('Plate quantities saved for this unit.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Available plates (lb:quantity, comma-separated)')).toHaveValue(
    '45:1, 25:2, 10:2',
  );
  await page.goto('/#/library?exercise=smith-bench');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // An active registration need not control this already-open page; reload into its scope first.
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.context().setOffline(true);
  await page.reload();
  const steps = await open(page, 'Offline step-by-step technique');
  await expect(steps).toContainText('STEP 1 OF');
  await steps.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(steps).toContainText('STEP 2 OF');
  await expect(steps.getByRole('img')).toBeVisible();
});
