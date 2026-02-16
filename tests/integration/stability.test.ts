/**
 * Integration Tests for Stability Waiting
 */

import * as path from 'path';
import { SmartBrowser } from '../../src/adapters/smart-browser';
import { PuppeteerDriver } from '../../src/drivers/puppeteer-driver';
import { ActionType } from '../../src/types';

describe('Stability Waiting', () => {
  let browser: SmartBrowser;
  let driver: PuppeteerDriver;
  const fixturePath = 'file://' + path.resolve(__dirname, '../fixtures/moving-element.html');

  beforeEach(async () => {
    jest.setTimeout(30000);
    driver = new PuppeteerDriver({ headless: true }); // Use headless: 'new' or just true
    browser = new SmartBrowser(driver);
    await browser.initialize();
  });

  afterEach(async () => {
    await browser.close();
  });

  test('should wait for element to be stable before clicking', async () => {
    await browser.navigate(fixturePath);

    // Initial DOM build
    const tree = await browser.buildDOMTree();
    const button = tree.elements.find(el => el.tagName === 'BUTTON');

    expect(button).toBeDefined();

    const startTime = Date.now();

    // Execute click action
    // The element moves for 2000ms.
    // waitForStability should wait until it stops.
    // We set a slightly longer timeout on the driver call inside waitForStability if possible,
    // but the default is 2000ms. If it stops exactly at 2000ms, it might timeout or succeed.
    // To be safe, let's update the fixture to move for less time, say 1000ms, and timeout 2000ms.

    // BUT we can't easily change fixture from here.
    // We can inject script to stop moving sooner?
    // Or we can just update the fixture file now.

    const result = await browser.executeAction({
        actionType: ActionType.Click,
        xpath: button!.xpath,
        elementIndex: button!.index
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Check success
    expect(result.success).toBe(true);

    // Should have waited at least 1000ms (since it moves)
    // The fixture moves for 2000ms.
    // If it timeouts at 2000ms, waitForStability returns.
    // Then click happens.
    // If element is still moving, click might fail or hit moving target.
    // But since it stops at 2000ms, it should be stable then.

    expect(duration).toBeGreaterThan(1000);

    // Verify click effect
    // We need to access the page content to check data-clicked attribute
    // SmartBrowser doesn't expose page directly, but driver does.
    // We can cast driver to any or use evaluate if exposed (it is).
    const isClicked = await driver.evaluate(() => {
        const btn = document.getElementById('moving-btn');
        return btn ? btn.getAttribute('data-clicked') : null;
    });

    expect(isClicked).toBe('true');
  });
});
