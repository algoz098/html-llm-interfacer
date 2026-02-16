/**
 * @jest-environment jsdom
 */

/**
 * Tests for Action Executors
 *
 * Phase 1 Focus: Multi-fallback strategy
 * Based on browserable patterns
 *
 * Fallback chain:
 * 1. CSS/XPath selector → Fast, 85% success
 * 2. XPath variant → Medium, 92% success
 * 3. Vision (GPT-4V) → Slow but reliable, 96% success
 * 4. Coordinates → Last resort, 80% success
 */

import { ClickAction } from '../../src/actions/click';
import { TypeAction } from '../../src/actions/type';
import { SelectAction } from '../../src/actions/select';
import { ActionType, SessionState, DOMElement } from '../../src/types';
import { MockBrowserDriver } from '../mocks/mock-browser-driver';

function createMockSession(elements: DOMElement[] = []): SessionState {
  return {
    sessionId: 'test-session',
    domTree: {
      url: 'http://localhost',
      title: 'Test Page',
      elements: elements,
      timestamp: Date.now(),
    },
    history: [],
  };
}

function createMockElement(index: number, overrides: Partial<DOMElement> = {}): DOMElement {
  return {
    index,
    tagName: 'BUTTON',
    text: 'Click Me',
    xpath: `//button[@id="btn-${index}"]`,
    attributes: {},
    isInteractive: true,
    isVisible: true,
    viewportX: 100,
    viewportY: 100,
    pageX: 100,
    pageY: 100,
    ...overrides,
  };
}

describe('ClickAction', () => {
  let actionExecutor: ClickAction;
  let driver: MockBrowserDriver;
  let session: SessionState;

  beforeEach(async () => {
    driver = new MockBrowserDriver();
    await driver.initialize();
    actionExecutor = new ClickAction();
    session = createMockSession();
  });

  afterEach(async () => {
    await driver.close();
    document.body.innerHTML = '';
  });

  describe('Selector Fallback (Level 1)', () => {
    test('should click element by CSS selector', async () => {
      const element = document.createElement('button');
      element.textContent = 'Click me';
      document.body.appendChild(element);

      const result = await actionExecutor.execute(driver, {
        actionType: ActionType.Click,
        elementIndex: 0,
        params: { selector: 'button' },
      }, session);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Selector');
    });

    test('should report failure if selector not found', async () => {
      const result = await actionExecutor.execute(driver, {
        actionType: ActionType.Click,
        elementIndex: 0,
        params: { selector: '#nonexistent-button' },
      }, session);

      expect(result.success).toBe(false);
      // Wait, ClickAction might fallback to XPath/Coords if elementIndex provided
      // But session has no elements.
      // So it should fail.
    });

    test('should handle disabled selector gracefully', async () => {
      const button = document.createElement('button');
      button.disabled = true;
      button.textContent = 'Disabled';
      document.body.appendChild(button);

      const result = await actionExecutor.execute(driver, {
        actionType: ActionType.Click,
        elementIndex: 0,
        params: { selector: 'button' },
      }, session);

      // Should either fail or warn about disabled element
      expect(result.success).toBe(false);
      expect(result.message).toContain('failed');
    });
  });

  describe('XPath Fallback (Level 2)', () => {
    test('should click element by XPath', async () => {
      const button = document.createElement('button');
      button.id = 'unique-btn';
      document.body.appendChild(button);

      const xpath = "//button[@id='unique-btn']";

      const result = await actionExecutor.execute(driver, {
        actionType: ActionType.Click,
        xpath: xpath,
      }, session);

      expect(result.success).toBe(true);
      expect(result.message).toContain('XPath');
    });
  });

  describe('Coordinate Fallback (Level 3)', () => {
    test('should click element by coordinates', async () => {
      const button = document.createElement('button');
      button.textContent = 'Coord Btn';
      document.body.appendChild(button);

      // We need to make sure elementFromPoint finds this button
      // JSDOM elementFromPoint is basic. MockBrowserDriver uses it.
      // But JSDOM doesn't do layout, so elementFromPoint usually returns null unless mocked?
      // Actually MockBrowserDriver uses document.elementFromPoint.
      // We might need to mock document.elementFromPoint in the test?
      // Or just assume MockBrowserDriver works if JSDOM supports it.
      // JSDOM doesn't support layout, so elementFromPoint always returns null usually.

      // Let's mock document.elementFromPoint
      const originalElementFromPoint = document.elementFromPoint;
      document.elementFromPoint = (x, y) => {
          if (x === 125 && y === 215) return button;
          return null;
      };

      const element = createMockElement(0, { viewportX: 125, viewportY: 215 });
      session = createMockSession([element]);

      // Provide invalid xpath to force coordinate fallback
      // ClickAction logic: if xpath provided/found, try it. If fail, try coords.
      // So we make xpath fail.
      element.xpath = "//button[@id='non-existent']";

      const result = await actionExecutor.execute(driver, {
        actionType: ActionType.Click,
        elementIndex: 0,
      }, session);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Coordinates');

      document.elementFromPoint = originalElementFromPoint;
    });
  });

  describe('Event Handling', () => {
    test('should trigger click events', async () => {
      const button = document.createElement('button');
      document.body.appendChild(button);

      let clickFired = false;
      button.addEventListener('click', () => {
        clickFired = true;
      });

      await actionExecutor.execute(driver, {
        actionType: ActionType.Click,
        params: { selector: 'button' }
      }, session);

      expect(clickFired).toBe(true);
    });
  });
});

describe('TypeAction', () => {
  let actionExecutor: TypeAction;
  let driver: MockBrowserDriver;
  let session: SessionState;

  beforeEach(async () => {
    driver = new MockBrowserDriver();
    await driver.initialize();
    actionExecutor = new TypeAction();
    session = createMockSession();
  });

  afterEach(async () => {
    await driver.close();
    document.body.innerHTML = '';
  });

  test('should type text into input field', async () => {
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);

    const result = await actionExecutor.execute(driver, {
      actionType: ActionType.Type,
      params: { selector: 'input', text: 'Hello World' },
      text: 'Hello World', // Some logic might use top-level text
    }, session);

    expect(result.success).toBe(true);
    expect(input.value).toBe('Hello World');
  });

  test('should trigger input/change events', async () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      let inputFired = false;
      input.addEventListener('input', () => inputFired = true);

      await actionExecutor.execute(driver, {
          actionType: ActionType.Type,
          params: { selector: 'input', text: 'test' }
      }, session);

      expect(inputFired).toBe(true);
  });
});

describe('SelectAction', () => {
  let actionExecutor: SelectAction;
  let driver: MockBrowserDriver;
  let session: SessionState;

  beforeEach(async () => {
    driver = new MockBrowserDriver();
    await driver.initialize();
    actionExecutor = new SelectAction();
    session = createMockSession();
  });

  afterEach(async () => {
    await driver.close();
    document.body.innerHTML = '';
  });

  test('should select option by value', async () => {
    const select = document.createElement('select');
    const option1 = document.createElement('option');
    option1.value = 'opt1';
    select.appendChild(option1);
    const option2 = document.createElement('option');
    option2.value = 'opt2';
    select.appendChild(option2);
    document.body.appendChild(select);

    const result = await actionExecutor.execute(driver, {
      actionType: ActionType.Select,
      params: { selector: 'select', value: 'opt2' },
    }, session);

    expect(result.success).toBe(true);
    expect(select.value).toBe('opt2');
  });

  // Test for select by label is skipped as it requires implementation
  test.skip('should select option by label', async () => {
     // ...
  });
});
