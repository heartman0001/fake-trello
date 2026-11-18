import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000/api';

export const DEMO_USER = {
  email: 'demo@fake-trello.com',
  password: 'password123',
  name: 'Demo User',
};

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; email: string };
}

interface ApiCard {
  id: string;
  title: string;
  description: string | null;
  labels: { label: { id: string; name: string } }[];
}

export interface ApiBoard {
  id: string;
  title: string;
  labels: { id: string; name: string }[];
  columns: { id: string; title: string; cards: ApiCard[] }[];
}

/** Signs in through the real login form and waits for /workspaces. */
export async function login(
  page: Page,
  credentials: { email: string; password: string } = DEMO_USER,
) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/workspaces$/);
}

export async function apiLogin(
  request: APIRequestContext,
  credentials: { email: string; password: string } = DEMO_USER,
): Promise<AuthTokens> {
  const response = await request.post(`${API_URL}/auth/login`, {
    data: credentials,
  });
  expect(
    response.ok(),
    `POST ${API_URL}/auth/login failed: ${response.status()} ${await response.text()}`,
  ).toBeTruthy();
  return response.json();
}

/** Drops the auth cookies into the browser context so tests can skip the form. */
export async function signInViaApi(
  page: Page,
  request: APIRequestContext,
): Promise<AuthTokens> {
  const auth = await apiLogin(request);
  await page.context().addCookies([
    { name: 'accessToken', value: auth.accessToken, url: BASE_URL },
    { name: 'refreshToken', value: auth.refreshToken, url: BASE_URL },
  ]);
  return auth;
}

/**
 * Reads the first board straight from the API so expectations follow the
 * current data instead of hardcoded seed values.
 */
export async function fetchBoard(
  request: APIRequestContext,
  token: string,
): Promise<ApiBoard> {
  const headers = { Authorization: `Bearer ${token}` };
  const boardsResponse = await request.get(`${API_URL}/boards`, { headers });
  expect(boardsResponse.ok()).toBeTruthy();
  const boards: { id: string }[] = await boardsResponse.json();
  expect(boards.length, 'demo user needs at least one board').toBeGreaterThan(0);

  const boardResponse = await request.get(
    `${API_URL}/boards/${boards[0].id}`,
    { headers },
  );
  expect(boardResponse.ok()).toBeTruthy();
  return boardResponse.json();
}

export function allCards(board: ApiBoard): ApiCard[] {
  return board.columns.flatMap((column) => column.cards);
}

/** Cards per label, for labels that are actually used on the board. */
export function labelCounts(board: ApiBoard) {
  const counts = new Map<string, number>();
  for (const card of allCards(board)) {
    for (const entry of card.labels ?? []) {
      counts.set(entry.label.id, (counts.get(entry.label.id) ?? 0) + 1);
    }
  }
  return counts;
}

/** Mirrors the client-side search filter (title + description). */
export function matchingCardCount(board: ApiBoard, term: string) {
  const query = term.trim().toLowerCase();
  return allCards(board).filter((card) =>
    `${card.title} ${card.description ?? ''}`.toLowerCase().includes(query),
  ).length;
}

/** Opens a board directly by id (the header shows the board title). */
export async function openBoard(page: Page, board: ApiBoard) {
  await page.goto(`/board/${board.id}`);
  await expect(
    page.getByRole('heading', { level: 1, name: board.title }),
  ).toBeVisible();
}

/** Opens the board filter panel and returns its locator. */
export async function openFilterPanel(page: Page) {
  await page.getByRole('button', { name: /board filters/i }).click();
  const panel = page.getByRole('group', { name: 'Filter cards' });
  await expect(panel).toBeVisible();
  return panel;
}
