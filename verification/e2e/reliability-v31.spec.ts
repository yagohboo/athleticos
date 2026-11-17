import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('discarding an unfinished profile restores saved input and keeps stored records', async ({ page }) => {
  await page.goto('/#/profile?section=personal');
  const input = page.getByLabel('Your name', { exact: true });
  const original = await input.inputValue();
  await input.fill('Discard this unfinished name');
  await page.locator('.draft-recovery summary').click();
  await page.getByRole('button', { name: 'Discard draft', exact: true }).click();
  await expect(input).toHaveValue(original);
  await expect(page.locator('.draft-recovery')).toHaveCount(0);
  await expect(page.locator('.reliability-strip')).not.toContainText('Unfinished entries');
  await page.reload();
  await expect(input).toHaveValue(original);
});

test('a version3 profile draft restores through the collapsed section and saves under its new identity', async ({
  page,
}) => {
  await page.goto('/#/profile?section=personal');
  const input = page.getByLabel('Your name', { exact: true });
  await input.fill('Retain my version3 draft');
  await input.press('Tab');
  await expect(page.locator('.draft-recovery summary')).toContainText('1 unfinished');
  // Reproduce the exact heading/ordered-field identity used by the shipped3.0 editor.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const form = document
          .querySelector<HTMLInputElement>('input[aria-label="Your name"]')!
          .closest('form')!;
        const fields = [
          ...form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
            'input,select,textarea',
          ),
        ].filter(
          (field) =>
            !['password', 'file', 'hidden', 'submit', 'button'].includes(field.type) &&
            !field.closest('[data-no-draft]'),
        );
        const keys = fields.map(
          (field, index) =>
            `${field.name || field.getAttribute('aria-label') || field.closest('label')?.textContent?.trim().slice(0, 100) || field.tagName}:${index}`,
        );
        const heading = form.closest('section')!.querySelector('h2,h3')!.textContent!.trim();
        const request = indexedDB.open('AthleticOS');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result,
            transaction = database.transaction('drafts', 'readwrite');
          const store = transaction.objectStore('drafts'),
            query = store.getAll();
          query.onsuccess = () => {
            const record = query.result.find((row) => row.values['name:0'] === 'Retain my version3 draft');
            if (!record) {
              transaction.abort();
              return;
            }
            store.delete(record.id);
            delete record.values.__athleticos_display_units;
            store.put({
              ...record,
              route: '#/profile',
              id: JSON.stringify(['#/profile', `${heading}|${keys.join('|')}`]),
            });
          };
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onabort = () => {
            database.close();
            reject(transaction.error ?? new Error('Fixture draft missing'));
          };
        };
      }),
  );
  await page.goto('/#/profile');
  // Force the real lazy page to finish after a fast Restore tap. The recovery
  // strip is available before the Profile chunk/editor on a slower connection.
  let releaseEditor = () => {};
  const editorGate = new Promise<void>((resolve) => (releaseEditor = resolve));
  await page.route('**/assets/Profile-*.js', async (route) => {
    await editorGate;
    await route.continue();
  });
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.draft-recovery summary')).toContainText('1 unfinished');
    await expect(input).toHaveCount(0);
    await page.locator('.draft-recovery summary').click();
    await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  } finally {
    releaseEditor();
  }
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('Retain my version3 draft');
  await expect(input).toBeFocused();
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Retain my version3 draft', exact: true })).toBeVisible();
  await expect(page.locator('.draft-recovery')).toHaveCount(0);
});

test('navigation blur keeps an unfinished draft with its original editor route', async ({ page }) => {
  await page.goto('/#/profile?section=personal');
  await page.getByLabel('Your name', { exact: true }).fill('Keep this on my profile');
  await expect(page.locator('.draft-recovery summary')).toContainText('1 unfinished');
  await page.goto('/#/health');
  await page.goto('/#/profile?section=personal');
  await expect(page.getByLabel('Your name', { exact: true })).toBeVisible();
  const drafts = await page.evaluate(
    () =>
      new Promise<{ route: string }[]>((resolve, reject) => {
        const request = indexedDB.open('AthleticOS');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('drafts', 'readonly');
          const query = transaction.objectStore('drafts').getAll();
          transaction.oncomplete = () => {
            database.close();
            resolve(query.result);
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
  );
  expect(drafts).toHaveLength(1);
  expect(drafts[0].route).toBe('#/profile');
});

test('a slow save blocks conflicting edits and rapid submits create only one record', async ({ page }) => {
  await page.goto('/#/progress?tab=body');
  const weight = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Morning bodyweight', exact: true }) });
  await weight.getByLabel('Bodyweight (lb)', { exact: true }).fill('219');
  await weight.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(weight.getByRole('button', { name: 'Edit 219 lb', exact: true })).toBeVisible();
  await weight.getByLabel('Bodyweight (lb)', { exact: true }).fill('218');
  // Hold an actual IndexedDB writer to reproduce slow device storage, without mocking app saves.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('AthleticOS');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result,
            transaction = database.transaction('bodyweights', 'readwrite');
          const store = transaction.objectStore('bodyweights');
          let released = false,
            announced = false;
          const deadline = performance.now() + 15000;
          (window as Window & { releaseTestWriter?: () => void }).releaseTestWriter = () => {
            released = true;
          };
          const hold = () => {
            const query = store.get('test-writer-only');
            query.onsuccess = () => {
              if (!announced) {
                announced = true;
                resolve();
              }
              if (!released && performance.now() < deadline) hold();
            };
          };
          transaction.oncomplete = () => database.close();
          transaction.onabort = () => {
            database.close();
            reject(transaction.error);
          };
          hold();
        };
      }),
  );
  await weight.locator('form').evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(weight.getByLabel('Bodyweight (lb)', { exact: true })).toBeDisabled();
  await expect(weight.getByRole('button', { name: 'Edit 219 lb', exact: true })).toBeDisabled();
  await page.evaluate(() => (window as Window & { releaseTestWriter?: () => void }).releaseTestWriter?.());
  await expect(weight.getByRole('button', { name: 'Edit 218 lb', exact: true })).toHaveCount(1);
  await expect(weight.locator('.entry-row')).toHaveCount(2);
  await expect(weight.getByLabel('Bodyweight (lb)', { exact: true })).toBeEnabled();
  await page.reload();
  await expect(weight.getByRole('button', { name: 'Edit 218 lb', exact: true })).toHaveCount(1);
  await expect(weight.getByRole('button', { name: 'Edit 219 lb', exact: true })).toHaveCount(1);
});
