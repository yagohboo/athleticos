import { test, expect } from '@playwright/test';

test.use({ locale: 'en-US', timezoneId: 'America/New_York' });

test.beforeEach(async ({ page }) => {
  // A fixed Monday makes calendar assertions independent of the machine's weekday.
  await page.clock.setFixedTime(new Date('2026-11-16T17:00:00.000Z'));
});

test('custom exercise creation, searching and editing persist across reloads', async ({ page }) => {
  await page.goto('/#/library');
  await page.getByRole('button', { name: 'Custom exercise', exact: true }).click();
  await page.getByLabel('Exercise name', { exact: true }).fill('My Cable Row');
  await page.getByLabel('Equipment', { exact: true }).fill('Cable station 1');
  await page.getByLabel('Movement pattern', { exact: true }).fill('Horizontal pull');
  await page.getByLabel('Primary muscles, separated by commas').fill('Back, Biceps');
  await page
    .getByLabel('Step-by-step instructions')
    .fill('Sit tall with feet braced.\nPull the handle to your ribs.\nReturn with control.');
  await page.getByRole('button', { name: 'Save exercise', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Cable Row', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'My Cable Row', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit details', exact: true }).click();
  await page.getByLabel('Exercise name', { exact: true }).fill('My Controlled Cable Row');
  await page.getByRole('button', { name: 'Save exercise', exact: true }).click();
  await page.getByRole('button', { name: 'All exercises', exact: true }).click();
  await page.getByLabel('Search exercises', { exact: true }).fill('Controlled');
  await expect(page.locator('.exercise-library-item')).toHaveCount(1);
  await expect(page.locator('.exercise-library-item')).toContainText('My Controlled Cable Row');
  await page.reload();
  await page.getByLabel('Search exercises', { exact: true }).fill('Controlled');
  await expect(page.locator('.exercise-library-item')).toHaveCount(1);
});

test('program copies and prescription edits stay separate from the original program', async ({ page }) => {
  await page.goto('/#/schedule');
  await page.getByRole('button', { name: 'Edit program', exact: true }).click();
  await page.getByRole('button', { name: 'New program', exact: true }).click();
  const createForm = page.locator('.program-create');
  await createForm.getByLabel('Program name', { exact: true }).fill('My strength block');
  await createForm.getByRole('button', { name: 'Create program', exact: true }).click();
  await expect(page.locator('.program-create')).toHaveCount(0);
  await expect(page.getByLabel('Program name', { exact: true })).toHaveValue('My strength block');
  await page.getByRole('button', { name: 'Edit Monday routine', exact: true }).click();
  await page.getByLabel('Routine name', { exact: true }).fill('My Upper A');
  const first = page.locator('.prescription-editor').first();
  await first.getByLabel('Max reps', { exact: true }).fill('6');
  await first.getByLabel('Min reps', { exact: true }).fill('5');
  await first.getByLabel('Sets', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Save routine', exact: true }).click();
  await expect(page.locator('.routine-list')).toContainText('My Upper A');
  await page.reload();
  await page.getByRole('button', { name: 'Edit program', exact: true }).click();
  await expect(page.locator('.routine-list')).toContainText('My Upper A');
  await page.getByRole('button', { name: 'Edit Monday routine', exact: true }).click();
  await expect(page.locator('.prescription-editor').first().getByLabel('Sets', { exact: true })).toHaveValue(
    '2',
  );
  await page.getByRole('button', { name: 'Close routine editor', exact: true }).click();
  await page.getByLabel('Active training program').selectOption('planet-fitness');
  await expect(page.getByLabel('Program name', { exact: true })).toHaveValue(
    'Athletic Strength & Physique — Planet Fitness',
  );
  await page.getByRole('button', { name: 'Edit Monday routine', exact: true }).click();
  await expect(page.getByLabel('Routine name', { exact: true })).toHaveValue('Upper A · Power + Strength');
  await expect(page.locator('.prescription-editor').first().getByLabel('Sets', { exact: true })).toHaveValue(
    '3',
  );
  await page.goto('/#/train?plans=1');
  const plans = page.getByRole('dialog', { name: 'Saved plans' });
  await plans.getByRole('button', { name: 'My strength block', exact: true }).click();
  const card = page.getByRole('region', { name: 'Workout for today' });
  await expect(card).toContainText('My Upper A');
  await expect(card).toContainText('My strength block');
  await page.reload();
  await card.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('My Upper A');
  const sessionUrl = page.url();
  await page.goto('/#/train?plans=1');
  await expect(
    plans.getByRole('button', { name: 'Athletic Strength & Physique — Planet Fitness', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await card.getByRole('link', { name: 'Resume session', exact: true }).click();
  await expect(page).toHaveURL(sessionUrl);
});

test('one-off rescheduling moves an occurrence and preserves the following week', async ({ page }) => {
  await page.goto('/#/schedule');
  await expect(
    page.locator('.selected-day').getByRole('heading', { name: 'Upper A · Power + Strength', exact: true }),
  ).toBeVisible();
  await page.getByText('Adjust this date', { exact: true }).click();
  await page.getByLabel('Move this workout to', { exact: true }).fill('2026-11-22');
  await page.getByRole('button', { name: 'Move workout', exact: true }).click();
  await expect(page.locator('.selected-day')).toContainText('Sunday, November 22');
  await expect(
    page.locator('.selected-day').getByRole('heading', { name: 'Upper A · Power + Strength', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Monday, November 16: Rest, Rest/ }).click();
  await expect(
    page.locator('.selected-day').getByRole('heading', { name: 'Rest & recharge', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Monday, November 23: Upper A/ }).click();
  await expect(
    page.locator('.selected-day').getByRole('heading', { name: 'Upper A · Power + Strength', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator('.selected-day').getByRole('heading', { name: 'Rest & recharge', exact: true }),
  ).toBeVisible();
});

test('a completed old program does not mark a copied plan complete', async ({ page }) => {
  await page.goto('/#/workout?template=upper-a');
  await page.getByRole('button', { name: 'Start this workout' }).click();
  await page.locator('form.set-editor').first().getByRole('button', { name: 'Complete set' }).click();
  await page.getByLabel('Dismiss timer', { exact: true }).click();
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('button', { name: 'Finish & save session' }).click();
  await expect(page.getByText('Work put in. Progress earned.')).toBeVisible();
  await page.goto('/#/schedule');
  await expect(page.locator('.schedule-stats .stat').first().locator('strong')).toHaveText('1 / 4');
  await page.getByRole('button', { name: 'Edit program', exact: true }).click();
  await page.getByRole('button', { name: 'New program', exact: true }).click();
  await page.locator('.program-create').getByLabel('Program name').fill('Fresh plan');
  await page.locator('.program-create').getByRole('button', { name: 'Create program' }).click();
  await expect(page.locator('.program-create')).toHaveCount(0);
  await expect(page.getByLabel('Program name', { exact: true })).toHaveValue('Fresh plan');
  await page.getByRole('button', { name: 'Back to calendar' }).click();
  await expect(page.locator('.schedule-stats .stat').first().locator('strong')).toHaveText('0 / 4');
  await expect(page.getByRole('button', { name: /Monday, November 16: Upper A.*Training/ })).toBeVisible();
});
