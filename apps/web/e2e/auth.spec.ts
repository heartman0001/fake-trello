import { expect, test } from '@playwright/test';
import { DEMO_USER, login } from './helpers';

test.describe('authentication', () => {
  test('unauthenticated visitor is redirected to the login page', async ({
    page,
  }) => {
    await page.goto('/workspaces');

    await expect(page).toHaveURL(/\/login\?next=%2Fworkspaces$/);
    await expect(
      page.getByRole('heading', { name: 'Welcome back' }),
    ).toBeVisible();
  });

  test('demo user can sign in and see their workspace and board', async ({
    page,
  }) => {
    await login(page);

    await expect(page.getByText(`Signed in as ${DEMO_USER.name}`)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your work' })).toBeVisible();
    await expect(page.locator('a[href^="/board/"]').first()).toBeVisible();
  });

  test('invalid password shows an error and stays on the login page', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(DEMO_USER.email);
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('signing out returns to the login page', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await page.getByRole('button', { name: 'Sign out' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/workspaces');
    await expect(page).toHaveURL(/\/login\?next=%2Fworkspaces$/);
  });

  test('signing out clears another tab instead of leaving cached data', async ({
    page,
    context,
  }) => {
    await login(page);

    const otherTab = await context.newPage();
    await otherTab.goto('/workspaces');
    await expect(otherTab.getByRole('heading', { name: 'Your work' })).toBeVisible();
    await expect(
      otherTab.locator('a[href^="/board/"]').first(),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();

    await expect(otherTab).toHaveURL(/\/login/);
    await expect(
      otherTab.getByRole('heading', { name: 'Your work' }),
    ).toHaveCount(0);
  });
});
