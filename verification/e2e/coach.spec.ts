import { test, expect } from '@playwright/test';
import { configureAthlete } from './configured-athlete';

test.use({ locale: 'en-US', timezoneId: 'America/New_York' });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-16T17:00:00.000Z'));
  await configureAthlete(page);
});

test('Coach decisions require evidence and explicit approval, then persist', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/#/coach');
  await expect(page.getByRole('heading', { name: 'No new supported findings.' })).toBeVisible();

  await page.goto('/#/health?tab=cardio');
  const cardio = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Record a cardio session', exact: true }) });
  await cardio.getByLabel('Duration (minutes)', { exact: true }).fill('10');
  await cardio.getByLabel('Equipment or route', { exact: true }).fill('Park loop');
  await cardio.getByLabel('Conditions, pace or resistance', { exact: true }).fill('Flat, comfortable pace');
  await cardio.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(cardio).toContainText('Walking · 10 min');
  await page.goto('/#/coach');
  const aerobic = page.locator('.insight-card').filter({
    has: page.getByRole('heading', { name: 'Review this week’s recorded aerobic activity', exact: true }),
  });
  await expect(aerobic).toContainText('10 moderate/vigorous minutes recorded');
  await aerobic.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(aerobic).toHaveCount(0);
  await page.reload();
  await expect(aerobic).toHaveCount(0);

  await page.goto('/#/health?tab=movement');
  const steps = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Record daily steps', exact: true }) });
  for (const date of ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16']) {
    await steps.getByLabel('Date', { exact: true }).fill(date);
    await steps.getByLabel('Recorded steps', { exact: true }).fill('3000');
    await steps.getByLabel('Recording coverage', { exact: true }).selectOption('full');
    await steps.getByRole('button', { name: 'Save entry', exact: true }).click();
    await expect(steps.getByLabel('Recorded steps', { exact: true })).toHaveValue('');
  }
  await page.getByRole('button', { name: 'Start sitting session', exact: true }).click();
  await expect(page.getByRole('button', { name: 'End sitting session', exact: true })).toBeVisible();
  await page.goto('/#/coach');
  const walking = page.locator('.insight-card').filter({
    has: page.getByRole('heading', { name: 'Review a small walking-goal increase', exact: true }),
  });
  await walking.getByRole('button', { name: 'Review change', exact: true }).click();
  await expect(walking).toContainText('2500 steps/day → 2800 steps/day');
  await walking.getByRole('button', { name: 'Approve this change', exact: true }).click();
  await expect(
    page.getByText('Approved change saved. Existing sessions are unchanged.', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByText(/Decision history/).click();
  await expect(page.locator('.coach-history')).toContainText('accepted');
  await expect(page.locator('.coach-history')).toContainText('dismissed');
  await page.goto('/#/health?tab=movement');
  await expect(page.locator('.health-stats')).toContainText('goal 2,800');

  await page.clock.setFixedTime(new Date('2026-11-16T18:00:00.000Z'));
  await page.goto('/#/coach');
  const sitting = page.locator('.insight-card').filter({
    has: page.getByRole('heading', { name: 'Your manually started sitting timer is due', exact: true }),
  });
  await sitting.getByRole('button', { name: 'Later', exact: true }).click();
  await expect(sitting).toHaveCount(0);
  await page.reload();
  await expect(sitting).toHaveCount(0);
  await page.getByText(/Decision history/).click();
  await expect(page.locator('.coach-history')).toContainText('snoozed');
  await page.getByLabel('Daily movement', { exact: true }).click();
  await expect(page.getByLabel('Daily movement', { exact: true })).not.toBeChecked();
  await page.reload();
  await expect(page.getByLabel('Daily movement', { exact: true })).not.toBeChecked();
});

test('custom goal evidence, milestones, achievements and priority order persist', async ({ page }) => {
  await page.goto('/#/coach?tab=goals');
  const priorities = page.locator('.priority-row');
  const second = await priorities.nth(1).locator('span').nth(1).innerText();
  await priorities.nth(1).getByRole('button', { name: /up$/ }).click();
  await expect(priorities.first()).toContainText(second);
  await page.getByRole('button', { name: 'New goal', exact: true }).click();
  await page.getByLabel('Goal name', { exact: true }).fill('Controlled pull-ups');
  await page.getByRole('combobox', { name: 'Metric', exact: true }).selectOption('custom');
  await page.getByLabel('Target value', { exact: true }).fill('12');
  await page.getByLabel('Baseline · optional', { exact: true }).fill('0');
  await page.getByLabel('Target date · optional', { exact: true }).fill('2027-02-01');
  await page.getByRole('button', { name: 'Save goal', exact: true }).click();
  const goal = page
    .locator('.goal-card')
    .filter({ has: page.getByRole('heading', { name: 'Controlled pull-ups', exact: true }) });
  await expect(goal).toContainText('Manual goal check-ins');
  await expect(goal.locator('.goal-values strong').first()).toContainText('—');
  await goal.getByRole('button', { name: 'View progress', exact: true }).click();
  await goal.getByRole('button', { name: 'Add milestone', exact: true }).click();
  await goal.getByLabel('Milestone name', { exact: true }).fill('First eight');
  await goal.getByLabel('Milestone value (reps)', { exact: true }).fill('8');
  await goal.getByRole('button', { name: 'Save milestone', exact: true }).click();
  await goal.getByRole('button', { name: 'Add check-in', exact: true }).click();
  await goal.getByLabel('Recorded value', { exact: true }).fill('10');
  await goal.getByLabel('Check-in notes', { exact: true }).fill('Controlled reps, same bar');
  await goal.getByRole('button', { name: 'Save check-in', exact: true }).click();
  await expect(goal.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '83.3');
  await goal.getByRole('button', { name: 'Edit check-in 2026-11-16', exact: true }).click();
  await goal.getByLabel('Recorded value', { exact: true }).fill('12');
  await goal.getByRole('button', { name: 'Update check-in', exact: true }).click();
  await expect(goal.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await goal.getByRole('button', { name: 'Record milestone', exact: true }).click();
  await expect(goal.locator('.milestone-row')).toContainText('recorded 2026-11-16');
  await goal.getByRole('button', { name: 'Record target achievement', exact: true }).click();
  await page.getByRole('button', { name: /^Achievements/ }).click();
  await expect(goal).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /^Achievements/ }).click();
  await expect(goal).toContainText('12 reps');
  await expect(priorities.first()).toContainText(second);
  await goal.getByRole('button', { name: 'Reactivate', exact: true }).click();
  await page.getByRole('button', { name: /^Active/ }).click();
  await goal.getByRole('button', { name: 'Archive', exact: true }).click();
  await page.getByRole('button', { name: /^Archived/ }).click();
  await expect(goal).toBeVisible();
});

test('approved blocks preview changes, reject overlap and preserve base program targets', async ({
  page,
}) => {
  await page.goto('/#/coach?tab=blocks');
  await page.getByRole('button', { name: 'New training block', exact: true }).click();
  await page.getByLabel('Block name', { exact: true }).fill('November recovery week');
  await page.getByLabel('Starts', { exact: true }).fill('2026-11-16');
  await page.getByLabel('Ends', { exact: true }).fill('2026-11-22');
  await page.getByLabel('Working sets (% of base)', { exact: true }).fill('50');
  await page.getByLabel('External load (% of base)', { exact: true }).fill('80');
  await page.locator('.block-preview').first().locator('summary').click();
  await expect(page.locator('.block-preview').first()).toContainText('3 → 2');
  await page.getByRole('button', { name: 'Save approved block', exact: true }).click();
  await expect(page.locator('.block-editor')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('November recovery week', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New training block', exact: true }).click();
  await page.getByLabel('Block name', { exact: true }).fill('Overlapping week');
  await page.getByLabel('Starts', { exact: true }).fill('2026-11-22');
  await page.getByLabel('Ends', { exact: true }).fill('2026-11-25');
  await page.getByRole('button', { name: 'Save approved block', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('overlap');
  await page.getByRole('button', { name: 'Close block editor', exact: true }).click();
  await page.goto('/#/workout?template=upper-a&date=2026-11-16');
  await expect(page.getByText(/November recovery week/)).toBeVisible();
  await page.getByRole('button', { name: 'Start this workout', exact: true }).click();
  await page.getByRole('button', { name: 'Show all sets', exact: true }).click();
  await page.locator('.exercise-rail-item').filter({ hasText: 'Smith Machine Bench Press' }).click();
  await expect(page.locator('form.set-editor')).toHaveCount(2);
  await page.goto('/#/schedule');
  await page.getByRole('button', { name: 'Edit program', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Monday routine', exact: true }).click();
  const smith = page
    .locator('.prescription-editor')
    .filter({ has: page.locator('summary').filter({ hasText: 'Smith Machine Bench Press' }) });
  await smith.locator('summary').click();
  await expect(smith.getByLabel('Sets', { exact: true })).toHaveValue('3');
});

test('muscle regions, personal bands and honest empty symmetry work on mobile and desktop', async ({
  page,
}, testInfo) => {
  await page.goto('/#/coach?tab=muscle');
  await expect(page.locator('.body-diagram-pair').getByRole('button')).toHaveCount(13);
  await expect(page.locator('.pattern-card')).toHaveCount(15);
  await page
    .locator('.body-diagram-pair')
    .getByRole('button', { name: /^Rear delts:/ })
    .press('Enter');
  await expect(
    page.locator('.muscle-detail').getByRole('heading', { name: 'Rear delts', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.coach-metric-pair strong').first()).toHaveText('0');
  await expect(
    page.getByRole('heading', { name: 'Current programming emphasis', exact: true }),
  ).toBeVisible();
  await page.getByLabel('I want to emphasize this muscle', { exact: true }).click();
  await expect(page.getByLabel('I want to emphasize this muscle', { exact: true })).toBeChecked();
  await page.getByText('Customize volume bands and indirect estimates', { exact: true }).click();
  const band = page
    .locator('.target-band-row')
    .filter({ has: page.getByText('Rear delts', { exact: true }) });
  await band.getByLabel('Minimum', { exact: true }).fill('3');
  await band.getByLabel('Maximum', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Save volume preferences', exact: true }).click();
  await expect(page.locator('.muscle-detail')).toContainText('Your configurable band: 3–10 sets');
  await page.reload();
  await page
    .locator('.body-diagram-pair')
    .getByRole('button', { name: /^Rear delts:/ })
    .press('Enter');
  await expect(page.getByLabel('I want to emphasize this muscle', { exact: true })).toBeChecked();
  await expect(page.locator('.muscle-detail')).toContainText('Your configurable band: 3–10 sets');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('coach-muscle-mobile.png') });
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('coach-muscle-desktop.png') });
  await page.goto('/#/coach?tab=symmetry');
  await expect(
    page.getByRole('heading', { name: 'Both sides need comparable records.', exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
