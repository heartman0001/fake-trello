import { expect, test } from '@playwright/test';
import {
  addBoardMember,    fetchBoard,
    getBoardMembers,
    login,
    openBoard,
  registerUser,
  removeBoardMember,
  signInViaApi,
  type ApiBoard,
  type AuthTokens,
} from './helpers';

test.describe('board members', () => {
  let board: ApiBoard;
  let demoAuth: AuthTokens;
  let targetUser: AuthTokens;

  test.beforeEach(async ({ page, request }, testInfo) => {
    demoAuth = await signInViaApi(page, request);
    board = await fetchBoard(request, demoAuth.accessToken);

    const label = testInfo.title.includes('removing') ? 'remove' : 'invite';
    // A freshly registered account with no workspace membership: exactly the
    // case the invite search needs to find.
    targetUser = await registerUser(request, label);
  });

  test.afterEach(async ({ request }) => {
    if (!board || !demoAuth || !targetUser) return;

    await removeBoardMember(
      request,
      demoAuth.accessToken,
      board.id,
      targetUser.user.id,
    );
  });

  test('inviting a newly registered user adds them to the board', async ({
    page,
    request,
  }) => {
    await openBoard(page, board);

    await page.getByRole('button', { name: 'Board members' }).click();
    await page.getByRole('button', { name: 'Invite', exact: true }).click();

    const modal = page.locator('[data-invite-modal="invite-modal"]');
    await expect(
      modal.getByRole('heading', { name: 'Invite member' }),
    ).toBeVisible();

    // Searching for the new account's email narrows the list to that user.
    await modal.getByPlaceholder('Search users...').fill(targetUser.user.email);
    await expect(
      modal.getByText(targetUser.user.email, { exact: true }),
    ).toBeVisible();
    await expect(
      modal.getByRole('listitem').filter({ hasText: targetUser.user.name }),
    ).toHaveCount(1);

    await modal.getByText(targetUser.user.name, { exact: true }).click();
    await modal.getByRole('button', { name: 'Invite', exact: true }).click();

    await expect(modal).toBeHidden();

    await expect
      .poll(async () => {
        const members = await getBoardMembers(
          request,
          demoAuth.accessToken,
          board.id,
        );
        return members.some((member) => member.userId === targetUser.user.id);
      })
      .toBe(true);

    // The invited member is now listed in the members panel.
    await page.getByRole('button', { name: 'Board members' }).click();
    const panel = page.locator('[data-members-panel="members-panel"]');
    await expect(
      panel.getByText(targetUser.user.name, { exact: true }).first(),
    ).toBeVisible();
  });

  test('an invited user sees the shared board on their workspaces page', async ({
    request,
    browser,
  }) => {
    await addBoardMember(
      request,
      demoAuth.accessToken,
      board.id,
      targetUser.user.id,
    );

    const context = await browser.newContext();
    try {
      const inviteePage = await context.newPage();
      await login(inviteePage, {
        email: targetUser.user.email,
        password: 'password123',
      });

      const boardLink = inviteePage.locator(`a[href="/board/${board.id}"]`);
      await expect(boardLink).toBeVisible();

      // The invited user must be able to open and use the board, not just see
      // it listed.
      await boardLink.click();
      await expect(
        inviteePage.getByRole('heading', { level: 1, name: board.title }),
      ).toBeVisible();
      await expect(inviteePage.getByRole('main', { name: 'Kanban board' }))
        .toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('removing a board member deletes their board membership', async ({
    page,
    request,
  }) => {
    await addBoardMember(
      request,
      demoAuth.accessToken,
      board.id,
      targetUser.user.id,
    );

    await openBoard(page, board);
    await page.getByRole('button', { name: 'Board members' }).click();
    await expect(
      page.getByText(targetUser.user.name, { exact: true }).first(),
    ).toBeVisible();

    const panel = page.locator('[data-members-panel="members-panel"]');
    const memberRow = panel
      .getByRole('listitem')
      .filter({ hasText: targetUser.user.name })
      .first();
    await memberRow.getByTitle('Remove member').click();

    await expect
      .poll(async () => {
        const members = await getBoardMembers(
          request,
          demoAuth.accessToken,
          board.id,
        );
        return members.some((member) => member.userId === targetUser.user.id);
      })
      .toBe(false);
  });
});
