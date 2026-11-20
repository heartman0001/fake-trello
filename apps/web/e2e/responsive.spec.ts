import { expect, test, type Page } from '@playwright/test';
import { fetchBoard, login, signInViaApi } from './helpers';

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    window.scrollTo(10_000, 0);
    const horizontalScroll = window.scrollX;
    window.scrollTo(0, 0);

    if (horizontalScroll === 0) {
      return null;
    }

    const offenders = Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .map((element) => ({ element, box: element.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.right > viewportWidth + 1)
      .slice(0, 8)
      .map(
        ({ element, box }) =>
          `${element.tagName.toLowerCase()}.${String(element.className)} right=${Math.round(box.right)} width=${Math.round(box.width)}`,
      );

    const main = document.querySelector('main');
    const mainBox = main?.getBoundingClientRect();
    const mainStyle = main ? getComputedStyle(main) : null;

    return {
      horizontalScroll,
      viewportWidth,
      scrollWidth: document.documentElement.scrollWidth,
      offenders,
      debug: mainBox && mainStyle
        ? `main right=${Math.round(mainBox.right)} width=${Math.round(mainBox.width)} scrollWidth=${main!.scrollWidth} clientWidth=${main!.clientWidth} overflowX=${mainStyle.overflowX} display=${mainStyle.display} maxWidth=${mainStyle.maxWidth} class=${main!.className} parentWidth=${Math.round(main!.parentElement!.getBoundingClientRect().width)} parentOverflowX=${getComputedStyle(main!.parentElement!).overflowX} bodyScrollWidth=${document.body.scrollWidth}`
        : 'no main',
    };
  });

  expect(
    overflow,
    overflow
      ? `page overflows by ${overflow.scrollWidth - overflow.viewportWidth}px (window scrollX after scrolling: ${overflow.horizontalScroll})\n${overflow.debug}\n${overflow.offenders.join('\n')}`
      : undefined,
  ).toBeNull();
}

test.describe('mobile layout', () => {
  test('workspace actions move below the workspace header', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);

    const header = page.locator('[data-workspace-header]').first();
    await expect(header).toBeVisible();
    await expect(header).toHaveCSS('display', 'block');

    const titleBox = await header.locator('h3').first().boundingBox();
    const actionsBox = await header
      .locator('[data-workspace-actions]')
      .boundingBox();

    expect(titleBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();
    expect(actionsBox!.y).toBeGreaterThanOrEqual(
      titleBox!.y + titleBox!.height,
    );
  });

  test('settings page does not overflow the mobile viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('key pages do not overflow a 320px viewport', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    const auth = await signInViaApi(page, request);
    const board = await fetchBoard(request, auth.accessToken);

    await page.goto('/workspaces');
    await expect(page.getByRole('heading', { name: 'Your work' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto(`/board/${board.id}`);
    await expect(
      page.getByRole('heading', { level: 1, name: board.title }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto(`/workspaces/${board.workspaceId}/members`);
    await expect(page.getByText('Members', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto(`/board/${board.id}/analytics`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
