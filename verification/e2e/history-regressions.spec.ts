import { test, expect } from '@playwright/test';

test('substituted exercises retain their original editable history after finishing', async ({ page }) => {
  await page.goto('/#/workout?template=upper-a');
  await page.getByRole('button', { name: 'Start this workout', exact: true }).click();
  await page.getByRole('button', { name: 'Show all sets', exact: true }).click();
  const smith = page.locator('.exercise-rail-item').filter({ hasText: 'Smith Machine Bench Press' });
  await smith.click();
  await page.getByLabel('Set 1 weight', { exact: true }).fill('100');
  await page.getByLabel('Set 1 reps', { exact: true }).fill('6');
  await page
    .locator('form.set-editor')
    .first()
    .getByRole('button', { name: 'Complete set', exact: true })
    .click();
  await expect(page.locator('.saved-set').first()).toContainText('100 lb × 6 reps');
  await page.getByLabel('Dismiss timer', { exact: true }).click();

  await page.getByText('Exercise tools & adjustments', { exact: true }).click();
  const replace = page.getByText('Replace this exercise', { exact: true }).locator('..');
  await replace.locator(':scope > summary').click();
  await replace.getByRole('combobox').selectOption('db-bench');
  await replace.getByRole('button', { name: 'Replace exercise', exact: true }).click();
  await expect(smith).toContainText('Skipped');
  const dumbbell = page.locator('.exercise-rail-item').filter({ hasText: 'Dumbbell Bench Press' });
  await dumbbell.click();
  await expect(page.getByLabel('Set 1 weight', { exact: true })).toHaveValue('');
  await page.getByLabel('Set 1 weight', { exact: true }).fill('40');
  await expect(page.getByLabel('Set 1 weight', { exact: true })).toHaveValue('40');
  await page.getByLabel('Set 1 reps', { exact: true }).fill('8');
  await page
    .locator('form.set-editor')
    .first()
    .getByRole('button', { name: 'Complete set', exact: true })
    .click();
  await expect(page.locator('.saved-set').first()).toContainText('40 lb × 8 reps');
  await page.getByLabel('Dismiss timer', { exact: true }).click();
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('button', { name: 'Finish & save session', exact: true }).click();
  await expect(page.getByText('Work put in. Progress earned.', { exact: true })).toBeVisible();

  await smith.click();
  await expect(page.locator('.saved-set')).toHaveCount(1);
  await expect(page.locator('.saved-set').first()).toContainText('100 lb × 6 reps');
  await page.locator('.saved-set').first().getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Set 1 weight', { exact: true })).toHaveValue('100');
  await page.getByLabel('Set 1 reps', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('.saved-set').first()).toContainText('100 lb × 5 reps');
  await page.reload();
  await smith.click();
  await expect(page.locator('.saved-set').first()).toContainText('100 lb × 5 reps');
  await dumbbell.click();
  await expect(page.locator('.saved-set').first()).toContainText('40 lb × 8 reps');
});

test('renumbered sets keep their own values and added sprints use the programmed targets', async ({
  page,
}) => {
  await page.goto('/#/workout?template=upper-a');
  await page.getByRole('button', { name: 'Start this workout', exact: true }).click();
  await page.getByRole('button', { name: 'Show all sets', exact: true }).click();
  await page.locator('.exercise-rail-item').filter({ hasText: 'Smith Machine Bench Press' }).click();
  for (const [number, weight, reps] of [
    [1, 100, 6],
    [2, 105, 5],
    [3, 110, 4],
  ]) {
    await page.getByLabel(`Set ${number} weight`, { exact: true }).fill(String(weight));
    await page.getByLabel(`Set ${number} reps`, { exact: true }).fill(String(reps));
    await page
      .locator('form.set-editor')
      .first()
      .getByRole('button', { name: 'Complete set', exact: true })
      .click();
    await expect(page.locator('.saved-set').nth(number - 1)).toContainText(`${weight} lb × ${reps} reps`);
    await page.getByLabel('Dismiss timer', { exact: true }).click();
  }
  await page.locator('.saved-set').first().getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Remove set 1', { exact: true }).click();
  await expect(page.locator('.saved-set')).toHaveCount(2);
  await expect(page.locator('.saved-set').first()).toContainText('105 lb × 5 reps');
  await expect(page.locator('.saved-set').first().locator('strong')).toContainText('Set 1');
  await expect(page.locator('.saved-set').nth(1).locator('strong')).toContainText('Set 2');
  await page.locator('.saved-set').nth(1).getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Set 2 weight', { exact: true })).toHaveValue('110');
  await expect(page.getByLabel('Set 2 reps', { exact: true })).toHaveValue('4');
  await page.getByLabel('Set 2 reps', { exact: true }).fill('6');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('.saved-set').nth(1)).toContainText('110 lb × 6 reps');

  const add = page
    .locator('details')
    .filter({ has: page.getByText('Add an exercise to this session', { exact: true }) });
  await add.locator('summary').click();
  await add.getByRole('combobox').selectOption('sprint');
  await add.getByRole('button', { name: 'Add to session', exact: true }).click();
  await expect(page.locator('.exercise-focus h2')).toHaveText('Acceleration Sprint');
  await expect(page.locator('.exercise-focus-top')).toContainText('3 sets × 1 efforts');
  await expect(page.getByLabel('Set 1 reps', { exact: true })).toHaveValue('1');
  await expect(page.getByLabel('Set 1 distance', { exact: true })).toHaveValue('9.144');
  await page.getByLabel('Set 1 time', { exact: true }).fill('1.8');
  await page
    .locator('form.set-editor')
    .first()
    .getByRole('button', { name: 'Complete set', exact: true })
    .click();
  await expect(page.getByRole('timer')).toBeVisible();

  await page.goto('/#/profile?section=backups');
  await page.getByText('Reset all local data', { exact: true }).click();
  await page.getByLabel('Type RESET to confirm', { exact: true }).fill('RESET');
  await page.getByRole('button', { name: 'Erase data and reset app', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('timer')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await page.goto('/#/workout');
  await expect(page.getByRole('heading', { name: 'Your training', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toHaveCount(0);
});
