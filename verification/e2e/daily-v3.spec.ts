import { test, expect, type Page } from '@playwright/test';

test.use({ baseURL: process.env.DAILY_BASE_URL ?? 'http://127.0.0.1:4173' });
const section = (page: Page, title: string) =>
  page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
    .last();

async function chooseNutritionTargets(page: Page) {
  await page.goto('/#/profile?section=settings');
  await page.getByLabel('Daily calorie target (editable estimate)', { exact: true }).fill('2500');
  await page.getByLabel('Daily protein target (g)', { exact: true }).fill('190');
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save settings', exact: true })).toBeEnabled();
}

test('daily drafts restore only to the same date or ingredient record', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-14T17:00:00Z'));
  await page.goto('/#/health');
  const checkin = section(page, 'Daily check-in');
  await checkin.getByLabel('Check-in sleep (hours)', { exact: true }).fill('7');
  await checkin.getByLabel('Check-in date', { exact: true }).fill('2026-11-13');
  await page.locator('.draft-recovery summary').click();
  await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  await expect(
    page.getByText('Open the same entry or exercise editor before restoring this draft.', { exact: true }),
  ).toBeVisible();
  await expect(checkin.getByLabel('Check-in sleep (hours)', { exact: true })).toHaveValue('');
  await checkin.getByLabel('Check-in date', { exact: true }).fill('2026-11-14');
  await expect(checkin.getByLabel('Check-in sleep (hours)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  await expect(checkin.getByLabel('Check-in sleep (hours)', { exact: true })).toHaveValue('7');
  await checkin.getByRole('button', { name: 'Save daily check-in', exact: true }).click();
  await expect(page.locator('.draft-recovery')).toHaveCount(0);

  await page.goto('/#/progress?tab=nutrition');
  const coverage = section(page, 'Nutrition-day coverage');
  await coverage.getByLabel('Daily hunger (1 low – 5 high)', { exact: true }).fill('3');
  await page.getByLabel('Nutrition date', { exact: true }).fill('2026-11-13');
  await page.locator('.draft-recovery summary').click();
  await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  await expect(coverage.getByLabel('Daily hunger (1 low – 5 high)', { exact: true })).toHaveValue('');
  await page.getByLabel('Nutrition date', { exact: true }).fill('2026-11-14');
  await expect(coverage.getByLabel('Daily hunger (1 low – 5 high)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  await expect(coverage.getByLabel('Daily hunger (1 low – 5 high)', { exact: true })).toHaveValue('3');
  await coverage.getByRole('button', { name: 'Save nutrition coverage', exact: true }).click();
  await expect(page.locator('.draft-recovery')).toHaveCount(0);

  await page.getByText('Ingredient recipes, weighed portions and meal prep', { exact: true }).click();
  await page.getByText('Ingredient pantry: create or edit label values', { exact: true }).click();
  const ingredients = section(page, 'Ingredient label values');
  for (const [index, name] of ['Ingredient A', 'Ingredient B'].entries()) {
    await ingredients.getByLabel('Ingredient name / brand', { exact: true }).fill(name);
    for (const label of [
      'Calories (kcal) per 100 g',
      'Protein (g) per 100 g',
      'Carbs (g) per 100 g',
      'Fat (g) per 100 g',
    ])
      await ingredients.getByLabel(label, { exact: true }).fill('1');
    await ingredients.getByRole('button', { name: 'Save record', exact: true }).click();
    await expect(ingredients.locator('summary')).toContainText(`(${index + 1})`);
  }
  await ingredients.locator('summary').click();
  await ingredients.getByRole('button', { name: 'Edit Ingredient A', exact: true }).click();
  await ingredients.getByLabel('Ingredient name / brand', { exact: true }).fill('Ingredient A unfinished');
  await ingredients.getByRole('button', { name: 'Edit Ingredient B', exact: true }).click();
  await page.locator('.draft-recovery summary').click();
  await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  await expect(ingredients.getByLabel('Ingredient name / brand', { exact: true })).toHaveValue(
    'Ingredient B',
  );
  await ingredients.getByRole('button', { name: 'Edit Ingredient A', exact: true }).click();
  await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  await expect(ingredients.getByLabel('Ingredient name / brand', { exact: true })).toHaveValue(
    'Ingredient A unfinished',
  );
});

test('compact check-in persists, tolerance has editable history and a launched walk is not completed automatically', async ({
  page,
}) => {
  await page.goto('/#/health');
  const checkin = section(page, 'Daily check-in');
  await checkin.getByLabel('Check-in sleep (hours)', { exact: true }).fill('8');
  await checkin.getByLabel('Energy (1 low – 5 high)', { exact: true }).fill('4');
  await checkin.getByLabel('Time available today (minutes)', { exact: true }).fill('45');
  await checkin.getByRole('button', { name: 'Save daily check-in', exact: true }).click();
  await expect(checkin.getByText('Daily check-in saved; recovery updated.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(checkin.getByLabel('Check-in sleep (hours)', { exact: true })).toHaveValue('8');
  await expect(checkin.getByLabel('Time available today (minutes)', { exact: true })).toHaveValue('45');
  await page.goto('/#/health?tab=joints');
  const tolerance = section(page, 'Exercise preference and tolerance');
  await tolerance.getByLabel('Exercise for tolerance history', { exact: true }).selectOption('smith-bench');
  await tolerance.getByLabel('Exercise preference', { exact: true }).selectOption('avoid');
  await tolerance.getByLabel('How this exercise felt', { exact: true }).selectOption('aggravating');
  await tolerance.getByRole('button', { name: 'Save record', exact: true }).click();
  await tolerance.locator('summary').click();
  await tolerance
    .getByRole('button', { name: 'Edit Smith Machine Bench Press: aggravating', exact: true })
    .click();
  await tolerance.getByLabel('How this exercise felt', { exact: true }).selectOption('mixed');
  await tolerance.getByRole('button', { name: 'Update record', exact: true }).click();
  await expect(tolerance).toContainText('Smith Machine Bench Press: mixed');
  const followup = section(page, 'Discomfort follow-up');
  await followup
    .getByLabel('Compared with the original discomfort', { exact: true })
    .selectOption('improved');
  await followup.getByLabel('Exercise involved', { exact: true }).selectOption('smith-bench');
  await followup.getByRole('button', { name: 'Save record', exact: true }).click();
  await followup.locator('summary').click();
  await expect(followup).toContainText('Shoulders: improved');
  await page.goto('/#/health?tab=movement');
  await page.getByRole('button', { name: 'Start sitting session', exact: true }).click();
  await page.getByLabel('Planned break minutes', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Launch chosen break', exact: true }).click();
  await expect(page.getByRole('timer', { name: 'Break practice countdown', exact: true })).toBeVisible();
  const history = section(page, 'Movement-break history');
  await expect(history).not.toContainText('min · Comfortable walk');
  await page.reload();
  await expect(page.getByRole('timer', { name: 'Break practice countdown', exact: true })).toBeVisible();
  await expect(page.getByLabel('Actual break minutes', { exact: true })).toHaveValue('5');
  await page.getByLabel('Actual break minutes', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Confirm I completed this break', exact: true }).click();
  await expect(history).toContainText('2 min · Comfortable walk');
  await expect(page.getByRole('button', { name: 'Confirm I completed this break', exact: true })).toHaveCount(
    0,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('ingredient recipes restore unfinished rows, calculate actual cooked portions and combine scaled shopping weights', async ({
  page,
}) => {
  await chooseNutritionTargets(page);
  await page.goto('/#/progress?tab=nutrition');
  await page.getByText('Ingredient recipes, weighed portions and meal prep', { exact: true }).click();
  await page.getByText('Ingredient pantry: create or edit label values', { exact: true }).click();
  const ingredients = section(page, 'Ingredient label values');
  for (const [name, calories, protein, carbs, fat] of [
    ['Test oats', '400', '10', '60', '8'],
    ['Test milk', '50', '4', '5', '2'],
  ]) {
    await ingredients.getByLabel('Ingredient name / brand', { exact: true }).fill(name);
    for (const [label, value] of [
      ['Calories (kcal) per 100 g', calories],
      ['Protein (g) per 100 g', protein],
      ['Carbs (g) per 100 g', carbs],
      ['Fat (g) per 100 g', fat],
    ])
      await ingredients.getByLabel(label, { exact: true }).fill(value);
    await ingredients.getByRole('button', { name: 'Save record', exact: true }).click();
    await expect(ingredients.locator('summary')).toContainText(name === 'Test oats' ? '(1)' : '(2)');
  }
  await page.getByLabel('Ingredient recipe name', { exact: true }).fill('Test breakfast');
  await page.getByLabel('Cooked batch weight (g)', { exact: true }).fill('1000');
  await page.getByLabel('Ingredient to add', { exact: true }).selectOption({ label: 'Test oats' });
  await page.getByRole('button', { name: 'Add ingredient to recipe', exact: true }).click();
  await page.getByLabel('Test oats recipe grams 1', { exact: true }).fill('200');
  await page.getByLabel('Ingredient to add', { exact: true }).selectOption({ label: 'Test milk' });
  await page.getByRole('button', { name: 'Add ingredient to recipe', exact: true }).click();
  await page.getByLabel('Test milk recipe grams 2', { exact: true }).fill('400');
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const request = indexedDB.open('AthleticOS');
        return new Promise<boolean>((resolve, reject) => {
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const database = request.result;
            const read = database
              .transaction('features')
              .objectStore('features')
              .get('daily-recipe-draft-current');
            read.onsuccess = () => {
              resolve(read.result?.data?.draft?.ingredients?.[1]?.grams === 400);
              database.close();
            };
          };
        });
      }),
    )
    .toBe(true);
  await page.reload();
  await page.getByText('Ingredient recipes, weighed portions and meal prep', { exact: true }).click();
  await expect(page.getByLabel('Test milk recipe grams 2', { exact: true })).toHaveValue('400');
  await page.getByRole('button', { name: 'Save ingredient recipe', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit recipe Test breakfast', exact: true })).toBeVisible();
  await page.getByLabel('Recipe portion amount', { exact: true }).fill('250');
  await expect(page.locator('.daily-portion-preview')).toContainText(
    '250 kcal · 9 g protein · 35 g carbs · 6 g fat',
  );
  await page.getByRole('button', { name: 'Confirm and log portion', exact: true }).click();
  const meals = section(page, 'Quick add or log a meal');
  await expect(meals).toContainText('Test breakfast · 250 g');
  await expect(meals).toContainText('250 kcal · 9 g protein');
  await page.getByLabel('Prep plan name', { exact: true }).fill('Two breakfasts');
  await page.getByLabel('Servings to prepare', { exact: true }).fill('8');
  await page.getByRole('button', { name: 'Add scaled recipe to plan', exact: true }).click();
  await page.getByRole('button', { name: 'Save meal prep plan', exact: true }).click();
  await expect(page.locator('.daily-shopping')).toContainText('400 g');
  await expect(page.locator('.daily-shopping')).toContainText('800 g');
  await page.getByLabel('Shopping: Test oats', { exact: true }).check();
  await expect(page.getByLabel('Shopping: Test oats', { exact: true })).toBeChecked();
  const coverage = section(page, 'Nutrition-day coverage');
  await expect(coverage).toContainText('Saved status: unknown');
  await coverage.getByLabel('Nutrition recording coverage', { exact: true }).selectOption('full');
  await coverage.getByLabel('Daily hunger (1 low – 5 high)', { exact: true }).fill('3');
  await coverage.getByRole('button', { name: 'Save nutrition coverage', exact: true }).click();
  await expect(coverage).toContainText('Saved status: full');
  await page.getByText('Review nutrition and adjust targets', { exact: true }).click();
  await expect(section(page, 'Four-week nutrition review')).toContainText(
    'More consistent records before a target experiment',
  );
  await expect(page.getByRole('button', { name: 'Preview target proposal', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('multiweek target proposal requires a separate approval and preserves food history', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-14T17:00:00Z'));
  await chooseNutritionTargets(page);
  await page.goto('/#/progress?tab=nutrition');
  await page.getByText('Review nutrition and adjust targets', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Four-week nutrition review', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const open = indexedDB.open('AthleticOS');
    await new Promise<void>((resolve, reject) => {
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const database = open.result;
        const tx = database.transaction(
          ['features', 'nutrition', 'bodyweights', 'measurements', 'sessions', 'sets'],
          'readwrite',
        );
        const timestamp = '2026-11-14T17:00:00.000Z';
        for (let i = 0; i < 28; i++) {
          const date = new Date(Date.UTC(2026, 9, 17 + i)).toISOString().slice(0, 10);
          tx.objectStore('features').put({
            id: `daily-nutrition-day-${date}`,
            kind: 'daily-nutrition-day',
            data: { version: 1, date, coverage: 'full', hunger: 3, notes: '' },
            createdAt: timestamp,
            updatedAt: timestamp,
          });
          tx.objectStore('nutrition').put({
            id: `evidence-meal-${i}`,
            date,
            name: 'Fixture intake',
            calories: 2400,
            protein: 180,
            carbs: 250,
            fat: 70,
            createdAt: timestamp,
          });
          if ([0, 2, 4, 21, 23, 25].includes(i))
            tx.objectStore('bodyweights').put({
              id: `evidence-weight-${i}`,
              date,
              weightKg: i < 7 ? 100 : 99,
              notes: '',
              createdAt: timestamp,
            });
          if ([1, 7, 14, 21].includes(i)) {
            tx.objectStore('sessions').put({
              id: `evidence-session-${i}`,
              date,
              templateId: 'upper-a',
              programId: 'planet-fitness',
              name: 'Fixture session',
              startedAt: `${date}T12:00:00.000Z`,
              finishedAt: `${date}T13:00:00.000Z`,
              status: 'completed',
              exercises: [
                {
                  id: 'p1',
                  exerciseId: 'smith-bench',
                  sets: 1,
                  repsMin: 6,
                  repsMax: 6,
                  restSec: 180,
                  targetRir: 2,
                  notes: '',
                  name: 'Smith Machine Bench Press',
                  kind: 'strength',
                  primaryMuscles: ['Chest'],
                  pattern: 'Horizontal push',
                  estimate1rm: true,
                  skipped: false,
                },
              ],
              warmup: [],
              notes: '',
            });
            tx.objectStore('sets').put({
              id: `evidence-set-${i}`,
              workoutId: `evidence-session-${i}`,
              exerciseId: 'smith-bench',
              prescriptionId: 'p1',
              setNumber: 1,
              type: 'working',
              weightKg: 50,
              reps: 6,
              unit: 'kg',
              rir: 2,
              timestamp: `${date}T12:30:00.000Z`,
              completed: true,
              goodTechnique: true,
              notes: '',
            });
          }
        }
        tx.oncomplete = () => {
          database.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.reload();
  await page.getByText('Review nutrition and adjust targets', { exact: true }).click();
  await page.getByLabel('Proposed calorie change', { exact: true }).selectOption('100');
  await page.getByRole('button', { name: 'Preview target proposal', exact: true }).click();
  await expect(page.getByRole('heading', { name: '2500 → 2600 kcal per day', exact: true })).toBeVisible();
  await expect(page.locator('.nutrition-target').first()).toContainText('/ 2,500');
  await page.getByRole('button', { name: 'Approve and apply target', exact: true }).click();
  await expect(page.locator('.nutrition-target').first()).toContainText('/ 2,600');
  await expect(page.getByText('Approved nutrition decision saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.nutrition-target').first()).toContainText('/ 2,600');
});

test('a sitting break can launch a mobility snapshot but completion requires performed drills and confirmation', async ({
  page,
}) => {
  await page.goto('/#/health?tab=movement');
  await page.getByRole('button', { name: 'Start sitting session', exact: true }).click();
  await page.getByLabel('Break practice', { exact: true }).selectOption('desk-break');
  await page.getByRole('button', { name: 'Launch chosen break', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Confirm I completed this break', exact: true }),
  ).toBeDisabled();
  await page.getByRole('link', { name: 'Continue the saved mobility routine', exact: true }).click();
  await expect(page.locator('.mobility-active')).toBeVisible();
  await page.locator('.mobility-active input[type="checkbox"]').first().check();
  await page.getByRole('button', { name: 'Finish mobility session', exact: true }).click();
  await page.getByLabel('Actual routine duration (minutes)', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Save mobility session', exact: true }).click();
  await expect(
    page.getByText(
      'Mobility session saved. Completed drills are shown honestly, including partial routines.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator('.mobility-active')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Health section', exact: true }).selectOption('movement');
  await expect(section(page, 'Movement-break history')).not.toContainText('min · Desk reset');
  await page.getByLabel('Actual break minutes', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Confirm I completed this break', exact: true }).click();
  await expect(section(page, 'Movement-break history')).toContainText('2 min · Desk reset');
});
