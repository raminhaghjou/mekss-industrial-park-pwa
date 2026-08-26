import { expect, test } from '@playwright/test';

const routes = [
  { path: '/login', heading: 'ورود به سیستم' },
  { path: '/register', heading: 'ثبت نام' },
];

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 360, height: 800 },
];

for (const route of routes) {
  for (const viewport of viewports) {
    test(`${route.path} renders its local auth artwork at ${viewport.name} width`, async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      const localRequestFailures = [];

      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('requestfailed', (request) => {
        if (new URL(request.url()).origin === 'http://127.0.0.1:5173') {
          localRequestFailures.push(`${request.url()}: ${request.failure()?.errorText}`);
        }
      });

      await page.setViewportSize(viewport);
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });

      await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
      const surface = page.locator('[data-auth-surface="true"]');
      await expect(surface.locator('.MuiPaper-root')).toBeVisible();

      const backgroundImage = await surface.evaluate(
        (element) => getComputedStyle(element, '::before').backgroundImage,
      );
      expect(backgroundImage).toContain('auth-industrial-park.svg');

      const assetResponse = await page.request.get('/auth-industrial-park.svg');
      expect(assetResponse.ok()).toBe(true);
      expect(assetResponse.headers()['content-type']).toContain('image/svg+xml');

      const layout = await page.evaluate(() => {
        const surface = document.querySelector('[data-auth-surface="true"]');
        const card = surface.querySelector('.MuiPaper-root');
        const cardBounds = card.getBoundingClientRect();

        return {
          bodyWidth: document.body.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
          surfaceHeight: surface.getBoundingClientRect().height,
          viewportHeight: window.innerHeight,
          cardCenter: cardBounds.left + cardBounds.width / 2,
        };
      });
      expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.surfaceHeight).toBeGreaterThanOrEqual(layout.viewportHeight);
      if (viewport.name === 'desktop') {
        expect(layout.cardCenter).toBeGreaterThan(layout.viewportWidth / 2);
      } else {
        expect(layout.cardCenter).toBeCloseTo(layout.viewportWidth / 2, 0);
      }
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
      expect(localRequestFailures).toEqual([]);
    });
  }
}
