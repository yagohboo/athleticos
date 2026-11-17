import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('unfinished profile form restores after reload and clears only after saving', async ({ page }) => {
  await page.goto('/#/profile?section=personal');
  await page.getByLabel('Your name', { exact: true }).fill('Recover my unfinished profile');
  await expect(page.locator('.draft-recovery summary')).toContainText('unfinished');
  await page.reload();
  await expect(page.getByLabel('Your name', { exact: true })).not.toHaveValue(
    'Recover my unfinished profile',
  );
  await page.locator('.draft-recovery summary').click();
  await page.getByRole('button', { name: 'Restore draft', exact: true }).first().click();
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Recover my unfinished profile');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Recover my unfinished profile', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.draft-recovery')).toHaveCount(0);
  await expect(page.locator('.reliability-strip')).toContainText('Saved on this device');
  await page.reload();
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Recover my unfinished profile');
});

test('encrypted export unlocks to a validated preview and a wrong password never changes saved data', async ({
  page,
}, testInfo) => {
  await page.goto('/#/profile?section=personal');
  await page.getByLabel('Your name', { exact: true }).fill('Encrypted backup athlete');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Encrypted backup athlete', exact: true })).toBeVisible();
  await page.locator('#tool-backups > summary').click();
  await page.getByText('Password-encrypted backup', { exact: true }).click();
  await page
    .getByLabel('Backup password (at least 12 characters)', { exact: true })
    .fill('Private test password 123');
  await page.getByLabel('Confirm backup password', { exact: true }).fill('Private test password 123');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export encrypted backup', exact: true }).click();
  const target = testInfo.outputPath('encrypted-backup.json');
  await (await downloaded).saveAs(target);
  const contents = await readFile(target, 'utf8');
  expect(JSON.parse(contents).app).toBe('AthleticOS-encrypted');
  expect(contents).not.toContain('Encrypted backup athlete');
  await expect(page.getByLabel('Backup password (at least 12 characters)', { exact: true })).toHaveValue('');
  await page.getByLabel('Your name', { exact: true }).fill('Current local profile');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await page.getByText('Restore a JSON backup', { exact: true }).click();
  await page.getByLabel('Backup JSON file', { exact: true }).setInputFiles(target);
  await page.getByLabel('Unlock backup password', { exact: true }).fill('This password is wrong');
  await page.getByRole('button', { name: 'Unlock and preview backup', exact: true }).click();
  await expect(page.getByText(/Could not unlock this backup/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Current local profile', exact: true })).toBeVisible();
  await page.getByLabel('Unlock backup password', { exact: true }).fill('Private test password 123');
  await page.getByRole('button', { name: 'Unlock and preview backup', exact: true }).click();
  await expect(page.getByText('Validated backup preview', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Current local profile', exact: true })).toBeVisible();
  await page.getByLabel('Restore behavior', { exact: true }).selectOption('replace');
  await page.getByLabel('Type REPLACE to confirm replacement', { exact: true }).fill('REPLACE');
  await page.getByRole('button', { name: 'Validate and replace local data', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Encrypted backup athlete', exact: true })).toBeVisible();
  await page.getByText(/^Recovery copies \(/).click();
  await expect(page.getByText('Before replace backup restore', { exact: true })).toBeVisible();
});

test('deleted measurements can be recovered and the update center reports offline checks honestly', async ({
  page,
  context,
}) => {
  await page.goto('/#/progress?tab=body');
  const weight = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Morning bodyweight', exact: true }) });
  await weight.getByLabel('Bodyweight (lb)', { exact: true }).fill('219');
  await weight.getByRole('button', { name: 'Save entry', exact: true }).click();
  await weight.getByRole('button', { name: 'Delete 219 lb', exact: true }).click();
  await weight.getByRole('button', { name: 'Delete?', exact: true }).click();
  await expect(weight.getByRole('button', { name: 'Edit 219 lb', exact: true })).toHaveCount(0);
  await page.goto('/#/profile?section=backups');
  await page.getByText(/^Recently deleted \(/).click();
  await expect(page.getByText('219 lb', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Recover entry', exact: true }).click();
  await expect(page.getByText('Entry recovered. Existing records were kept.', { exact: true })).toBeVisible();
  await page.goto('/#/progress?tab=body');
  await expect(weight.getByRole('button', { name: 'Edit 219 lb', exact: true })).toBeVisible();
  await page.goto('/#/profile?section=updates');
  await expect(page.getByText('AthleticOS 3.2.0', { exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
  await expect(
    page.getByText('Connect to the internet to check for updates.', { exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
});

test('another window cannot edit until the current editor closes', async ({ page, context }) => {
  await page.goto('/#/profile?section=personal');
  await page.getByLabel('Your name', { exact: true }).fill('Single editor athlete');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Single editor athlete', exact: true })).toBeVisible();
  const second = await context.newPage();
  await second.goto('/#/profile?section=personal');
  await expect(second.getByText('This window is read-only.', { exact: true })).toBeVisible();
  await expect(second.locator('[inert]')).toBeVisible();
  await page.close();
  await Promise.all([
    second.waitForEvent('framenavigated', { predicate: (frame) => frame === second.mainFrame() }),
    second.getByRole('button', { name: 'Use this window', exact: true }).click(),
  ]);
  await second.waitForLoadState('domcontentloaded');
  await expect(second.locator('.editing-notice')).toHaveCount(0);
  await expect(second.getByLabel('Your name', { exact: true })).toHaveValue('Single editor athlete');
});
