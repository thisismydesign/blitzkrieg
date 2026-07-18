import { expect, test } from '@playwright/test';

test('openings mode renders the board', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Blitzkrieg/ })).toBeVisible();
  await expect(page.locator('.board').first()).toBeVisible();
});

test('“My games” shows sign-in when logged out', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'My games' }).click();
  await expect(page.getByRole('heading', { name: /Sign in/ })).toBeVisible();
});

test('the Stockfish WASM worker analyses a position in the browser', async ({ page }) => {
  await page.goto('/');

  const bestmove = await page.evaluate<string>(() => {
    return new Promise<string>((resolve, reject) => {
      const worker = new Worker('/engine/stockfish-18-lite-single.js');
      const timer = setTimeout(() => reject(new Error('engine timeout')), 40_000);
      worker.onmessage = (e: MessageEvent) => {
        const line = typeof e.data === 'string' ? e.data : String(e.data);
        if (line.startsWith('bestmove')) {
          clearTimeout(timer);
          worker.terminate();
          resolve(line.split(/\s+/)[1]);
        }
      };
      worker.onerror = (err) => {
        clearTimeout(timer);
        reject(new Error(String(err.message)));
      };
      worker.postMessage('uci');
      worker.postMessage('isready');
      worker.postMessage('position startpos');
      worker.postMessage('go depth 12');
    });
  });

  // A legal opening move in UCI (e.g. e2e4, g1f3, d2d4).
  expect(bestmove).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
});
