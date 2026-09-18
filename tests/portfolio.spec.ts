import { test, expect } from '@playwright/test';

// The reference is the unchanged original index.html and original assets.
// npm run dev exposes it at /__reference/index.html.
for (const route of ['/__reference/index.html', '/']) {
  test(`${route}: original interaction contract`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(route);
    await expect(page.locator('.preloader')).toBeHidden({ timeout: 15000 });
    for (const id of ['about', 'expertise', 'projects', 'what-i-build', 'contact']) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    const opener = page.locator('.tw-offcanvas-open-btn:visible').first();
    if (await opener.count()) {
      await opener.click();
      await expect(page.locator('.tw-offcanvas-2-area')).toHaveClass(/opened/);
      await page.locator('.tw-offcanvas-2-close-btn:visible').first().click();
      await expect(page.locator('.tw-offcanvas-2-area')).not.toHaveClass(/opened/);
    }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator('.back-to-top-wrapper')).toHaveClass(/back-to-top-btn-show/);
    await page.locator('#back_to_top').click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(20);
    expect(errors).toEqual([]);
  });
}

test('React keeps reference content, resources, and DOM before animations', async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  // Block animation scripts on both pages, but allow Vite/React modules.
  await context.route('**/assets/js/**', route => route.abort());
  const reference = await context.newPage();
  const migrated = await context.newPage();
  await reference.goto(`${baseURL}/__reference/index.html`);
  await migrated.goto(`${baseURL}/`);
  await expect(migrated.locator('#projects')).toHaveCount(1);
  const signature = async (page: typeof reference) => page.evaluate(() => {
    const root = document.getElementById('root') || document.body;
    const walk = (node: Node): unknown => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;
      if (!(node instanceof Element)) return null;
      if (['SCRIPT', 'STYLE'].includes(node.tagName) || node.tagName.includes('-')) return null;
      return {
        tag: node.tagName,
        attributes: Array.from(node.attributes).map(a => [a.name, a.value]).sort(),
        children: Array.from(node.childNodes).map(walk).filter(x => x !== null),
      };
    };
    return Array.from(root.childNodes).map(walk).filter(x => x !== null && x !== '\n');
  });
  expect(await signature(migrated)).toEqual(await signature(reference));
  await context.close();
});
