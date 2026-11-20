import { expect, test } from '@playwright/test';
import {
  addBoardMember,
  fetchBoard,
  getWorkspaceManagement,
  registerUser,
  removeBoardMember,
  removeWorkspaceMember,
  signInViaApi,
  type ApiBoard,
  type AuthTokens,
} from './helpers';

test.describe('workspace member management', () => {
  let board: ApiBoard;
  let demoAuth: AuthTokens;
  let targetUser: AuthTokens;

  test.beforeEach(async ({ page, request }) => {
    demoAuth = await signInViaApi(page, request);
    board = await fetchBoard(request, demoAuth.accessToken);
    targetUser = await registerUser(request, 'promote');
  });

  test.afterEach(async ({ request }) => {
    if (!board || !demoAuth || !targetUser) return;

    await removeWorkspaceMember(
      request,
      demoAuth.accessToken,
      board.workspaceId,
      targetUser.user.id,
    );
    await removeBoardMember(
      request,
      demoAuth.accessToken,
      board.id,
      targetUser.user.id,
    );
  });

  test('pending board invitees are shown on the workspaces page', async ({
    page,
    request,
  }) => {
    await addBoardMember(
      request,
      demoAuth.accessToken,
      board.id,
      targetUser.user.id,
    );

    await page.goto('/workspaces');

    const pending = page
      .getByTestId('pending-invitees')
      .filter({ hasText: targetUser.user.name });
    await expect(pending).toBeVisible();
    await expect(pending).toContainText(board.title);

    await pending.getByRole('link', { name: 'Manage' }).click();

    await expect(page).toHaveURL(
      new RegExp(`/workspaces/${board.workspaceId}/members$`),
    );
    await expect(page.getByTestId('board-invitees')).toContainText(
      targetUser.user.email,
    );
  });

  test('a board invitee can be promoted to workspace admin', async ({
    page,
    request,
  }) => {
    await addBoardMember(
      request,
      demoAuth.accessToken,
      board.id,
      targetUser.user.id,
    );

    await page.goto(`/workspaces/${board.workspaceId}/members`);

    const inviteeSection = page.getByTestId('board-invitees');
    await expect(inviteeSection).toBeVisible();

    const inviteeRow = inviteeSection
      .getByRole('listitem')
      .filter({ hasText: targetUser.user.email });
    await expect(inviteeRow).toBeVisible();
    await expect(inviteeRow).toContainText(board.title);

    // Pick the admin role before adding, i.e. promote on the way in.
    await inviteeRow.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Admin' }).click();
    await inviteeRow.getByRole('button', { name: 'Add to workspace' }).click();

    await expect(inviteeRow).toBeHidden();

    await expect
      .poll(async () => {
        const management = await getWorkspaceManagement(
          request,
          demoAuth.accessToken,
          board.workspaceId,
        );
        return management.members.find(
          (member) => member.userId === targetUser.user.id,
        )?.role;
      })
      .toBe('ADMIN');

    const memberRow = page
      .getByRole('listitem')
      .filter({ hasText: targetUser.user.email });
    await expect(memberRow).toBeVisible();
    await expect(memberRow).toContainText('Admin');
    await expect(memberRow).not.toContainText('Board invitee');
  });
});
