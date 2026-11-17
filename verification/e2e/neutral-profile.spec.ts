import { expect, test, type Page } from '@playwright/test';

async function readRecord(page: Page, table: string, key = 'main') {
  return page.evaluate(
    ({ table, key }) =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        const request = indexedDB.open('AthleticOS');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(table, 'readonly');
          const record = transaction.objectStore(table).get(key);
          record.onsuccess = () => resolve(record.result as Record<string, unknown>);
          record.onerror = () => reject(record.error);
          transaction.oncomplete = () => database.close();
        };
      }),
    { table, key },
  );
}

test('a fresh profile has no inherited measurements or targets and supports optional logging', async ({
  page,
}) => {
  await page.goto('/#/profile?section=personal');
  await expect(page.getByRole('link', { name: 'Personalize my plan', exact: true })).toHaveAttribute(
    'href',
    '#/setup',
  );
  for (const label of [
    'Sex',
    'Height (in)',
    'Profile baseline weight (lb)',
    'Goal bodyweight (lb)',
    'Reported conventional bench 1RM (lb)',
    'Primary gym',
    'Training experience',
    'Daily lifestyle',
    'Reported daily step baseline (not a log)',
    'Strength sessions per week',
  ])
    await expect(page.getByLabel(label, { exact: true })).toHaveValue('');
  await page.getByLabel('Your name', { exact: true }).fill('New athlete');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'New athlete', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Profile baseline weight (lb)', { exact: true })).toHaveValue('');

  await page.goto('/#/progress?tab=body');
  await expect(page.getByText('No bodyweight recorded or baseline set', { exact: true })).toBeVisible();
  await expect(page.getByText('Not set', { exact: true })).toBeVisible();
  await page.goto('/#/progress?tab=nutrition');
  await expect(page.getByText('Target not set', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('progressbar', { name: 'Daily calorie target', exact: true })).toHaveCount(0);
  await page.getByText('Review nutrition and adjust targets', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No calorie target set', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Preview target proposal', exact: true })).toHaveCount(0);
  const food = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Quick add or log a meal', exact: true }) });
  await food.getByLabel('Meal name', { exact: true }).fill('Own label meal');
  await food.getByLabel('Calories (kcal)', { exact: true }).fill('400');
  await food.getByLabel('Protein (g)', { exact: true }).fill('20');
  await food.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(food.getByRole('button', { name: 'Edit Own label meal', exact: true })).toBeVisible();
  await expect(page.locator('.nutrition-target').first()).toContainText('400');
  await expect(page.getByText('Target not set', { exact: true })).toHaveCount(2);
  for (const route of ['/#/health', '/#/health?tab=movement', '/#/health?tab=cardio', '/#/coach']) {
    await page.goto(route);
    await expect(page.locator('main')).not.toContainText(/NaN|undefined/);
  }
});

test('clearing saved optional profile metrics and nutrition targets really removes them', async ({
  page,
}) => {
  await page.goto('/#/profile?section=personal');
  await page.getByLabel('Your name', { exact: true }).fill('Keeps own records');
  const fields = [
    ['Height (in)', '65'],
    ['Profile baseline weight (lb)', '130'],
    ['Goal bodyweight (lb)', '135'],
    ['Reported conventional bench 1RM (lb)', '0'],
    ['Reported daily step baseline (not a log)', '0'],
    ['Strength sessions per week', '2'],
  ];
  for (const [label, value] of fields) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect.poll(async () => (await readRecord(page, 'profiles')).heightCm).toBeCloseTo(165.1);
  await page.reload();
  await expect(page.getByLabel('Reported conventional bench 1RM (lb)', { exact: true })).toHaveValue('0');
  for (const [label] of fields) await page.getByLabel(label, { exact: true }).fill('');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect.poll(async () => (await readRecord(page, 'profiles')).heightCm).toBeUndefined();
  const profile = await readRecord(page, 'profiles');
  for (const key of [
    'heightCm',
    'startingWeightKg',
    'goalWeightKg',
    'benchMaxKg',
    'stepBaseline',
    'weeklyFrequency',
  ])
    expect(profile).not.toHaveProperty(key);
  expect(profile.name).toBe('Keeps own records');

  await page.locator('#tool-settings > summary').click();
  await page.getByLabel('Daily calorie target (editable estimate)', { exact: true }).fill('2200');
  await page.getByLabel('Daily protein target (g)', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await expect.poll(async () => (await readRecord(page, 'settings')).calorieTarget).toBe(2200);
  await page.getByLabel('Daily calorie target (editable estimate)', { exact: true }).fill('');
  await page.getByLabel('Daily protein target (g)', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await expect.poll(async () => (await readRecord(page, 'settings')).calorieTarget).toBeUndefined();
  const settings = await readRecord(page, 'settings');
  expect(settings).not.toHaveProperty('calorieTarget');
  expect(settings).not.toHaveProperty('proteinTarget');
  expect(settings.weightUnit).toBe('lb');
  await page.reload();
  await page.locator('#tool-settings > summary').click();
  await expect(page.getByLabel('Daily calorie target (editable estimate)', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Daily protein target (g)', { exact: true })).toHaveValue('');
});

test('walking cardio and nutrition goals can stay unset or be cleared without defaulting back', async ({
  page,
}) => {
  await page.goto('/#/health?tab=movement');
  await page.getByText('Reminder and walking settings', { exact: true }).click();
  await expect(page.getByLabel('Daily step goal', { exact: true })).toHaveValue('');
  await page.getByLabel('Daily step goal', { exact: true }).fill('4000');
  await page.getByRole('button', { name: 'Save movement settings', exact: true }).click();
  await expect.poll(async () => (await readRecord(page, 'healthSettings')).stepGoal).toBe(4000);
  await page.getByLabel('Daily step goal', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Save movement settings', exact: true }).click();
  await expect.poll(async () => (await readRecord(page, 'healthSettings')).stepGoal).toBeUndefined();

  await page.goto('/#/health?tab=cardio');
  await expect(page.getByText('Not set', { exact: true })).toBeVisible();
  await page.getByText('Edit your weekly cardio target', { exact: true }).click();
  await page.getByLabel('Weekly aerobic training target (minutes)', { exact: true }).fill('60');
  await page.getByRole('button', { name: 'Save cardio target', exact: true }).click();
  await expect.poll(async () => (await readRecord(page, 'healthSettings')).cardioGoalMinutes).toBe(60);
  await page.getByLabel('Weekly aerobic training target (minutes)', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Save cardio target', exact: true }).click();
  await expect.poll(async () => (await readRecord(page, 'healthSettings')).cardioGoalMinutes).toBeUndefined();

  await page.goto('/#/progress?tab=nutrition&section=nutrition-planning');
  await expect(page.getByLabel('Nutrition mode', { exact: true })).toHaveValue('');
  await page.getByLabel('Nutrition mode', { exact: true }).selectOption('maintenance');
  await page.getByRole('button', { name: 'Save nutrition mode', exact: true }).click();
  await expect.poll(async () => (await readRecord(page, 'healthSettings')).nutritionMode).toBe('maintenance');
  await page.getByLabel('Nutrition mode', { exact: true }).selectOption('');
  await page.getByRole('button', { name: 'Save nutrition mode', exact: true }).click();
  await expect.poll(async () => (await readRecord(page, 'healthSettings')).nutritionMode).toBeUndefined();
  await page.reload();
  await expect(page.getByLabel('Nutrition mode', { exact: true })).toHaveValue('');
  const health = await readRecord(page, 'healthSettings');
  for (const key of ['stepGoal', 'cardioGoalMinutes', 'nutritionMode'])
    expect(health).not.toHaveProperty(key);
});

test('setup respects current profile identity and units while keeping unfinished setup choices', async ({
  page,
}) => {
  await page.goto('/#/profile?section=personal');
  await page.getByLabel('Your name', { exact: true }).fill('Original name');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect.poll(async () => (await readRecord(page, 'profiles')).name).toBe('Original name');
  await page.locator('#tool-settings > summary').click();
  await page.getByLabel('Weight unit', { exact: true }).selectOption('kg');
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await expect.poll(async () => (await readRecord(page, 'settings')).weightUnit).toBe('kg');

  await page.goto('/#/setup');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'See my plan', exact: true }).click();
  await expect(page.getByLabel('Your name (optional)', { exact: true })).toHaveValue('Original name');
  await expect(page.getByLabel('Weight units', { exact: true })).toHaveValue('kg');
  await page.getByRole('button', { name: 'Use this plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Start with one workout.', exact: true })).toBeVisible();

  // A later Profile edit must take priority over answers from an already activated plan.
  await page.goto('/#/profile?section=personal');
  await page.getByLabel('Your name', { exact: true }).fill('Current name');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect.poll(async () => (await readRecord(page, 'profiles')).name).toBe('Current name');
  await page.locator('#tool-settings > summary').click();
  await page.getByLabel('Weight unit', { exact: true }).selectOption('lb');
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await expect.poll(async () => (await readRecord(page, 'settings')).weightUnit).toBe('lb');
  await page.goto('/#/setup');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'See my plan', exact: true }).click();
  await expect(page.getByLabel('Your name (optional)', { exact: true })).toHaveValue('Current name');
  await expect(page.getByLabel('Weight units', { exact: true })).toHaveValue('lb');

  // A deliberate unfinished setup change still wins when that draft is resumed.
  await page.getByLabel('Your name (optional)', { exact: true }).fill('Draft name');
  await page.getByLabel('Weight units', { exact: true }).selectOption('kg');
  await page.getByRole('link', { name: 'Save & leave', exact: true }).click();
  await page.goto('/#/setup');
  await expect(page.getByLabel('Your name (optional)', { exact: true })).toHaveValue('Draft name');
  await expect(page.getByLabel('Weight units', { exact: true })).toHaveValue('kg');
  await page.getByRole('button', { name: 'Use this plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Start with one workout.', exact: true })).toBeVisible();
  expect((await readRecord(page, 'profiles')).name).toBe('Draft name');
  expect((await readRecord(page, 'settings')).weightUnit).toBe('kg');
});
