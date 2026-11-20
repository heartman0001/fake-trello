import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import { BASE_URL, registerUser } from './helpers';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z3x8AAAAASUVORK5CYII=',
  'base64',
);

async function signInAsNewUser(page: Page, request: APIRequestContext) {
  const auth = await registerUser(request, 'settings');
  await page.context().addCookies([
    { name: 'accessToken', value: auth.accessToken, url: BASE_URL },
    { name: 'refreshToken', value: auth.refreshToken, url: BASE_URL },
  ]);
  return auth;
}

test.describe('account settings', () => {
  test('updates profile details, avatar, language, and font', async ({
    page,
    request,
  }) => {
    await signInAsNewUser(page, request);
    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    const nextName = `Updated ${Date.now()}`;
    await page.getByLabel('Display name').fill(nextName);
    await page.locator('#avatar-upload').setInputFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: ONE_PIXEL_PNG,
    });
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByText('Profile updated.')).toBeVisible();
    await page.reload();
    await expect(page.getByText(nextName, { exact: true }).first()).toBeVisible();
    await expect(page.getByAltText(`${nextName}'s profile photo`).first()).toBeVisible();

    await page.getByRole('radio', { name: /ไทย/ }).click();
    await expect(page.getByRole('heading', { name: 'ตั้งค่า' })).toBeVisible();

    await page.getByRole('radio', { name: /Sarabun/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-font', 'sarabun');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'ตั้งค่า' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-font', 'sarabun');

    await page.goto('/workspaces');
    await expect(page.getByRole('heading', { name: 'งานของคุณ' })).toBeVisible();
  });

  test('changes the password and can sign in with it', async ({
    page,
    request,
  }) => {
    const auth = await signInAsNewUser(page, request);
    await page.goto('/settings');

    await page.getByLabel('Current password').fill('password123');
    await page.getByLabel('New password', { exact: true }).fill('new-password-123');
    await page.getByLabel('Confirm new password').fill('new-password-123');
    await page.getByRole('button', { name: 'Update password' }).click();

    await expect(page.getByText('Password updated.')).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Email').fill(auth.user.email);
    await page.getByLabel('Password').fill('new-password-123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/workspaces$/);
  });
});
