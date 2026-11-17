import { test, expect } from '@playwright/test';

test('common logs are direct and tool search opens the right settings section', async ({ page }) => {
  await page.goto('/#/');
  const quick = page.getByRole('navigation', { name: 'Quick logging' });
  await expect(quick.getByRole('link')).toHaveCount(4);
  await expect(quick.getByRole('link', { name: 'Log a meal', exact: true })).toBeInViewport();
  await expect(page.locator('#tool-home-review')).not.toHaveAttribute('open');
  await page.getByRole('button', { name: 'Find a tool', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Find a tool', { exact: true })).toBeFocused();
  await dialog.getByLabel('Find a tool', { exact: true }).fill('backup');
  await dialog.getByRole('link', { name: 'Backups, restore & Recently deleted Settings' }).click();
  await expect(page.getByRole('button', { name: 'Export complete JSON backup', exact: true })).toBeVisible();
  await expect(page.getByLabel('Your name', { exact: true })).not.toBeVisible();
  await expect(page.locator('#tool-backups')).toHaveAttribute('open', '');
  await expect(page.getByRole('button', { name: 'Workout sets CSV', exact: true })).not.toBeVisible();
  await page.getByText('Export spreadsheets (CSV)', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Workout sets CSV', exact: true })).toBeVisible();
  await page.locator('#tool-backups > summary').click();
  await page.getByRole('button', { name: 'Find a tool', exact: true }).click();
  await dialog.getByLabel('Find a tool', { exact: true }).fill('backup');
  await dialog.getByRole('link', { name: 'Backups, restore & Recently deleted Settings' }).click();
  await expect(page.locator('#tool-backups')).toHaveAttribute('open', '');
  await page.getByRole('button', { name: 'Find a tool', exact: true }).click();
  await dialog.getByLabel('Find a tool', { exact: true }).fill('nothing-matches-this');
  await expect(dialog.getByText(/No matching tool/)).toBeVisible();
  await dialog.getByLabel('Find a tool', { exact: true }).press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Find a tool', exact: true })).toBeFocused();
});

test('closing a settings section preserves typed fields and deep links open updates', async ({ page }) => {
  await page.goto('/#/profile?section=personal');
  const section = page.locator('#tool-personal');
  const name = page.getByLabel('Your name', { exact: true });
  await name.fill('Still here while folded');
  await section.locator(':scope > summary').click();
  await expect(name).not.toBeVisible();
  await section.locator(':scope > summary').click();
  await expect(name).toHaveValue('Still here while folded');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Still here while folded', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'App updates', exact: true }).click();
  await expect(page.getByText('AthleticOS 3.2.0', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check for updates', exact: true })).toBeVisible();
  await expect(name).not.toBeVisible();
});

test('mobile menus expose every area, planning deep links persist, and narrow layouts fit', async ({
  page,
}) => {
  await page.goto('/#/train');
  const training = page.getByRole('combobox', { name: 'Training section', exact: true });
  await training.selectOption('/tools');
  await expect(training).toHaveValue('/tools');
  await expect(page.getByRole('heading', { name: 'Training toolkit.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Find a tool', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Find a tool', { exact: true }).fill('restart');
  await dialog.getByRole('link', { name: 'Restart & training emphasis Coach' }).click();
  await expect(page.getByLabel('Days since your last actual training', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Days since your last actual training', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Coach section', exact: true }).selectOption('testing');
  await expect(page.getByRole('heading', { name: 'Build a repeatable test', exact: true })).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(
      true,
    );
  }
});
