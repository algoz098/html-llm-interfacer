import puppeteer, { Browser, Page, ElementHandle } from 'puppeteer';
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
    };
  }

  async initialize(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: this.config.headless ? 'new' : false, // 'new' is recommended for newer puppeteer
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
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

  async click(selector: string): Promise<void> {
    if (!this.page) throw new Error('Driver not initialized');
    await this.page.click(selector);
  }

  async clickXPath(xpath: string): Promise<void> {
    if (!this.page) throw new Error('Driver not initialized');
    const elements = await this.page.$x(xpath);
    if (elements.length > 0) {
      await (elements[0] as ElementHandle<Element>).click();
    } else {
      throw new Error(`Element not found for XPath: ${xpath}`);
    }
  }

  async clickCoordinates(x: number, y: number): Promise<void> {
    if (!this.page) throw new Error('Driver not initialized');
    await this.page.mouse.click(x, y);
  }

  async type(selector: string, text: string): Promise<void> {
    if (!this.page) throw new Error('Driver not initialized');
    await this.page.type(selector, text);
  }

  async typeXPath(xpath: string, text: string): Promise<void> {
    if (!this.page) throw new Error('Driver not initialized');
    const elements = await this.page.$x(xpath);
    if (elements.length > 0) {
      await (elements[0] as ElementHandle<Element>).type(text);
    } else {
      throw new Error(`Element not found for XPath: ${xpath}`);
    }
  }

  async select(selector: string, value: string): Promise<void> {
    if (!this.page) throw new Error('Driver not initialized');
    await this.page.select(selector, value);
  }

  async selectXPath(xpath: string, value: string): Promise<void> {
    if (!this.page) throw new Error('Driver not initialized');
    // Puppeteer doesn't have a direct selectXPath, so we use evaluate or element handle
    const elements = await this.page.$x(xpath);
    if (elements.length > 0) {
      const element = elements[0] as ElementHandle<Element>;
      await element.select(value);
    } else {
      throw new Error(`Element not found for XPath: ${xpath}`);
    }
  }

  async screenshot(): Promise<Buffer> {
    if (!this.page) throw new Error('Driver not initialized');
    return this.page.screenshot() as Promise<Buffer>;
  }
}
