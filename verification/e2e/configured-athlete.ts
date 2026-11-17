import { expect, type Page } from '@playwright/test';

/** Explicit synthetic preferences for regressions that model a configured
 * athlete. Fresh-install and onboarding tests deliberately do not use this.
 * No measurements, exercise results or completed activity are invented. */
export async function configureAthlete(page: Page) {
  await page.goto('/#/profile');
  await expect(page.getByRole('heading', { name: 'Profile & settings', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('AthleticOS');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(['profiles', 'settings', 'healthSettings'], 'readwrite');
      const patches = {
        profiles: {
          name: 'Test athlete',
          goals: ['Maximal strength', 'Cardiovascular fitness'],
          weeklyFrequency: 4,
          trainingExperience: 'Some resistance-training experience',
        },
        settings: { activeProgramId: 'planet-fitness' },
        healthSettings: {
          stepGoal: 2500,
          cardioGoalMinutes: 75,
          breakEnabled: true,
          breakIntervalMin: 45,
        },
      };
      for (const [table, patch] of Object.entries(patches)) {
        const store = transaction.objectStore(table);
        const request = store.get('main');
        request.onsuccess = () => {
          if (!request.result) {
            transaction.abort();
            return;
          }
          store.put({ ...request.result, ...patch });
        };
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('Configured-athlete fixture needs seeded settings.'));
    });
    database.close();
  });
  await page.reload();
}
