/**
 * Integration Tests for SmartBrowser
 */

import * as path from 'path';
import { SmartBrowser } from '../../src/adapters/smart-browser';
import { PuppeteerDriver } from '../../src/drivers/puppeteer-driver';
import { ActionType } from '../../src/types';

describe('SmartBrowser Integration', () => {
  let browser: SmartBrowser;
  let driver: PuppeteerDriver;
  const fixturePath = 'file://' + path.resolve(__dirname, '../fixtures/simple-page.html');

  beforeEach(async () => {
    // Increase timeout for CI/CD environments
    jest.setTimeout(30000);
    driver = new PuppeteerDriver({ headless: true });
    browser = new SmartBrowser(driver);
    await browser.initialize();
  });

  afterEach(async () => {
    await browser.close();
  });

  test('should build DOM tree with interactive elements', async () => {
    await browser.navigate(fixturePath);
    const tree = await browser.buildDOMTree();

    expect(tree.elements.length).toBeGreaterThan(0);

    // Check for specific elements
    const button = tree.elements.find(el => el.tagName === 'BUTTON');
    expect(button).toBeDefined();
    expect(button?.isInteractive).toBe(true);
    expect(button?.xpath).toContain('button');

    const input = tree.elements.find(el => el.tagName === 'INPUT');
    expect(input).toBeDefined();

    // Check Div button (heuristics)
    const divBtn = tree.elements.find(el => el.text === 'Div Button');
    expect(divBtn).toBeDefined();
    expect(divBtn?.isInteractive).toBe(true); // Should be true due to cursor:pointer
  });

  test('should execute Click action via XPath', async () => {
    await browser.navigate(fixturePath);
    const tree = await browser.buildDOMTree();
    const button = tree.elements.find(el => el.tagName === 'BUTTON');

    expect(button).toBeDefined();

    const result = await browser.executeAction({
        actionType: ActionType.Click,
        xpath: button!.xpath,
        elementIndex: button!.index
    });

    expect(result.success).toBe(true);

    // Verify click effect
    const isClicked = await driver.evaluate(() => document.body.getAttribute('data-clicked'));
    expect(isClicked).toBe('true');
  });

  test('should execute Type action', async () => {
    await browser.navigate(fixturePath);
    const tree = await browser.buildDOMTree();
    const input = tree.elements.find(el => el.tagName === 'INPUT');

    expect(input).toBeDefined();

    const result = await browser.executeAction({
        actionType: ActionType.Type,
        xpath: input!.xpath,
        text: 'Hello World',
        elementIndex: input!.index
    });

    expect(result.success).toBe(true);

    // Verify value
    const value = await driver.evaluate(() => (document.getElementById('input-text') as HTMLInputElement).value);
    expect(value).toBe('Hello World');
  });

  test('should execute Select action', async () => {
    await browser.navigate(fixturePath);
    const tree = await browser.buildDOMTree();
    const select = tree.elements.find(el => el.tagName === 'SELECT');

    expect(select).toBeDefined();

    const result = await browser.executeAction({
        actionType: ActionType.Select,
        xpath: select!.xpath,
        params: { value: 'opt2' },
        elementIndex: select!.index
    });

    expect(result.success).toBe(true);

    // Verify value
    const value = await driver.evaluate(() => (document.getElementById('select-opt') as HTMLSelectElement).value);
    expect(value).toBe('opt2');
  });

  test('should fallback to coordinates if XPath fails (simulated)', async () => {
      // Navigate
      await browser.navigate(fixturePath);
      const tree = await browser.buildDOMTree();
      const divBtn = tree.elements.find(el => el.text === 'Div Button');

      expect(divBtn).toBeDefined();

      // Break the XPath on purpose in the action, but provide correct index
      // The logic should try XPath (fail), then look up element by index, get correct XPath/Coords.
      // Wait, if I provide WRONG XPath in action, but valid Index.
      // The logic says: use action.xpath first.
      // If fails -> catch -> try coordinates (from session element).

      const result = await browser.executeAction({
          actionType: ActionType.Click,
          xpath: '//div[@id="non-existent"]', // Wrong XPath
          elementIndex: divBtn!.index
      });

      // The first strategy (XPath) will fail.
      // The fallback strategy (Coordinates) should kick in because elementIndex is valid in session.

      expect(result.success).toBe(true);
      expect(result.message).toContain('Coordinates'); // Or whatever message I put in click.ts

      // Verify click
      const isClicked = await driver.evaluate(() => document.body.getAttribute('data-div-clicked'));
      expect(isClicked).toBe('true');
  });
});
