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
   * Execute a script in all frames and return results
   * @param script Script to execute
   */
  executeInAllFrames<T>(script: string): Promise<{ frameIndex: number, result: T }[]>;

  /**
   * Click an element by CSS selector
   */
  click(selector: string): Promise<void>;

  /**
   * Click an element by XPath
   */
  clickXPath(xpath: string, frameIndex?: number): Promise<void>;

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
  typeXPath(xpath: string, text: string, frameIndex?: number): Promise<void>;

  /**
   * Select an option in a dropdown
   */
  select(selector: string, value: string): Promise<void>;

  /**
   * Select an option in a dropdown found by XPath
   */
  selectXPath(xpath: string, value: string, frameIndex?: number): Promise<void>;

  /**
   * Take a screenshot
   * @returns Buffer containing the screenshot
   */
  screenshot(): Promise<Buffer>;

  /**
   * Wait for an element to be stable (position/size not changing)
   * @param xpath XPath selector for the element
   * @param timeout Timeout in milliseconds
   * @param frameIndex Index of the frame
   */
  waitForStability(xpath: string, timeout?: number, frameIndex?: number): Promise<void>;

  /**
   * Get the bounding box of each frame relative to the viewport
   * @returns Array of objects with x, y coordinates for each frame index
   */
  getFrameOffsets(): Promise<{ frameIndex: number, x: number, y: number }[]>;
}
