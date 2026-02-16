import puppeteer, { Browser, Page, ElementHandle, Frame } from 'puppeteer';
import { BrowserDriver } from '../interfaces/browser-driver';
import { SmartBrowserConfig } from '../types';

export class PuppeteerDriver implements BrowserDriver {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: SmartBrowserConfig;

  constructor(config: SmartBrowserConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      viewportWidth: config.viewportWidth ?? 1280,
      viewportHeight: config.viewportHeight ?? 720,
      timeout: config.timeout ?? 30000,
      args: config.args,
    };
  }

  async initialize(): Promise<void> {
    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      ...(this.config.args || [])
    ];

    this.browser = await puppeteer.launch({
      headless: this.config.headless ? 'new' : false, // 'new' is recommended for newer puppeteer
      args: launchArgs,
    });

    this.page = await this.browser.newPage();

    await this.page.setViewport({
      width: this.config.viewportWidth!,
      height: this.config.viewportHeight!,
    });

    if (this.config.timeout) {
      this.page.setDefaultTimeout(this.config.timeout);
      this.page.setDefaultNavigationTimeout(this.config.timeout);
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  async navigate(url: string): Promise<void> {
    if (!this.page) throw new Error('Driver not initialized');
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  async getUrl(): Promise<string> {
    if (!this.page) throw new Error('Driver not initialized');
    return this.page.url();
  }

  async evaluate<T>(pageFunction: string | ((...args: any[]) => T | Promise<T>), ...args: any[]): Promise<T> {
    if (!this.page) throw new Error('Driver not initialized');
    return this.page.evaluate(pageFunction, ...args) as Promise<T>;
  }

  async executeInAllFrames<T>(script: string): Promise<{ frameIndex: number; result: T }[]> {
    if (!this.page) throw new Error('Driver not initialized');
    const frames = this.page.frames();
    const results: { frameIndex: number; result: T }[] = [];

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      try {
        // frame.evaluate accepts string or function.
        // We cast as T because we trust the script returns T.
        const result = (await frame.evaluate(script)) as T;
        results.push({ frameIndex: i, result });
      } catch (e) {
        // Silently fail for frames that blocked execution (e.g. cross-origin restriction in some contexts? or detached frames)
        // console.warn(`Failed to execute in frame ${i}: ${e}`);
      }
    }
    return results;
  }

  async click(selector: string): Promise<void> {
    if (!this.page) throw new Error('Driver not initialized');
    await this.page.click(selector);
  }

  async clickXPath(xpath: string, frameIndex?: number): Promise<void> {
    if (!this.page) throw new Error('Driver not initialized');
    const context = this.getContext(frameIndex);
    const elements = await context.$x(xpath);
    if (elements.length > 0) {
      await (elements[0] as ElementHandle<Element>).click();
    } else {
      throw new Error(`Element not found for XPath: ${xpath} in frame ${frameIndex ?? 'main'}`);
    }
  }

  async clickCoordinates(x: number, y: number): Promise<void> {
    if (!this.page) throw new Error('Driver not initialized');
    // Coordinates are always relative to the viewport (page), unless we implement frame-relative coords.
    // DOMBuilder returns viewport coords, so we use page.mouse.
    await this.page.mouse.click(x, y);
  }

  async type(selector: string, text: string): Promise<void> {
    if (!this.page) throw new Error('Driver not initialized');
    await this.page.type(selector, text);
  }

  async typeXPath(xpath: string, text: string, frameIndex?: number): Promise<void> {
    if (!this.page) throw new Error('Driver not initialized');
    const context = this.getContext(frameIndex);
    const elements = await context.$x(xpath);
    if (elements.length > 0) {
      await (elements[0] as ElementHandle<Element>).type(text);
    } else {
      throw new Error(`Element not found for XPath: ${xpath} in frame ${frameIndex ?? 'main'}`);
    }
  }

  async select(selector: string, value: string): Promise<void> {
    if (!this.page) throw new Error('Driver not initialized');
    await this.page.select(selector, value);
  }

  async selectXPath(xpath: string, value: string, frameIndex?: number): Promise<void> {
    if (!this.page) throw new Error('Driver not initialized');
    const context = this.getContext(frameIndex);
    const elements = await context.$x(xpath);
    if (elements.length > 0) {
      const element = elements[0] as ElementHandle<Element>;
      await element.select(value);
    } else {
      throw new Error(`Element not found for XPath: ${xpath} in frame ${frameIndex ?? 'main'}`);
    }
  }

  async screenshot(): Promise<Buffer> {
    if (!this.page) throw new Error('Driver not initialized');
    return this.page.screenshot() as Promise<Buffer>;
  }

  private getContext(frameIndex?: number): Page | Frame {
    if (!this.page) throw new Error('Driver not initialized');
    if (frameIndex === undefined || frameIndex === null) {
      return this.page;
    }
    const frames = this.page.frames();
    if (frameIndex >= 0 && frameIndex < frames.length) {
      return frames[frameIndex];
    }
    throw new Error(`Frame index ${frameIndex} out of bounds (total frames: ${frames.length})`);
  }

  async waitForStability(xpath: string, timeout: number = 2000, frameIndex?: number): Promise<void> {
    if (!this.page) throw new Error('Driver not initialized');

    const context = this.getContext(frameIndex);
    const startTime = Date.now();
    let lastRect: { x: number; y: number; width: number; height: number } | null = null;
    let stableCount = 0;
    const requiredStableCount = 3;
    const checkInterval = 100;

    // Try to find the element first
    try {
      if (context === this.page) {
         await this.page.waitForXPath(xpath, { timeout: Math.min(timeout, 1000) });
      } else {
         // Frame doesn't have waitForXPath in typed definition easily, use $x polling
         // Actually Frame DOES have waitForXPath in newer puppeteer, but let's be safe
         const handle = await (context as Frame).waitForXPath(xpath, { timeout: Math.min(timeout, 1000) });
         if(!handle) throw new Error("Element not found");
      }
    } catch (e) {
      // If verify fails, we just return and let the action fail normally
      return;
    }

    while (Date.now() - startTime < timeout) {
      const elements = await context.$x(xpath);
      if (elements.length === 0) {
        await new Promise((r) => setTimeout(r, checkInterval));
        continue;
      }

      const element = elements[0];
      const box = await element.boundingBox();

      if (!box) {
        await new Promise((r) => setTimeout(r, checkInterval));
        continue;
      }

      if (lastRect) {
        const deltaX = Math.abs(box.x - lastRect.x);
        const deltaY = Math.abs(box.y - lastRect.y);
        const deltaW = Math.abs(box.width - lastRect.width);
        const deltaH = Math.abs(box.height - lastRect.height);

        if (deltaX < 2 && deltaY < 2 && deltaW < 2 && deltaH < 2) {
          stableCount++;
        } else {
          stableCount = 0;
        }
      } else {
        stableCount = 1;
      }

      if (stableCount >= requiredStableCount) {
        return;
      }

      lastRect = box;
      await new Promise((r) => setTimeout(r, checkInterval));
    }

    // Timeout reached, log but proceed
    // console.warn(`Timeout waiting for stability on ${xpath}`);
  }

  async getFrameOffsets(): Promise<{ frameIndex: number; x: number; y: number }[]> {
    if (!this.page) throw new Error('Driver not initialized');

    const frames = this.page.frames();
    const results: { frameIndex: number; x: number; y: number }[] = [];

    // Helper to get absolute offset of a frame
    const getAbsoluteOffset = async (frame: Frame): Promise<{ x: number; y: number }> => {
      const parent = frame.parentFrame();
      if (!parent) {
        return { x: 0, y: 0 };
      }

      const parentOffset = await getAbsoluteOffset(parent);
      try {
        // Cast to any because frameElement might be missing in some type definitions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const frameElement = await (frame as any).frameElement() as ElementHandle<Element> | null;
        if (frameElement) {
          const box = await frameElement.boundingBox();
          if (box) {
            return {
              x: parentOffset.x + box.x,
              y: parentOffset.y + box.y
            };
          }
        }
      } catch (e) {
        // Ignore errors (e.g. detached frame)
      }
      return parentOffset; // Fallback to parent position if box not found
    };

    // Calculate for all frames
    // We can optimize by caching parent offsets, but for now simple recursion is fine (depth is usually small)
    for (let i = 0; i < frames.length; i++) {
      const offset = await getAbsoluteOffset(frames[i]);
      results.push({ frameIndex: i, x: offset.x, y: offset.y });
    }

    return results;
  }
}
