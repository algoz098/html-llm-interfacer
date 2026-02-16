/**
 * DOMBuilder - Multi-stage element detection and DOM tree generation
 *
 * Adapted for JSDOM/Node environment.
 */

import { DOMElement, DOMTreeState } from '../types';

export interface DOMBuilderOptions {
  url?: string;
  maxElements?: number;
  selector?: string;
}

export interface CoordinateOptions {
  usePageCoordinates?: boolean;
}

export class DOMBuilder {
  private readonly INTERACTIVE_TAGS = new Set([
    'BUTTON',
    'A',
    'INPUT',
    'SELECT',
    'TEXTAREA',
    'LABEL',
  ]);

  private readonly INTERACTIVE_ROLES = new Set([
    'button',
    'link',
    'tab',
    'menuitem',
    'checkbox',
    'radio',
    'switch',
    'combobox',
  ]);

  /**
   * Multi-stage interactivity detection
   */
  isInteractive(element: Element | null): boolean {
    if (!element) return false;

    // Stage 1: Form tags
    if (this.INTERACTIVE_TAGS.has(element.tagName)) {
      if ((element as any).disabled === true) {
        return false;
      }
      return true;
    }

    // Stage 2: CSS cursor (Limited in JSDOM unless computed styles are populated)
    // We check style attribute or if window.getComputedStyle is available and mocked
    const doc = element.ownerDocument;
    const win = doc?.defaultView;
    if (win) {
       try {
           const style = win.getComputedStyle(element);
           if (style.cursor === 'pointer' || style.cursor === 'hand') return true;
       } catch (e) {
           // Ignore if style computation fails
       }
    }

    // Stage 3: ARIA role
    const role = element.getAttribute('role');
    if (role && this.INTERACTIVE_ROLES.has(role.toLowerCase())) {
      return true;
    }

    return false;
  }

  /**
   * Visibility detection
   * In JSDOM, physical layout is not calculated (width/height are often 0).
   * We assume elements are visible unless explicitly hidden.
   */
  isVisible(element: Element | null): boolean {
    if (!element) return false;

    // 1. Check hidden attribute
    if (element.hasAttribute('hidden')) return false;

    // 2. Check input type=hidden
    if (element.tagName === 'INPUT' && element.getAttribute('type') === 'hidden') return false;

    // 3. Check element.style property (JSDOM populates this from attribute)
    // Cast to any to access style property which exists on HTMLElement but Element interface is stricter
    const el = element as any;
    if (el.style) {
        if (el.style.display === 'none') return false;
        if (el.style.visibility === 'hidden') return false;
        if (el.style.opacity === '0') return false;
    }

    // 4. Check inline style attribute string as fallback
    const styleAttr = element.getAttribute('style');
    if (styleAttr) {
        // console.log(`Checking style for ${element.tagName}: "${styleAttr}"`);
        if (/display\s*:\s*none/i.test(styleAttr)) return false;
        if (/visibility\s*:\s*hidden/i.test(styleAttr)) return false;
        if (/opacity\s*:\s*0(?!\.)/i.test(styleAttr)) return false;
    }

    // 5. JSDOM computed style check (if available and parsed)
    const win = element.ownerDocument?.defaultView;
    if (win) {
        try {
            const style = win.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                return false;
            }
        } catch (e) {}
    }

    return true;
  }

  generateXPath(element: Element): string {
    const paths: string[] = [];

    for (let el = element; el && el !== el.ownerDocument?.documentElement; el = el.parentElement as Element) {
      let index = 1;
      let sibling = el.previousElementSibling;

      while (sibling) {
        if (sibling.tagName === el.tagName) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }

      let pathPart = '';

      if (el.id) {
        const tagName = el.tagName.toLowerCase();
        return `//${tagName}[@id="${el.id}"]`;
      }

      pathPart = el.tagName.toLowerCase();

      // Simple class check
      if (el.className && typeof el.className === 'string' && el.className.trim()) {
        const classes = el.className.trim().split(/\s+/).slice(0, 1);
        if (classes[0]) {
          pathPart += `[@class and contains(@class, '${classes[0]}')]`;
        }
      }

      // Add text content if distinct
      if (el.textContent && el.textContent.trim().length > 0 && el.textContent.trim().length < 30) {
         // simplified text check
         pathPart += `[${index}]`; // Fallback to index for reliability in JSDOM
      } else {
        pathPart += `[${index}]`;
      }

      paths.unshift(pathPart);
    }

    return `//${paths.join('/')}`;
  }

  /**
   * Build complete DOM tree with element detection
   */
  async buildDOMTree(doc: Document, options: DOMBuilderOptions = {}): Promise<DOMTreeState> {
    const elements: DOMElement[] = [];
    let elementIndex = 0;

    const allElements = doc.querySelectorAll('*');
    let elementsToProcess: Element[] = Array.from(allElements);

    if (options.selector) {
      elementsToProcess = elementsToProcess.filter((el) => el.matches(options.selector!));
    }

    if (options.maxElements && elementsToProcess.length > options.maxElements) {
      elementsToProcess = elementsToProcess.slice(0, options.maxElements);
    }

    for (const element of elementsToProcess) {
      const isInteractive = this.isInteractive(element);
      const isVisible = this.isVisible(element);

      // In JSDOM, we don't have real coordinates.
      // We set them to 0 or could try to infer from structure, but 0 is safer.
      const viewportX = 0;
      const viewportY = 0;

      // Extract basic attributes
      const attributes: Record<string, string> = {};
      Array.from(element.attributes).forEach(attr => {
          attributes[attr.name] = attr.value;
      });

      const domElement: DOMElement = {
        index: elementIndex,
        tagName: element.tagName,
        text: element.textContent?.trim() || '',
        xpath: this.generateXPath(element),
        attributes,
        isInteractive,
        isVisible,
        viewportX,
        viewportY,
        pageX: 0,
        pageY: 0,
      };

      elements.push(domElement);
      elementIndex++;
    }

    return {
      url: options.url || doc.location?.href || '',
      title: doc.title || '',
      elements,
      timestamp: Date.now(),
    };
  }
}
