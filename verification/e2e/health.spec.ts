import { test, expect } from '@playwright/test';

test('mobility routines are editable, resumable snapshots with honest partial completion', async ({
  page,
}) => {
  await page.goto('/#/health?tab=mobility');
  await expect(page.getByRole('button', { name: 'Start mobility routine', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit routine', exact: true }).click();
  await page.locator('.routine-drill-editor').first().locator('summary').click();
  await page.getByLabel('Disable Shoulder circles in future routines', { exact: true }).check();
  await page.getByRole('button', { name: 'Save routine changes', exact: true }).click();
  await page.getByRole('button', { name: 'Start mobility routine', exact: true }).click();
  await expect(page.locator('.mobility-active')).toBeVisible();
  await expect(
    page.locator('.mobility-active').getByLabel('Complete Shoulder circles', { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('Complete Cat-cow', { exact: true }).check();
  await expect(page.getByLabel('Complete Cat-cow', { exact: true })).toBeChecked();
  await page
    .locator('.mobility-active')
    .getByRole('button', { name: 'Start 60s drill timer', exact: true })
    .first()
    .click();
  await expect(page.getByRole('timer', { name: 'Mobility drill countdown', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Complete Cat-cow', { exact: true })).toBeChecked();
  await expect(page.getByRole('timer', { name: 'Mobility drill countdown', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit routine', exact: true }).click();
  await page.locator('.routine-drill-editor').nth(1).locator('summary').click();
  await page.getByLabel('Drill 2 name', { exact: true }).fill('Modified future cat-cow');
  await page.getByRole('button', { name: 'Save routine changes', exact: true }).click();
  await expect(
    page.locator('.mobility-active').getByLabel('Complete Cat-cow', { exact: true }),
  ).toBeChecked();
  await page.getByRole('button', { name: 'Finish mobility session', exact: true }).click();
  await page.getByLabel('Actual routine duration (minutes)', { exact: true }).fill('6');
  await page.getByRole('button', { name: 'Save mobility session', exact: true }).click();
  await expect(page.locator('.mobility-active')).toHaveCount(0);
  await expect(page.locator('.mobility-history').first().locator('summary').first()).toContainText(
    '1/5 drills',
  );
  const assessment = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Record a mobility assessment', exact: true }) })
    .last();
  await assessment.getByLabel('Measured result', { exact: true }).fill('8');
  await assessment
    .getByLabel('Setup and testing conditions', { exact: true })
    .fill('Barefoot, heel stays down, same wall');
  await assessment.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(
    assessment.getByRole('button', { name: 'Edit Knee-to-wall ankle distance: 8 cm', exact: true }),
  ).toBeVisible();
});

test('walking coverage and manual sitting reminders persist without passive detection', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-13T17:00:00Z') });
  await page.goto('/#/health?tab=movement');
  await expect(page.getByRole('button', { name: 'Start sitting session', exact: true })).toBeVisible();
  const walking = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Record daily steps', exact: true }) });
  await walking.getByLabel('Recorded steps', { exact: true }).fill('2300');
  await walking.getByLabel('Recording coverage', { exact: true }).selectOption('partial');
  await walking.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(walking.getByRole('button', { name: 'Edit 2,300 steps', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start sitting session', exact: true }).click();
  await expect(page.getByRole('timer', { name: 'Movement break countdown', exact: true })).toHaveText(
    '45:00',
  );
  await page.getByLabel('Health history range', { exact: true }).selectOption('180');
  await expect(walking.getByRole('button', { name: 'Edit 2,300 steps', exact: true })).toBeVisible();
  await page.getByLabel('Health history range', { exact: true }).selectOption('custom');
  await page.getByLabel('Health history from', { exact: true }).fill('2026-10-01');
  await page.getByLabel('Health history through', { exact: true }).fill('2026-11-12');
  await expect(walking.getByRole('button', { name: 'Edit 2,300 steps', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'End sitting session', exact: true })).toBeVisible();
  await expect(page.locator('.health-stat').filter({ hasText: 'Steps today' })).toContainText('2,300');
  await page.getByLabel('Health history through', { exact: true }).fill('2026-11-13');
  await expect(walking.getByRole('button', { name: 'Edit 2,300 steps', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'End sitting session', exact: true })).toBeVisible();
  await page.clock.fastForward(45 * 60000);
  await expect(page.getByText('A movement break is due', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Snooze 10 minutes', exact: true }).click();
  await expect(page.getByRole('timer', { name: 'Movement break countdown', exact: true })).toHaveText(
    '10:00',
  );
  await page.getByRole('button', { name: 'Complete movement break', exact: true }).click();
  await expect(page.getByText('3 min · Comfortable walk', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Skip break', exact: true }).click();
  await page.getByRole('button', { name: 'End sitting session', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start sitting session', exact: true })).toBeVisible();
  await expect(page.getByRole('timer', { name: 'Movement break countdown', exact: true })).toHaveText('—');
});

test('cardio, joint symptoms, balance and health plans use real editable records', async ({ page }) => {
  await page.goto('/#/health?tab=cardio');
  const cardio = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Record a cardio session', exact: true }) });
  await cardio.getByLabel('Duration (minutes)', { exact: true }).fill('25');
  await cardio.getByLabel('Equipment or route', { exact: true }).fill('Neighborhood route');
  await cardio
    .getByLabel('Conditions, pace or resistance', { exact: true })
    .fill('Conversation comfortable, level ground');
  await cardio.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(cardio.getByRole('button', { name: 'Edit Walking · 25 min', exact: true })).toBeVisible();
  await page.goto('/#/health?tab=joints');
  const joint = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Record joint discomfort', exact: true }) });
  await joint.getByLabel('Discomfort intensity (0 none – 10 highest)', { exact: true }).fill('3');
  await joint.getByLabel('Type of discomfort', { exact: true }).fill('Ache');
  await joint.getByLabel('Triggering movement or situation', { exact: true }).fill('Overhead reach');
  await joint.getByLabel('Duration (minutes)', { exact: true }).fill('10');
  await joint.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(
    joint.getByRole('button', { name: 'Edit Shoulders · bilateral · 3/10', exact: true }),
  ).toBeVisible();
  await page.goto('/#/health?tab=balance');
  const balance = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Record balance or stability', exact: true }) });
  for (const [side, value] of [
    ['left', '20'],
    ['right', '25'],
  ]) {
    await balance.getByLabel('Side', { exact: true }).selectOption(side);
    await balance.getByLabel('Balance result', { exact: true }).fill(value);
    await balance.getByLabel('Support used', { exact: true }).fill('Fingertips on chair');
    await balance
      .getByLabel('Surface, shoes, vision and conditions', { exact: true })
      .fill('Level floor, shoes, eyes open');
    await balance.getByLabel('Self-reported stability (1 low – 5 steady)', { exact: true }).fill('4');
    await balance.getByRole('button', { name: 'Save entry', exact: true }).click();
    await expect(
      balance.getByRole('button', { name: `Edit Single-leg stand · ${side}: ${value} sec`, exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByText('20% observed difference', { exact: true })).toBeVisible();
  await page.goto('/#/health');
  await page
    .locator('summary')
    .filter({ hasText: /^Plan a health activity$/ })
    .click();
  const plan = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Plan a health activity', exact: true }) });
  await plan.getByLabel('Activity type', { exact: true }).selectOption('cardio');
  await plan.getByLabel('Planned activity title', { exact: true }).fill('Easy walk after lunch');
  await plan.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(plan.getByRole('button', { name: 'Edit Easy walk after lunch', exact: true })).toBeVisible();
  await page.reload();
  await page
    .locator('summary')
    .filter({ hasText: /^Plan a health activity$/ })
    .click();
  await expect(plan.getByRole('button', { name: 'Edit Easy walk after lunch', exact: true })).toBeVisible();
});

test('all Health sections load offline and fit a phone', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/health');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  for (const [tab, heading] of [
    ['overview', 'Your daily foundations'],
    ['mobility', 'A few minutes, done consistently.'],
    ['movement', 'Sitting and movement breaks'],
    ['cardio', 'More capacity, at your pace.'],
    ['joints', 'Joint health and resilience'],
    ['balance', 'Balance, stability and coordination'],
    ['recovery', 'Recovery supports your next session.'],
    ['nutrition', 'Build meals you can repeat.'],
  ]) {
    await page.goto(`/#/health?tab=${tab}`);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await context.setOffline(false);
});
