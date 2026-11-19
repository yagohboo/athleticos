import { test, expect } from '@playwright/test';

test('a new person chooses a plan, resumes setup, and starts on a non-training day', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-18T15:00:00Z'));
  await page.goto('/#/');
  await expect(page.getByRole('link', { name: 'Build my plan', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Build my plan', exact: true }).click();
  await page.getByRole('button', { name: /Build muscle Train consistently/ }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Dumbbells Not selected', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'What fits your week?', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '20 minutes', exact: true }).click();
  await page.getByRole('button', { name: 'See my plan', exact: true }).click();
  await expect(page.locator('.setup-preview')).toContainText('Build muscle');
  await page.getByText('Mon · Full body A', { exact: false }).click();
  await expect(page.locator('.setup-preview')).toContainText('Dumbbell Floor Press');
  await expect(page.locator('.setup-preview')).not.toContainText('Smith');
  await page.getByLabel('Your name (optional)', { exact: true }).fill('New lifter');
  await page.getByLabel('Weight units', { exact: true }).selectOption('kg');
  await page.getByRole('button', { name: 'Use this plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Start with one workout.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start my first workout', exact: true }).click();
  await expect(page.locator('.gym-focused')).toBeVisible();
  await expect(page.locator('form.set-editor:visible')).toHaveCount(1);
  await expect(page.locator('.exercise-focus h2')).toHaveText('Goblet Squat');
  await expect(page.getByLabel('Set 1 weight', { exact: true })).toHaveValue('');
  await page.getByLabel('Set 1 weight', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Complete set', exact: true }).click();
  await expect(page.getByLabel('Rest timer', { exact: true })).toContainText('Set 2');
  await page.reload();
  await expect(page.getByLabel('Rest timer', { exact: true })).toContainText('Goblet Squat');
  await page.goto('/#/setup');
  await expect(
    page.getByRole('heading', { name: 'Your workout is in progress.', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use this plan', exact: true })).toHaveCount(0);
  await expect(page.getByText(/Finish or cancel your active workout/)).toBeVisible();
  await page.getByRole('link', { name: 'Resume workout', exact: true }).click();
  await expect(page.locator('.exercise-focus h2')).toHaveText('Goblet Squat');
});

test('Home opens the original plan without setup and starts or resumes the same workout', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-16T15:00:00Z'));
  await page.goto('/#/');
  const useOriginal = page.getByRole('button', { name: 'Use original plan', exact: true });
  await expect(useOriginal).toBeInViewport();
  await useOriginal.click();
  const card = page.getByRole('region', { name: 'Workout for today' });
  await expect(card.getByRole('heading')).toHaveText('Upper A · Power + Strength');
  await expect(card).toContainText('Athletic Strength & Physique — Planet Fitness');
  await expect(page).toHaveURL(/#\/$/);
  await page.reload();
  const start = page.getByRole('button', { name: 'Start workout', exact: true });
  await expect(start).toBeInViewport();
  await expect(page.getByRole('link', { name: 'View plan', exact: true })).toBeVisible();
  await start.dblclick();
  await expect(page.locator('.gym-focused')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start this workout', exact: true })).toHaveCount(0);
  const url = page.url();
  await page.goto('/#/');
  await page.getByRole('link', { name: 'Resume workout', exact: true }).click();
  await expect(page).toHaveURL(url);
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('button', { name: 'Finish & save session', exact: true }).click();
  await page.goto('/#/train');
  await expect(page.getByRole('link', { name: 'View completed session', exact: true })).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-11-17T15:00:00Z'));
  await page.reload();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(page.locator('.gym-focused')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lower A · Power + Strength');
});

test('setup handles empty day selection and a small screen without losing choices', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 680 });
  await page.goto('/#/setup');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Mon', exact: true }).click();
  await page.getByRole('button', { name: 'Thu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'See my plan', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Mon', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: 'Tue', exact: true }).click();
  await page.getByRole('button', { name: 'Fri', exact: true }).click();
  await page.getByRole('button', { name: 'See my plan', exact: true }).click();
  await expect(page.locator('.setup-preview')).toContainText('full-body');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
