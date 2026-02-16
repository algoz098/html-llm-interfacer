
import { BrowserDriver } from '../../src/interfaces/browser-driver';

export class MockBrowserDriver implements BrowserDriver {
  public initialized = false;
  public url = '';

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async close(): Promise<void> {
    this.initialized = false;
  }

  async navigate(url: string): Promise<void> {
    this.url = url;
  }

  async getUrl(): Promise<string> {
    return this.url;
  }

  async evaluate<T>(pageFunction: string | ((...args: any[]) => T | Promise<T>), ...args: any[]): Promise<T> {
    if (typeof pageFunction === 'function') {
      return pageFunction(...args);
    }
    // eslint-disable-next-line no-new-func
    const func = new Function(`return (${pageFunction})`);
    return func()(...args);
  }

  async executeInAllFrames<T>(script: string): Promise<{ frameIndex: number; result: T }[]> {
    // JSDOM mock only has one frame (main window)
    const result = await this.evaluate<T>(script);
    return [{ frameIndex: 0, result }];
  }

  async waitForStability(_xpath: string, _timeout?: number, _frameIndex?: number): Promise<void> {
    // Mock always stable
    return Promise.resolve();
  }

  async click(selector: string): Promise<void> {
    const element = document.querySelector(selector) as HTMLElement;
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    this.simulateClick(element);
  }

  async clickXPath(xpath: string, frameIndex?: number): Promise<void> {
    if (frameIndex && frameIndex > 0) {
        throw new Error("MockBrowserDriver does not support multiple frames");
    }
    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    const element = result.singleNodeValue as HTMLElement;
    if (!element) {
      throw new Error(`Element not found by XPath: ${xpath}`);
    }
    this.simulateClick(element);
  }

  async clickCoordinates(x: number, y: number): Promise<void> {
    const element = document.elementFromPoint(x, y) as HTMLElement;
    if (!element) {
      throw new Error(`Element not found at coordinates: ${x}, ${y}`);
    }
    this.simulateClick(element);
  }

  private simulateClick(element: HTMLElement): void {
    if ((element as any).disabled) {
      throw new Error('Node is either not clickable or not an HTMLElement');
    }

    const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    element.dispatchEvent(mousedown);

    const mouseup = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
    element.dispatchEvent(mouseup);

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    element.dispatchEvent(click);
  }

  async type(selector: string, text: string): Promise<void> {
    const element = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    this.simulateType(element, text);
  }

  async typeXPath(xpath: string, text: string, frameIndex?: number): Promise<void> {
    if (frameIndex && frameIndex > 0) {
        throw new Error("MockBrowserDriver does not support multiple frames");
    }
    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    const element = result.singleNodeValue as HTMLInputElement | HTMLTextAreaElement;
    if (!element) {
      throw new Error(`Element not found by XPath: ${xpath}`);
    }
    this.simulateType(element, text);
  }

  private simulateType(element: HTMLInputElement | HTMLTextAreaElement, text: string): void {
    element.value = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async select(selector: string, value: string): Promise<void> {
    const element = document.querySelector(selector) as HTMLSelectElement;
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    this.simulateSelect(element, value);
  }

  async selectXPath(xpath: string, value: string, frameIndex?: number): Promise<void> {
    if (frameIndex && frameIndex > 0) {
        throw new Error("MockBrowserDriver does not support multiple frames");
    }
    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    const element = result.singleNodeValue as HTMLSelectElement;
    if (!element) {
      throw new Error(`Element not found by XPath: ${xpath}`);
    }
    this.simulateSelect(element, value);
  }

  private simulateSelect(element: HTMLSelectElement, value: string): void {
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async screenshot(): Promise<Buffer> {
    return Buffer.from('');
  }

  async getFrameOffsets(): Promise<{ frameIndex: number, x: number, y: number }[]> {
    return [{ frameIndex: 0, x: 0, y: 0 }];
  }
}
