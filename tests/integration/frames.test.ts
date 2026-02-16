/**
 * Integration Tests for Frame Support
 */

import * as path from 'path';
import { SmartBrowser } from '../../src/adapters/smart-browser';
import { PuppeteerDriver } from '../../src/drivers/puppeteer-driver';
import { ActionType } from '../../src/types';

describe('Frame Support', () => {
  let browser: SmartBrowser;
  let driver: PuppeteerDriver;
  const fixturePath = 'file://' + path.resolve(__dirname, '../fixtures/frames.html');

  beforeEach(async () => {
    jest.setTimeout(30000);
    // Disable web security to allow local file iframe access if needed
    driver = new PuppeteerDriver({
        headless: true,
        // args: ['--disable-web-security'] // Might be needed
    });
    browser = new SmartBrowser(driver);
    await browser.initialize();
  });

  afterEach(async () => {
    await browser.close();
  });

  test('should detect elements inside iframes', async () => {
    await browser.navigate(fixturePath);

    // Give time for iframe to load
    await new Promise(r => setTimeout(r, 1000));

    const tree = await browser.buildDOMTree();

    // Should find main button
    const mainBtn = tree.elements.find(el => el.attributes?.id === 'main-btn');
    expect(mainBtn).toBeDefined();
    expect(mainBtn?.frameIndex).toBe(0);

    // Should find frame button
    const frameBtn = tree.elements.find(el => el.attributes?.id === 'frame-btn');
    expect(frameBtn).toBeDefined();
    expect(frameBtn?.frameIndex).toBeGreaterThan(0);
    expect(frameBtn?.tagName).toBe('BUTTON');
  });

  test('should click element inside iframe', async () => {
    await browser.navigate(fixturePath);
    await new Promise(r => setTimeout(r, 1000));

    const tree = await browser.buildDOMTree();
    const frameBtn = tree.elements.find(el => el.attributes?.id === 'frame-btn');

    expect(frameBtn).toBeDefined();

    const result = await browser.executeAction({
        actionType: ActionType.Click,
        xpath: frameBtn!.xpath,
        elementIndex: frameBtn!.index
    });

    expect(result.success).toBe(true);

    // Verify click effect inside frame
    // We verify by checking all frames
    const results = await driver.executeInAllFrames<string | null>(`
        (function() {
            const btn = document.getElementById('frame-btn');
            return btn ? btn.getAttribute('data-clicked') : null;
        })()
    `);

    const isClicked = results.some(r => r.result === 'true');
    expect(isClicked).toBe(true);
  });
});
