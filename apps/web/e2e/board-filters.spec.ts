import { expect, test } from '@playwright/test';
import {
  allCards,
  fetchBoard,
  labelCounts,
  matchingCardCount,
  openBoard,
  openFilterPanel,
  signInViaApi,
  type ApiBoard,
} from './helpers';

test.describe('board filters', () => {
  let board: ApiBoard;
  let totalCards: number;

  test.beforeEach(async ({ page, request }) => {
    const auth = await signInViaApi(page, request);
    board = await fetchBoard(request, auth.accessToken);
    totalCards = allCards(board).length;
    expect(totalCards, 'demo board needs cards to filter').toBeGreaterThan(0);
    await openBoard(page, board);
  });

  test('label filter uses the custom select and narrows the board', async ({
    page,
  }) => {
    const counts = labelCounts(board);
    const label = board.labels.find((entry) => {
      const count = counts.get(entry.id) ?? 0;
      return count > 0 && count < totalCards;
    });
    test.skip(!label, 'needs a label applied to some, but not all, cards');

    const cards = allCards(board);
    const included = cards.find((card) =>
      card.labels.some((entry) => entry.label.id === label!.id),
    );
    const excluded = cards.find(
      (card) => !card.labels.some((entry) => entry.label.id === label!.id),
    );
    const expected = counts.get(label!.id)!;

    await expect(page.locator('header').first()).toContainText(
      `· ${totalCards} cards`,
    );

    const panel = await openFilterPanel(page);

    // The filter panel never renders a native browser <select>.
    await expect(page.locator('select')).toHaveCount(0);

    const labelSelect = panel.getByRole('combobox', { name: 'Label' });
    await labelSelect.click();

    const listbox = panel.getByRole('listbox');
    await expect(listbox).toBeVisible();
    await expect(listbox.getByRole('option')).toHaveCount(
      board.labels.length + 1, // "All labels" + every board label
    );

    await listbox.getByRole('option', { name: label!.name }).click();

    await expect(labelSelect).toContainText(label!.name);
    await expect(listbox).toBeHidden();
    await expect(page.locator('header').first()).toContainText(
      `${expected} of ${totalCards} cards`,
    );

    if (included) {
      await expect(
        page.getByText(included.title, { exact: true }).first(),
      ).toBeVisible();
    }
    if (excluded) {
      await expect(
        page.getByText(excluded.title, { exact: true }),
      ).toHaveCount(0);
    }
  });

  test('select supports keyboard navigation and Escape', async ({ page }) => {
    const firstLabel = board.labels[0];
    test.skip(!firstLabel, 'board needs at least one label');

    const panel = await openFilterPanel(page);
    const labelSelect = panel.getByRole('combobox', { name: 'Label' });
    const listbox = panel.getByRole('listbox');

    await labelSelect.focus();
    await page.keyboard.press('ArrowDown');
    await expect(listbox).toBeVisible();

    // Opens on the selected option ("All labels"), so ArrowDown moves to the
    // first real label.
    await page.keyboard.press('ArrowDown');
    const activeOptionId =
      await labelSelect.getAttribute('aria-activedescendant');
    expect(activeOptionId).toBeTruthy();

    const firstLabelOption = listbox.getByRole('option', {
      name: firstLabel!.name,
    });
    await expect(firstLabelOption).toHaveAttribute('id', activeOptionId!);

    await page.keyboard.press('Enter');
    await expect(labelSelect).toContainText(firstLabel!.name);
    await expect(listbox).toBeHidden();
    await expect(labelSelect).toBeFocused();

    const expected = labelCounts(board).get(firstLabel!.id) ?? 0;
    await expect(page.locator('header').first()).toContainText(
      `${expected} of ${totalCards} cards`,
    );

    // Escape closes without changing the selection.
    const dueSelect = panel.getByRole('combobox', { name: 'Due date' });
    await dueSelect.click();
    await expect(panel.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel.getByRole('listbox')).toBeHidden();
    await expect(dueSelect).toContainText('All dates');
  });

  test('clicking outside closes the select', async ({ page }) => {
    const panel = await openFilterPanel(page);
    const dueSelect = panel.getByRole('combobox', { name: 'Due date' });

    await dueSelect.click();
    await expect(panel.getByRole('listbox')).toBeVisible();

    await page.getByRole('heading', { name: 'Filter cards' }).click();
    await expect(panel.getByRole('listbox')).toBeHidden();
  });

  test('clear filters resets every card', async ({ page }) => {
    const counts = labelCounts(board);
    const label = board.labels.find((entry) => (counts.get(entry.id) ?? 0) > 0);
    test.skip(!label, 'board needs at least one labelled card');

    const panel = await openFilterPanel(page);
    await panel.getByRole('combobox', { name: 'Label' }).click();
    await panel.getByRole('option', { name: label!.name }).click();

    await expect(page.locator('header').first()).toContainText(
      `${counts.get(label!.id)} of ${totalCards} cards`,
    );

    await panel.getByRole('button', { name: 'Clear filters' }).click();

    await expect(page.locator('header').first()).toContainText(
      `· ${totalCards} cards`,
    );
    await expect(panel.getByRole('combobox', { name: 'Label' })).toContainText(
      'All labels',
    );
  });

  test('search filter matches card titles', async ({ page }) => {
    const cards = allCards(board);
    const term = [...cards].sort((a, b) => b.title.length - a.title.length)[0]
      .title;
    const expected = matchingCardCount(board, term);

    const panel = await openFilterPanel(page);
    await panel.getByLabel('Search cards').fill(term);

    await expect(page.locator('header').first()).toContainText(
      `${expected} of ${totalCards} cards`,
    );
    await expect(
      page.getByText(term, { exact: true }).first(),
    ).toBeVisible();
  });
});
