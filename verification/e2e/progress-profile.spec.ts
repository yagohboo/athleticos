import { test, expect } from '@playwright/test';

test('bodyweight, nutrition, athletic and recovery records persist and can be edited', async ({ page }) => {
  await page.goto('/#/progress?tab=body');
  const weight = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Morning bodyweight', exact: true }) });
  await weight.getByLabel('Bodyweight (lb)', { exact: true }).fill('219');
  await weight.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(weight.getByRole('button', { name: 'Edit 219 lb', exact: true })).toBeVisible();
  await weight.getByRole('button', { name: 'Edit 219 lb', exact: true }).click();
  await weight.getByLabel('Bodyweight (lb)', { exact: true }).fill('218.5');
  await weight.getByRole('button', { name: 'Update entry', exact: true }).click();
  await expect(weight.getByRole('button', { name: 'Edit 218.5 lb', exact: true })).toBeVisible();
  await page.reload();
  await expect(weight.getByRole('button', { name: 'Edit 218.5 lb', exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Nutrition', exact: true }).click();
  const food = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Quick add or log a meal', exact: true }) });
  await food.getByLabel('Meal name', { exact: true }).fill('Test protein oats');
  await food.getByLabel('Calories (kcal)', { exact: true }).fill('510');
  await food.getByLabel('Protein (g)', { exact: true }).fill('42');
  await food.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(
    food.getByText('510 kcal · 42 g protein · 0 g carbs · 0 g fat', { exact: true }),
  ).toBeVisible();
  await food.getByRole('button', { name: 'Save meal', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Test protein oats 510 kcal · 42 g protein' })).toBeVisible();
  await page.getByRole('button', { name: 'Test protein oats 510 kcal · 42 g protein' }).click();
  await expect(food.getByRole('button', { name: 'Edit Test protein oats', exact: true })).toHaveCount(2);

  await page.getByRole('tab', { name: 'Athletic', exact: true }).click();
  await page.getByLabel('Test', { exact: true }).selectOption('sprint');
  await page.getByLabel('Time (sec)', { exact: true }).fill('1.95');
  await page.getByLabel('Sprint distance (meters; 10 yd = 9.144 m)', { exact: true }).fill('9.144');
  await page.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit 1.95 sec · 9.144 m', exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Recovery', exact: true }).click();
  await page.getByText('Detailed recovery log and saved entries', { exact: true }).click();
  const recovery = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Daily recovery check-in', exact: true }) });
  await recovery.getByLabel(/^Sleep \(hours\)/).fill('7.5');
  await recovery.getByLabel(/^Energy \(1 low/).fill('4');
  await recovery.getByLabel(/^Daily steps/).fill('8500');
  await recovery.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(page.getByText('7.5 h sleep · energy 4/5 · 8,500 steps', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByText('Detailed recovery log and saved entries', { exact: true }).click();
  await expect(page.getByText('7.5 h sleep · energy 4/5 · 8,500 steps', { exact: true })).toBeVisible();
});

test('profile units persist and JSON backup merge and replacement are explicit', async ({
  page,
}, testInfo) => {
  await page.goto('/#/workout?template=upper-a');
  await page.getByRole('button', { name: 'Start this workout', exact: true }).click();
  await page
    .locator('form.set-editor')
    .first()
    .getByRole('button', { name: 'Complete set', exact: true })
    .click();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.goto('/#/profile?section=personal');
  await page.getByLabel('Your name', { exact: true }).fill('Backup Athlete');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Backup Athlete', exact: true })).toBeVisible();
  await page.locator('#tool-settings > summary').click();
  await page.getByLabel('Weight unit', { exact: true }).selectOption('kg');
  await page.getByLabel('Appearance', { exact: true }).selectOption('light');
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await expect(page.getByLabel('Profile baseline weight (kg)', { exact: true })).toHaveValue('99.79');
  await page.reload();
  await page.locator('#tool-settings > summary').click();
  await expect(page.getByLabel('Appearance', { exact: true })).toHaveValue('light');
  await page.locator('#tool-backups > summary').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export complete JSON backup', exact: true }).click();
  const download = await downloadPromise;
  const backupPath = testInfo.outputPath('athleticos-backup.json');
  await download.saveAs(backupPath);

  await page.getByLabel('Your name', { exact: true }).fill('Local Changes');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Local Changes', exact: true })).toBeVisible();
  await page.getByText('Restore a JSON backup', { exact: true }).click();
  await page.getByLabel('Backup JSON file', { exact: true }).setInputFiles(backupPath);
  await page.getByRole('button', { name: 'Validate and merge backup', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Local Changes', exact: true })).toBeVisible();
  await expect(page.getByText(/^Restore complete:/)).toBeVisible();
  await expect(page.getByRole('timer')).toBeVisible();

  // A new selection is necessary for each restore; first clear the input.
  await page.getByLabel('Backup JSON file', { exact: true }).setInputFiles([]);
  await page.getByLabel('Backup JSON file', { exact: true }).setInputFiles(backupPath);
  await page.getByLabel('Restore behavior', { exact: true }).selectOption('replace');
  await expect(
    page.getByRole('button', { name: 'Validate and replace local data', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('Type REPLACE to confirm replacement', { exact: true }).fill('REPLACE');
  await page.getByRole('button', { name: 'Validate and replace local data', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Backup Athlete', exact: true })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.locator('.toast')).toHaveCount(0);
});

test('mobile tracking screens stay within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const routes = [
    ['/#/progress?tab=strength', 'Exercise performance'],
    ['/#/progress?tab=body', 'Morning bodyweight'],
    ['/#/progress?tab=athletic', 'Athletic performance'],
    ['/#/progress?tab=nutrition', 'Daily nutrition'],
    ['/#/progress?tab=recovery', 'Daily check-in'],
    ['/#/profile?section=personal', 'Personal profile'],
  ];
  for (const [route, heading] of routes) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  }
});

test('photos are compressed, compared and retained locally', async ({ page }) => {
  await page.goto('/#/progress?tab=body');
  await page.getByText('Progress photos and comparisons', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Progress photos', exact: true })).toBeVisible();
  const image = await page.screenshot({ clip: { x: 0, y: 0, width: 80, height: 80 } });
  await page.getByLabel('Photo label', { exact: true }).fill('Front before');
  await page
    .getByLabel('Add a progress photo', { exact: true })
    .setInputFiles({ name: 'before.png', mimeType: 'image/png', buffer: image });
  await expect(page.getByAltText(/^Before: Front before/)).toBeVisible();
  await expect(page.getByAltText(/^Before: Front before/)).toHaveAttribute(
    'src',
    /^data:image\/jpeg;base64,/,
  );
  await page.getByLabel('Photo label', { exact: true }).fill('Front after');
  await page
    .getByLabel('Add a progress photo', { exact: true })
    .setInputFiles({ name: 'after.png', mimeType: 'image/png', buffer: image });
  await expect(page.getByLabel('After photo', { exact: true }).locator('option')).toHaveCount(2);
  const afterOption = await page
    .getByLabel('After photo', { exact: true })
    .locator('option')
    .filter({ hasText: 'Front after' })
    .getAttribute('value');
  await page.getByLabel('After photo', { exact: true }).selectOption(afterOption!);
  await expect(page.getByAltText(/^After: Front after/)).toBeVisible();
  await page.reload();
  await page.getByText('Progress photos and comparisons', { exact: true }).click();
  await expect(page.getByLabel('After photo', { exact: true }).locator('option')).toHaveCount(2);
});
