import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('custom test editing preserves its original unit and recipe edits preserve batch metadata', async ({
  page,
}, testInfo) => {
  await page.goto('/#/progress?tab=athletic');
  await page.getByLabel('Test', { exact: true }).selectOption('custom');
  await page.getByLabel('Custom test unit', { exact: true }).selectOption('sec');
  await page.getByLabel('Custom test name', { exact: true }).fill('Supported hold');
  await page.getByLabel('Time (sec)', { exact: true }).fill('30');
  await page.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Supported hold · 30 sec', exact: true })).toBeVisible();
  await page.getByLabel('Custom test unit', { exact: true }).selectOption('reps');
  await expect(page.getByRole('button', { name: 'Edit Supported hold · 30 sec', exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel('Custom test unit', { exact: true }).selectOption('sec');
  await page.getByRole('button', { name: 'Edit Supported hold · 30 sec', exact: true }).click();
  await page.getByLabel('Time (sec)', { exact: true }).fill('35');
  await page.getByRole('button', { name: 'Update entry', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Supported hold · 35 sec', exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Nutrition', exact: true }).click();
  await page.getByText('Meal plans and batch recipes', { exact: true }).click();
  await page.getByText('Batch recipes & portion planning', { exact: true }).click();
  const recipe = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Batch recipes', exact: true }) })
    .last();
  await recipe.getByLabel('Recipe name', { exact: true }).fill('Metadata stew');
  await recipe.getByLabel('Portions per batch', { exact: true }).fill('4');
  for (const [label, value] of [
    ['Whole batch calories (kcal)', '2000'],
    ['Whole batch protein (g)', '200'],
    ['Whole batch carbs (g)', '240'],
    ['Whole batch fat (g)', '40'],
  ])
    await recipe.getByLabel(label, { exact: true }).fill(value);
  await recipe
    .getByLabel('Ingredients & preparation', { exact: true })
    .fill('Beans, vegetables and chicken. Divide into four portions.');
  await recipe.getByRole('button', { name: 'Save entry', exact: true }).click();
  await page.getByText('Create or edit frequent meals', { exact: true }).click();
  const frequent = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Frequent meal templates', exact: true }) })
    .last();
  await frequent.getByRole('button', { name: 'Edit Metadata stew', exact: true }).click();
  await frequent.getByLabel('Calories (kcal)', { exact: true }).fill('550');
  await frequent.getByRole('button', { name: 'Update entry', exact: true }).click();
  await expect(recipe).toContainText('4 portions · per portion 550 kcal / 50 g protein');
  await expect(recipe).toContainText('Beans, vegetables and chicken. Divide into four portions.');

  await page.goto('/#/profile?section=backups');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export complete JSON backup', exact: true }).click();
  const downloaded = await downloadPromise;
  const path = testInfo.outputPath('metadata.json');
  await downloaded.saveAs(path);
  const backup = JSON.parse(await readFile(path, 'utf8'));
  expect(
    backup.tables.athleticTests.find((row: { customName?: string }) => row.customName === 'Supported hold'),
  ).toMatchObject({ value: 35, unit: 'sec' });
  expect(backup.tables.meals.find((row: { name: string }) => row.name === 'Metadata stew')).toMatchObject({
    calories: 550,
    servings: 4,
    recipe: 'Beans, vegetables and chicken. Divide into four portions.',
  });
});
