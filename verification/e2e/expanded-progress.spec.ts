import { test, expect } from '@playwright/test';

test('side metadata and saved set ordering survive reload', async ({ page }) => {
  await page.goto('/#/workout?template=upper-a');
  await page.getByRole('button', { name: 'Start this workout', exact: true }).click();
  await page.getByRole('button', { name: 'Show all sets', exact: true }).click();
  await page.locator('.exercise-rail-item').filter({ hasText: 'Smith Machine Bench Press' }).click();
  for (const [number, side, reps] of [
    [1, 'left', 8],
    [2, 'right', 10],
  ] as const) {
    const form = page.locator('form.set-editor').first();
    await page.getByLabel(`Set ${number} weight`, { exact: true }).fill('60');
    await expect(page.getByLabel(`Set ${number} weight`, { exact: true })).toHaveValue('60');
    await page.getByLabel(`Set ${number} reps`, { exact: true }).fill(String(reps));
    await form.getByText('Side, tempo & optional details', { exact: true }).click();
    await form.getByLabel(`Set ${number} side`, { exact: true }).selectOption(side);
    await form.getByLabel(`Set ${number} tempo`, { exact: true }).fill('3-1-1');
    await form.getByLabel(`Set ${number} range of motion`, { exact: true }).selectOption('consistent');
    await expect(page.getByLabel(`Set ${number} weight`, { exact: true })).toHaveValue('60');
    await form.getByRole('button', { name: 'Complete set', exact: true }).click();
    await page.getByLabel('Dismiss timer', { exact: true }).click();
  }
  await page.reload();
  await page.locator('.exercise-rail-item').filter({ hasText: 'Smith Machine Bench Press' }).click();
  await expect(page.locator('.saved-set').first()).toContainText('left');
  await page.getByLabel('Reorder set 1', { exact: true }).click();
  await page.getByRole('button', { name: 'Move set down', exact: true }).click();
  await expect(page.locator('.saved-set').first()).toContainText('right');
  await expect(page.locator('.saved-set').first()).toContainText('10 reps');
  await page.locator('.saved-set').nth(1).getByRole('button', { name: 'Edit', exact: true }).click();
  const edit = page.locator('form.set-editor').first();
  await edit.getByText('Side, tempo & optional details', { exact: true }).click();
  await expect(edit.getByLabel('Set 2 tempo', { exact: true })).toHaveValue('3-1-1');
  await page.getByRole('button', { name: 'Finish', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Finish', exact: true })).toBeFocused();
});

test('bilateral measurements, batch recipes, custom tests and date filters remain usable', async ({
  page,
}) => {
  await page.goto('/#/progress?tab=body');
  await page
    .locator('summary')
    .filter({ hasText: /^Body measurements$/ })
    .click();
  await page.getByLabel('Left Biceps (in)', { exact: true }).fill('15');
  await page.getByLabel('Right Biceps (in)', { exact: true }).fill('15.5');
  const measurements = page
    .locator('section')
    .filter({ has: page.getByLabel('Left Biceps (in)', { exact: true }) });
  await measurements.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(measurements).toContainText('Left Biceps 15 in');
  await page.getByRole('tab', { name: 'Nutrition', exact: true }).click();
  await page.getByText('Meal plans and batch recipes', { exact: true }).click();
  await page.getByText('Batch recipes & portion planning', { exact: true }).click();
  const recipe = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Batch recipes', exact: true }) })
    .last();
  await recipe.getByLabel('Recipe name', { exact: true }).fill('Four-portion test');
  await recipe.getByLabel('Portions per batch', { exact: true }).fill('4');
  for (const [label, value] of [
    ['Whole batch calories (kcal)', '2000'],
    ['Whole batch protein (g)', '200'],
    ['Whole batch carbs (g)', '240'],
    ['Whole batch fat (g)', '40'],
  ])
    await recipe.getByLabel(label, { exact: true }).fill(value);
  await recipe.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(recipe).toContainText('per portion 500 kcal / 50 g protein');
  await page.getByRole('button', { name: 'Four-portion test 500 kcal · 50 g protein' }).click();
  await expect(page.getByRole('button', { name: 'Edit Four-portion test', exact: true })).toHaveCount(2);
  await page.getByRole('tab', { name: 'Athletic', exact: true }).click();
  await page.getByLabel('Test', { exact: true }).selectOption('custom');
  await page.getByLabel('Custom test name', { exact: true }).fill('Controlled hop');
  await page.getByLabel('Result (reps)', { exact: true }).fill('5');
  await page.getByLabel('Surface (keep consistent)', { exact: true }).fill('rubber mat');
  await page.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Controlled hop · 5 reps', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Test', { exact: true })).toBeVisible();
  await page.getByLabel('Test', { exact: true }).selectOption('custom');
  await expect(page.getByRole('button', { name: 'Edit Controlled hop · 5 reps', exact: true })).toBeVisible();
  await page.getByLabel('History range', { exact: true }).selectOption('custom');
  await page.getByLabel('From date', { exact: true }).fill('2020-01-01');
  await page.getByLabel('Through date', { exact: true }).fill('2020-01-31');
  await expect(page.getByRole('button', { name: 'Edit Controlled hop · 5 reps', exact: true })).toHaveCount(
    0,
  );
  await page.goto('/#/tools');
  await page.getByLabel('Target total resistance (lb)', { exact: true }).fill('105');
  await page.getByLabel('Starting bar resistance (lb)', { exact: true }).fill('15');
  await expect(page.getByText('1 × 45', { exact: true })).toBeVisible();
  await page.getByLabel('Input distance unit', { exact: true }).selectOption('yd');
  await page.getByLabel('Distance', { exact: true }).fill('10');
  await expect(page.getByText(/9.144 m · 10 yd/)).toBeVisible();
});

test('expanded home and five-tab navigation fit a narrow screen', async ({ page }) => {
  await page.goto('/#/');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Create your training plan', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Quick logging', exact: true })).toBeVisible();
  const nav = page.locator('.bottom-nav');
  await expect(nav.getByRole('link')).toHaveCount(5);
  await expect(nav).toContainText('Train');
  await expect(nav).toContainText('Coach');
  await expect(nav).toContainText('Health');
  await nav.getByRole('link', { name: 'Health', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/health$/);
  for (const path of ['/', '/train', '/coach', '/health', '/tools']) {
    await page.goto(`/#${path}`);
    await expect(page.locator('main')).not.toContainText('Something needs attention');
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  }
  await page.goto('/#/');
  await page.screenshot({ path: 'artifacts/athleticos-v2-home-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'artifacts/athleticos-v2-home-desktop.png', fullPage: true });
});

test('typing an upcoming set survives a previous-set save while untouched defaults update', async ({
  page,
}) => {
  await page.goto('/#/workout?template=upper-a');
  await page.getByRole('button', { name: 'Start this workout', exact: true }).click();
  await page.getByRole('button', { name: 'Show all sets', exact: true }).click();
  await page.locator('.exercise-rail-item').filter({ hasText: 'Smith Machine Bench Press' }).click();
  await page.getByLabel('Set 2 weight', { exact: true }).fill('110');
  await page.getByLabel('Set 2 reps', { exact: true }).fill('9');
  await page.getByLabel('Set 1 weight', { exact: true }).fill('100');
  await page.getByLabel('Set 1 reps', { exact: true }).fill('6');
  await page
    .locator('form.set-editor')
    .first()
    .getByRole('button', { name: 'Complete set', exact: true })
    .click();
  await expect(page.locator('.saved-set').first()).toContainText('100 lb × 6 reps');
  await expect(page.getByLabel('Set 2 weight', { exact: true })).toHaveValue('110');
  await expect(page.getByLabel('Set 2 reps', { exact: true })).toHaveValue('9');
  await expect(page.getByLabel('Set 3 weight', { exact: true })).toHaveValue('100');
});
