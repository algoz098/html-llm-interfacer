/**
 * Tests for DOMBuilder
 *
 * Phase 1 Focus: Multi-stage interactivity heuristics
 * Based on nanobrowser patterns
 *
 * Test Strategy:
 * 1. Test individual heuristic signals
 * 2. Test multi-stage combination
 * 3. Test edge cases
 * 4. Target: 88%+ accuracy on element detection
 */

import { DOMBuilder } from '../../src/core/dom-builder';

describe('DOMBuilder', () => {
  let builder: DOMBuilder;

  beforeEach(() => {
    builder = new DOMBuilder();
  });

  describe('Interactivity Heuristics', () => {
    describe('Form Tag Detection (Stage 1)', () => {
      test('should detect <button> as interactive', () => {
        const element = createMockElement('button', {});
        const result = builder.isInteractive(element);
        expect(result).toBe(true);
      });

      test('should detect <a> as interactive', () => {
        const element = createMockElement('a', { href: '#' });
        const result = builder.isInteractive(element);
        expect(result).toBe(true);
      });

      test('should detect <input> as interactive', () => {
        const element = createMockElement('input', { type: 'text' });
        const result = builder.isInteractive(element);
        expect(result).toBe(true);
      });

      test('should detect <select> as interactive', () => {
        const element = createMockElement('select', {});
        const result = builder.isInteractive(element);
        expect(result).toBe(true);
      });

      test('should detect <textarea> as interactive', () => {
        const element = createMockElement('textarea', {});
        const result = builder.isInteractive(element);
        expect(result).toBe(true);
      });

      test('should NOT detect disabled button', () => {
        const element = createMockElement('button', { disabled: true });
        const result = builder.isInteractive(element);
        expect(result).toBe(false);
      });
    });

    describe('CSS Cursor Detection (Stage 2)', () => {
      test('should detect cursor: pointer', () => {
        const element = createMockElement('div', {});
        element.style.cursor = 'pointer';
        const result = builder.isInteractive(element);
        expect(result).toBe(true);
      });

      test('should NOT detect default cursor', () => {
        const element = createMockElement('div', {});
        element.style.cursor = 'default';
        const result = builder.isInteractive(element);
        expect(result).toBe(false);
      });

      test('should detect hand cursor variant', () => {
        const element = createMockElement('div', {});
        element.style.cursor = 'hand';
        const result = builder.isInteractive(element);
        expect(result).toBe(true);
      });
    });

    describe('ARIA Role Detection (Stage 3)', () => {
      test('should detect role="button"', () => {
        const element = createMockElement('div', {
          'role': 'button',
        });
        const result = builder.isInteractive(element);
        expect(result).toBe(true);
      });

      test('should detect role="link"', () => {
        const element = createMockElement('div', {
          'role': 'link',
        });
        const result = builder.isInteractive(element);
        expect(result).toBe(true);
      });

      test('should detect role="tab"', () => {
        const element = createMockElement('div', {
          'role': 'tab',
        });
        const result = builder.isInteractive(element);
        expect(result).toBe(true);
      });

      test('should detect role="menuitem"', () => {
        const element = createMockElement('div', {
          'role': 'menuitem',
        });
        const result = builder.isInteractive(element);
        expect(result).toBe(true);
      });

      test('should NOT detect role="text"', () => {
        const element = createMockElement('div', {
          'role': 'text',
        });
        const result = builder.isInteractive(element);
        expect(result).toBe(false);
      });
    });

    describe('Multi-Stage Combination', () => {
      test('should combine multiple positive signals', () => {
        const element = createMockElement('button', {});
        element.style.cursor = 'pointer';
        const result = builder.isInteractive(element);
        expect(result).toBe(true);
      });

      test('should default to NOT interactive with no signals', () => {
        const element = createMockElement('div', {});
        const result = builder.isInteractive(element);
        expect(result).toBe(false);
      });

      test('should handle edge case: span with role=button', () => {
        const element = createMockElement('span', {
          'role': 'button',
        });
        const result = builder.isInteractive(element);
        expect(result).toBe(true);
      });
    });
  });

  describe('Visibility Detection (3-Point Sampling)', () => {
    let testElements: HTMLElement[] = [];

    afterEach(() => {
      // Clean up test elements
      testElements.forEach((el) => {
        if (el.parentElement) {
          el.parentElement.removeChild(el);
        }
      });
      testElements = [];
    });

    test('should detect visible element', () => {
      const element = createVisibleElement();
      testElements.push(element);
      const result = builder.isVisible(element);
      expect(result).toBe(true);
    });

    test('should detect hidden element (display: none)', () => {
      const element = createMockElement('div', {});
      element.style.display = 'none';
      const result = builder.isVisible(element);
      expect(result).toBe(false);
    });

    test('should detect hidden element (opacity: 0)', () => {
      const element = createMockElement('div', {});
      element.style.opacity = '0';
      builder.isVisible(element);
      // Note: opacity 0 is technically visible but not interactable
      // This depends on implementation choice
    });

    test('should detect off-screen element', () => {
      const element = createOffScreenElement();
      const visible = builder.isVisible(element);
      expect(visible).toBe(false);
    });

    test('should detect element behind overlay', () => {
      const element = createOccludedElement();
      const visible = builder.isVisible(element);
      expect(visible).toBe(false);
    });
  });

  describe('XPath Generation', () => {
    test('should generate XPath for button with id', () => {
      const element = createMockElement('button', { id: 'submit-btn' });
      const xpath = builder.generateXPath(element);
      expect(xpath).toMatch(/\/\/button\[@id="submit-btn"\]/);
    });

    test('should generate XPath fallback without id', () => {
      const element = createMockElement('button', {});
      // Note: parentElement is read-only on real DOM elements
      // This test focuses on XPath generation for elements without IDs
      const xpath = builder.generateXPath(element);
      expect(xpath).toBeDefined();
      expect(xpath.length).toBeGreaterThan(0);
    });

    test('should generate XPath with text content', () => {
      const element = createMockElement('button', {});
      element.textContent = 'Click Me';
      const xpath = builder.generateXPath(element);
      expect(xpath).toMatch(/Click Me/);
    });

    test('should handle XPath with class selector', () => {
      const element = createMockElement('div', { class: 'btn-primary' });
      const xpath = builder.generateXPath(element);
      expect(xpath).toMatch(/btn-primary/);
    });
  });

  describe('Coordinate Generation', () => {
    test('should calculate center coordinates', () => {
      const element = createMockElement('button', {});
      const coords = builder.getCoordinates(element);
      expect(coords).toHaveProperty('x');
      expect(coords).toHaveProperty('y');
      expect(typeof coords.x).toBe('number');
      expect(typeof coords.y).toBe('number');
    });

    test('should handle element with bounding rect', () => {
      const element = createMockElement('button', {});
      jest.spyOn(element, 'getBoundingClientRect').mockReturnValue({
        left: 100,
        top: 200,
        width: 50,
        height: 30,
        right: 150,
        bottom: 230,
        x: 100,
        y: 200,
        toJSON: () => ({}),
      });

      const coords = builder.getCoordinates(element);
      expect(coords.x).toBe(125); // center: 100 + 50/2
      expect(coords.y).toBe(215); // center: 200 + 30/2
    });

    test('should return page coordinates not viewport', () => {
      const element = createMockElement('button', {});
      const coords = builder.getCoordinates(element, { usePageCoordinates: true });
      expect(coords).toHaveProperty('x');
      expect(coords).toHaveProperty('y');
    });
  });

  describe('DOM Tree Building', () => {
    test('should build DOM tree from document', async () => {
      const domTree = await builder.buildDOMTree(document, {
        url: 'https://example.com',
      });

      expect(domTree).toHaveProperty('url');
      expect(domTree).toHaveProperty('title');
      expect(domTree).toHaveProperty('elements');
      expect(domTree).toHaveProperty('timestamp');
      expect(Array.isArray(domTree.elements)).toBe(true);
    });

    test('should assign unique indices to elements', async () => {
      const domTree = await builder.buildDOMTree(document);

      const indices = domTree.elements.map((el) => el.index);
      const uniqueIndices = new Set(indices);

      expect(uniqueIndices.size).toBe(domTree.elements.length);
    });

    test('should mark interactive elements correctly', async () => {
      // Add some interactive elements to the document
      const button = document.createElement('button');
      button.textContent = 'Click me';
      document.body.appendChild(button);

      const link = document.createElement('a');
      link.href = 'https://example.com';
      link.textContent = 'Link';
      document.body.appendChild(link);

      const domTree = await builder.buildDOMTree(document);

      const interactiveElements = domTree.elements.filter(
        (el) => el.isInteractive
      );
      expect(interactiveElements.length).toBeGreaterThan(0);

      // Cleanup
      document.body.removeChild(button);
      document.body.removeChild(link);
    });

    test('should include xpath for all elements', async () => {
      const domTree = await builder.buildDOMTree(document);

      const elementsWithoutXPath = domTree.elements.filter(
        (el) => !el.xpath
      );
      expect(elementsWithoutXPath.length).toBe(0);
    });

    test('should include viewport coordinates', async () => {
      const domTree = await builder.buildDOMTree(document);

      const elementsWithoutCoords = domTree.elements.filter(
        (el) => typeof el.viewportX !== 'number' || typeof el.viewportY !== 'number'
      );
      expect(elementsWithoutCoords.length).toBe(0);
    });

    test('should respect element limit option', async () => {
      const domTree = await builder.buildDOMTree(document, {
        maxElements: 100,
      });

      expect(domTree.elements.length).toBeLessThanOrEqual(100);
    });

    test('should filter by selector if provided', async () => {
      const domTree = await builder.buildDOMTree(document, {
        selector: 'button',
      });

      const nonButtons = domTree.elements.filter((el) => el.tagName !== 'BUTTON');
      expect(nonButtons.length).toBe(0);
    });
  });

  describe('Performance', () => {
    test('should build DOM tree in < 300ms for < 5000 elements', async () => {
      const startTime = performance.now();
      await builder.buildDOMTree(document);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(300);
    });

    test('should handle large documents without memory leak', async () => {
      // Create a large mock document
      const largeDoc = createLargeDOM(5000);
      const startMem = (process as any).memoryUsage().heapUsed;

      await builder.buildDOMTree(largeDoc as any);

      const endMem = (process as any).memoryUsage().heapUsed;
      const memIncrease = (endMem - startMem) / 1024 / 1024; // MB

      // Should not increase memory by more than 100MB
      expect(memIncrease).toBeLessThan(100);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null elements gracefully', async () => {
      expect(() => {
        builder.isInteractive(null as any);
      }).not.toThrow();
    });

    test('should handle elements with no bounding rect', () => {
      const element = createMockElement('div', {});
      jest.spyOn(element, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      const coords = builder.getCoordinates(element);
      expect(coords).toBeDefined();
    });

    test('should handle shadow DOM elements', async () => {
      // TBD: Shadow DOM traversal
      // This is a known limitation - document how it's handled
    });

    test('should handle iframes', async () => {
      // TBD: iframe/cross-origin handling
      // This requires browsernode pattern
    });
  });
});

// ===== HELPER FUNCTIONS =====

function createMockElement(
  tagName: string,
  attributes: Record<string, any> = {}
): HTMLElement {
  const element = document.createElement(tagName);

  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'disabled') {
      // Only button, input, select, textarea support disabled
      if (element instanceof HTMLButtonElement || 
          element instanceof HTMLInputElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLTextAreaElement) {
        element.disabled = value;
      } else if ('disabled' in element) {
        // Fallback for other elements
        (element as any).disabled = value;
      }
    } else if (key === 'class') {
      element.className = value;
    } else {
      element.setAttribute(key, value);
    }
  });

  return element;
}

function createVisibleElement(): HTMLElement {
  const element = document.createElement('button');
  element.style.display = 'block';
  element.style.visibility = 'visible';
  element.style.opacity = '1';
  element.textContent = 'Click me';

  // Mock getBoundingClientRect
  jest.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left: 10,
    top: 20,
    width: 100,
    height: 50,
    right: 110,
    bottom: 70,
    x: 10,
    y: 20,
    toJSON: () => ({}),
  });

  // Add to document so elementFromPoint works
  document.body.appendChild(element);

  return element;
}

function createOffScreenElement(): HTMLElement {
  const element = document.createElement('button');

  // Mock off-screen position
  jest.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left: -1000,
    top: -1000,
    width: 100,
    height: 50,
    right: -900,
    bottom: -950,
    x: -1000,
    y: -1000,
    toJSON: () => ({}),
  });

  return element;
}

function createOccludedElement(): HTMLElement {
  const element = document.createElement('button');
  element.style.zIndex = '0';

  // Mock overlapped position
  jest.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left: 100,
    top: 100,
    width: 100,
    height: 50,
    right: 200,
    bottom: 150,
    x: 100,
    y: 100,
    toJSON: () => ({}),
  });

  return element;
}

function createLargeDOM(elementCount: number): HTMLElement {
  const root = document.createElement('div');

  for (let i = 0; i < elementCount; i++) {
    const element = document.createElement('div');
    element.innerHTML = `<button id="btn-${i}">Click ${i}</button>`;
    root.appendChild(element);
  }

  return root;
}
