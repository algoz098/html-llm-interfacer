/**
 * BrowserDriver Interface
 * Defines the contract for browser automation drivers.
 * Allows SmartBrowser to be agnostic of the underlying automation library (Puppeteer, Playwright, etc.).
 */

export interface BrowserDriver {
  /**
   * Initialize the browser instance
   */
  initialize(): Promise<void>;

  /**
   * Close the browser instance
   */
  close(): Promise<void>;

  /**
   * Navigate to a URL
   */
  navigate(url: string): Promise<void>;

  /**
   * Get the current URL
   */
  getUrl(): Promise<string>;

  /**
   * Execute a function in the browser context
   * @param pageFunction Function to execute
   * @param args Arguments to pass to the function
   */
  evaluate<T>(pageFunction: string | ((...args: any[]) => T | Promise<T>), ...args: any[]): Promise<T>;

  /**
   * Click an element by CSS selector
   */
  click(selector: string): Promise<void>;

  /**
   * Click an element by XPath
   */
  clickXPath(xpath: string): Promise<void>;

  /**
   * Click at specific coordinates
   */
  clickCoordinates(x: number, y: number): Promise<void>;

  /**
   * Type text into an element
   */
  type(selector: string, text: string): Promise<void>;

  /**
   * Type text into an element found by XPath
   */
  typeXPath(xpath: string, text: string): Promise<void>;

  /**
   * Select an option in a dropdown
   */
  select(selector: string, value: string): Promise<void>;

  /**
   * Select an option in a dropdown found by XPath
   */
  selectXPath(xpath: string, value: string): Promise<void>;

  /**
   * Take a screenshot
   * @returns Buffer containing the screenshot
   */
  screenshot(): Promise<Buffer>;
}
