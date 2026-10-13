import { expect, test } from '@playwright/test';
import { expectOpeningLinesUp } from '@huishouden/pwa-kit/e2e';

// While Tasks opens it shows the kit's opening frame (AppOpening): the same app bar and list column as
// the loaded app, so nothing jumps when the lists arrive (kit STANDARD.md "Updates"). Tasks has no tabs.

test('the opening frame lines up with the loaded app: phone and tablet, light and dark', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  await expectOpeningLinesUp(browser, {
    baseURL,
    tabs: 'none',
    loaded: (p) => expect(p.getByText('Sample data').first()).toBeVisible({ timeout: 15_000 }),
  });
});
