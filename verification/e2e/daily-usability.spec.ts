import { test, expect } from '@playwright/test';

test('daily logging stays first and a past chart range cannot hide a meal just saved', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-14T17:00:00Z'));
  await page.goto('/#/progress?tab=nutrition');
  const food = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Quick add or log a meal', exact: true }) });
  await expect(food).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Four-week nutrition review', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Log a meal', exact: true }).click();
  await expect(food.getByLabel('Meal name', { exact: true })).toBeFocused();
  await page.locator('.progress-history-filter > summary').click();
  await page.getByLabel('History range', { exact: true }).selectOption('custom');
  await page.getByLabel('From date', { exact: true }).fill('2020-01-01');
  await page.getByLabel('Through date', { exact: true }).fill('2020-01-31');
  await food.getByLabel('Meal name', { exact: true }).fill('Visible current meal');
  await food.getByLabel('Calories (kcal)', { exact: true }).fill('450');
  await food.getByLabel('Protein (g)', { exact: true }).fill('30');
  await food.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(food.getByRole('button', { name: 'Edit Visible current meal', exact: true })).toBeVisible();
  await expect(page.locator('.nutrition-target').first()).toContainText('450');
  await page.getByLabel('Nutrition date', { exact: true }).fill('2026-11-13');
  await expect(food.getByRole('button', { name: 'Edit Visible current meal', exact: true })).toHaveCount(0);
  await page.getByLabel('Nutrition date', { exact: true }).fill('2026-11-14');
  await expect(food.getByRole('button', { name: 'Edit Visible current meal', exact: true })).toBeVisible();
  await page.getByText('Review nutrition and adjust targets', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Four-week nutrition review', exact: true })).toBeVisible();
  await page.goto('/#/progress?tab=body');
  const logger = await page.getByRole('heading', { name: 'Morning bodyweight', exact: true }).boundingBox();
  const chart = await page
    .getByRole('heading', { name: 'A trend, not a single weigh-in', exact: true })
    .boundingBox();
  expect(logger!.y).toBeLessThan(chart!.y);
  await expect(page.getByLabel('Left Biceps (in)', { exact: true })).toBeHidden();
  await page
    .locator('summary')
    .filter({ hasText: /^Body measurements$/ })
    .click();
  await expect(page.getByLabel('Left Biceps (in)', { exact: true })).toBeVisible();
});

test('structured recipe edits survive immediate navigation and saving clears only the submitted draft', async ({
  page,
}) => {
  await page.goto('/#/progress?tab=nutrition');
  await page.getByText('Ingredient recipes, weighed portions and meal prep', { exact: true }).click();
  await page.getByText('Ingredient pantry: create or edit label values', { exact: true }).click();
  const ingredients = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Ingredient label values', exact: true }) })
    .last();
  await ingredients.getByLabel('Ingredient name / brand', { exact: true }).fill('Navigation oats');
  for (const [label, value] of [
    ['Calories (kcal) per 100 g', '400'],
    ['Protein (g) per 100 g', '10'],
    ['Carbs (g) per 100 g', '60'],
    ['Fat (g) per 100 g', '8'],
  ])
    await ingredients.getByLabel(label, { exact: true }).fill(value);
  await ingredients.getByRole('button', { name: 'Save record', exact: true }).click();
  await expect(ingredients.locator('summary')).toContainText('(1)');
  await page.getByLabel('Ingredient recipe name', { exact: true }).fill('Keep the latest amount');
  await page.getByRole('button', { name: 'Add ingredient to recipe', exact: true }).click();
  const grams = page.getByLabel('Navigation oats recipe grams 1', { exact: true });
  await grams.fill('321');
  // Navigate in the same interaction turn, without waiting for an old debounce timer.
  await grams.evaluate((input) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, '432');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    window.location.hash = '#/health';
  });
  await expect(page.getByRole('heading', { name: 'Daily check-in', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Log a meal', exact: true }).click();
  await page.getByText('Ingredient recipes, weighed portions and meal prep', { exact: true }).click();
  await expect(grams).toHaveValue('432');
  await page.getByRole('button', { name: 'Save ingredient recipe', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Edit recipe Keep the latest amount', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Ingredient recipe name', { exact: true })).toHaveValue('');
  await page.getByRole('link', { name: 'Health', exact: true }).last().click();
  await page.getByRole('link', { name: 'Log a meal', exact: true }).click();
  await page.getByText('Ingredient recipes, weighed portions and meal prep', { exact: true }).click();
  await expect(page.getByLabel('Ingredient recipe name', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Navigation oats recipe grams 1', { exact: true })).toHaveCount(0);
});

test('switching check-in dates cancels a previous date delete confirmation', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-14T17:00:00Z'));
  await page.goto('/#/health');
  await page.getByLabel('Check-in sleep (hours)', { exact: true }).fill('7');
  await page.getByRole('button', { name: 'Save daily check-in', exact: true }).click();
  await expect(page.getByText('Daily check-in saved; recovery updated.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete this check-in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete check-in?', exact: true })).toBeVisible();
  await page.getByLabel('Check-in date', { exact: true }).fill('2026-11-13');
  await expect(page.getByLabel('Check-in sleep (hours)', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Delete check-in?', exact: true })).toHaveCount(0);
  await page.getByLabel('Check-in date', { exact: true }).fill('2026-11-14');
  await expect(page.getByLabel('Check-in sleep (hours)', { exact: true })).toHaveValue('7');
  await expect(page.getByRole('button', { name: 'Delete this check-in', exact: true })).toBeVisible();
});

test('a detailed Recovery edit updates the simple check-in and keeps optional measurements', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-14T17:00:00Z'));
  await page.goto('/#/progress?tab=recovery&section=recovery-details');
  const simple = page.locator('.daily-checkin');
  await simple.getByLabel('Check-in sleep (hours)', { exact: true }).fill('7');
  await simple.getByLabel('Time available today (minutes)', { exact: true }).fill('30');
  await simple.getByRole('button', { name: 'Save daily check-in', exact: true }).click();
  const details = page.locator('#tool-recovery-details');
  await details.getByRole('button', { name: /^Edit / }).click();
  await details.getByLabel('Sleep (hours)', { exact: true }).fill('8');
  await details.getByLabel('Resting heart rate (bpm)', { exact: true }).fill('60');
  await details.getByRole('button', { name: 'Update entry', exact: true }).click();
  await expect(simple.getByLabel('Check-in sleep (hours)', { exact: true })).toHaveValue('8');
  await expect(simple.getByLabel('Time available today (minutes)', { exact: true })).toHaveValue('30');
  await simple.getByLabel('Check-in sleep (hours)', { exact: true }).fill('');
  await simple.getByRole('button', { name: 'Save daily check-in', exact: true }).click();
  await expect(details.locator('.entry-list')).not.toContainText('8 h sleep');
  await expect(details.locator('.entry-list')).toContainText('60 bpm');
  await page.reload();
  await expect(simple.getByLabel('Check-in sleep (hours)', { exact: true })).toHaveValue('');
  await expect(simple.getByLabel('Time available today (minutes)', { exact: true })).toHaveValue('30');
  await expect(details.locator('.entry-list')).toContainText('60 bpm');
});
