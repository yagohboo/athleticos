import { test, expect } from '@playwright/test';

test('guided logging leads from the first set through rest and the next exercise', async ({ page }) => {
  await page.goto('/#/workout?template=upper-a');
  await page.getByRole('button', { name: 'Start this workout', exact: true }).click();
  await expect(page.locator('form.set-editor:visible')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Start this set', exact: true })).not.toBeVisible();
  await expect(page.getByLabel('Set 1 RIR', { exact: true })).not.toBeVisible();
  await expect(page.getByText('How to do this', { exact: true })).toBeVisible();
  const complete = page.getByRole('button', { name: 'Complete set', exact: true });
  const box = await complete.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThan(page.viewportSize()!.height - 65);
  await complete.click();
  await expect(page.getByLabel('Rest timer')).toContainText('Set 2 of 3');
  await expect(page.locator('form.set-editor:visible')).toContainText('Set 2 of 3');
  await page.reload();
  await expect(page.getByLabel('Rest timer')).toContainText('Set 2 of 3');
  await expect(page.locator('form.set-editor:visible')).toContainText('Set 2 of 3');
  await page.getByLabel('Dismiss timer', { exact: true }).click();
  await page.getByRole('button', { name: 'Complete set', exact: true }).click();
  await page.getByLabel('Dismiss timer', { exact: true }).click();
  await page.getByRole('button', { name: 'Complete set', exact: true }).click();
  await expect(page.getByLabel('Rest timer')).toContainText('Next: Smith Machine Bench Press · Set 1 of 3');
  await expect(page.locator('.exercise-focus h2')).toHaveText('Smith Machine Bench Press');
  await expect(page.getByLabel('Set 1 weight', { exact: true })).toHaveValue('');
  await page.getByLabel('Dismiss timer', { exact: true }).click();
  await page.getByLabel('Set 1 weight', { exact: true }).fill('45');
  await page.getByRole('button', { name: 'Set details', exact: false }).click();
  await expect(page.getByLabel('Set 1 weight', { exact: true })).toHaveValue('45');
  await page.getByLabel('Set 1 RIR', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Hide set details', exact: true }).click();
  await expect(page.getByLabel('Set 1 RIR', { exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Complete set', exact: true }).click();
  await page.getByLabel('Dismiss timer', { exact: true }).click();
  await page.getByRole('button', { name: 'Show all sets', exact: true }).click();
  await expect(page.locator('.saved-set').first()).toContainText('45 lb');
  await expect(page.locator('.saved-set').first()).toContainText('3 RIR');
});

test('the first set fits a small phone and exercise instructions use the actual library content', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto('/#/workout?template=upper-a');
  await page.getByRole('button', { name: 'Start this workout', exact: true }).click();
  const box = await page.getByRole('button', { name: 'Complete set', exact: true }).boundingBox();
  expect(box!.y + box!.height).toBeLessThan(599);
  await page.getByText('How to do this', { exact: true }).click();
  await expect(page.locator('.guided-how-to ol li').first()).not.toBeEmpty();
  await expect(page.locator('.guided-how-to .safety-note')).not.toBeEmpty();
  await expect(page.locator('.guided-how-to')).toContainText('Before your working sets');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('guided mode reaches a clear finish action without returning to the exercise list', async ({ page }) => {
  await page.goto('/#/workout?template=upper-a');
  await page.getByRole('button', { name: 'Start this workout', exact: true }).click();
  const finish = page.getByRole('button', { name: 'Finish workout', exact: true });
  for (let count = 0; count < 30 && !(await finish.isVisible()); count++) {
    const row = page.locator('form.set-editor:visible');
    await expect(row).toHaveCount(1);
    const weight = row.getByRole('spinbutton', { name: /weight$/ });
    if (await weight.count()) await weight.fill('10');
    await row.getByRole('button', { name: 'Complete set', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await page.getByLabel('Rest timer', { exact: true }).isVisible()) || (await finish.isVisible()),
      )
      .toBe(true);
    if (await page.getByLabel('Rest timer', { exact: true }).isVisible()) {
      await page.getByLabel('Dismiss timer', { exact: true }).click();
    }
  }
  await expect(finish).toBeVisible();
  await expect(page.getByLabel('Rest timer', { exact: true })).not.toBeVisible();
  await expect(page.getByText('Your planned sets are saved', { exact: true })).toBeVisible();
  await finish.click();
  await page.getByRole('button', { name: 'Finish & save session', exact: true }).click();
  await expect(page.getByText('Work put in. Progress earned.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Work put in. Progress earned.', { exact: true })).toBeVisible();
});
