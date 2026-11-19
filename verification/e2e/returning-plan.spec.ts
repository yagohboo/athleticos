import { expect, test, type Page } from '@playwright/test';

async function readPlanState(page: Page) {
  return page.evaluate(async () => {
    const tables = ['programs', 'templates', 'profiles', 'sessions', 'sets', 'settings'];
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('AthleticOS');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => resolve(open.result);
    });
    try {
      const transaction = database.transaction(tables, 'readonly');
      const entries = await Promise.all(
        tables.map(
          (name) =>
            new Promise<[string, Record<string, unknown>[]]>((resolve, reject) => {
              const rows = transaction.objectStore(name).getAll();
              rows.onsuccess = () => resolve([name, rows.result]);
              rows.onerror = () => reject(rows.error);
            }),
        ),
      );
      return Object.fromEntries(entries);
    } finally {
      database.close();
    }
  });
}

test('reopening an unconfigured installation recovers the plan used by its workout history', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-16T15:00:00Z'));
  // Older versions allowed starting a routine from Calendar without choosing an active program.
  await page.goto('/#/workout?template=upper-a');
  await page.getByRole('button', { name: 'Start this workout', exact: true }).click();
  await page.getByRole('button', { name: 'Complete set', exact: true }).click();
  await page.getByLabel('Dismiss timer', { exact: true }).click();
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('button', { name: 'Finish & save session', exact: true }).click();
  await expect(page.getByText('Session complete. Nice work.', { exact: true })).toBeVisible();
  const before = await readPlanState(page);
  expect(before.settings[0].activeProgramId).toBe('not-configured');
  expect(before.sessions).toHaveLength(1);
  expect(before.sessions[0]).toMatchObject({ status: 'completed', programId: 'planet-fitness' });
  expect(before.sets).toHaveLength(1);

  await page.goto('/#/');
  await page.reload();
  const logged = page.getByRole('link', { name: 'View completed workout', exact: true });
  await expect(logged).toHaveAttribute('href', `#/workout?session=${before.sessions[0].id}`);
  const after = await readPlanState(page);
  expect(after).toEqual({
    ...before,
    settings: [{ ...before.settings[0], activeProgramId: 'planet-fitness' }],
  });
  await page.clock.setFixedTime(new Date('2026-11-17T15:00:00Z'));
  await page.reload();
  await expect(page.getByRole('region', { name: 'Workout for today' })).toContainText(
    'Lower A · Power + Strength',
  );
});
