/**
 * SmartBrowser - Main automation interface
 * Coordina detecção de elementos, execução de ações e gerenciamento de sessão
 */

import { SmartBrowserConfig, SessionState, Action, ActionResult, DOMTreeState, ActionType, DOMElement } from '../types';
import { BrowserDriver } from '../interfaces/browser-driver';
import { DOMBuilder } from '../core/dom-builder';
import { ClickAction } from '../actions/click';
import { TypeAction } from '../actions/type';
import { SelectAction } from '../actions/select';

/**
 * SmartBrowser: Multi-layer web automation engine
 *
 * Layered architecture:
 * 1. DOM Management (nanobrowser heuristics)
 * 2. Session Management (browsernode patterns)
 * 3. Action Execution (browserable multi-fallback)
 * 4. Content Cleaning (readability extraction)
 * 5. LLM Integration (skyvern action taxonomy)
 */
export class SmartBrowser {
  private driver: BrowserDriver;
  private config: SmartBrowserConfig;
  private session: SessionState;

  constructor(driver: BrowserDriver, config: SmartBrowserConfig = {}) {
    this.driver = driver;
    this.config = config;
    this.session = {
      sessionId: Math.random().toString(36).substring(2, 15),
      domTree: {
        url: '',
        title: '',
        elements: [],
        timestamp: 0,
      },
      history: [],
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): SmartBrowserConfig {
    return this.config;
  }

  /**
   * Initialize the browser and create a session
   */
  async initialize(): Promise<void> {
    await this.driver.initialize();
  }

  /**
   * Build DOM tree with element detection
   * Phase 1: Multi-stage interactivity heuristic
   */
  async buildDOMTree(): Promise<DOMTreeState> {
    // Inject DOMBuilder logic into the browser
    /* eslint-disable @typescript-eslint/ban-types */
    const domBuilderScript = `
      (async () => {
        ${DOMBuilder.toString()}
        return new DOMBuilder().buildDOMTree(document);
      })()
    `;

    try {
      // Execute in all frames
      const [results, frameOffsets] = await Promise.all([
        this.driver.executeInAllFrames<DOMTreeState>(domBuilderScript),
        this.driver.getFrameOffsets()
      ]);

      // Merge results
      // Find main frame (usually index 0, or the one with matching URL if we tracked it, but index 0 is safe bet for now)
      // Puppeteer main frame is always index 0 in frames() array?
      // Actually frames() returns all frames including main.
      // We'll assume index 0 is main.
      const mainFrameResult = results.find((r) => r.frameIndex === 0);

      if (!mainFrameResult) {
        // Fallback: use the first successful result if 0 failed or doesn't exist
        if (results.length > 0) {
           // use results[0]
        } else {
           throw new Error('No frames returned DOM tree');
        }
      }

      const finalElements: DOMElement[] = [];
      let globalIndex = 0;

      // Sort results by frameIndex to be deterministic
      results.sort((a, b) => a.frameIndex - b.frameIndex);

      // Create offset map for quick lookup
      const offsetMap = new Map<number, { x: number; y: number }>();
      frameOffsets.forEach((offset) => {
        offsetMap.set(offset.frameIndex, { x: offset.x, y: offset.y });
      });

      for (const res of results) {
        const frameElements = res.result.elements;
        const frameId = res.frameIndex;
        const offset = offsetMap.get(frameId) || { x: 0, y: 0 };

        frameElements.forEach((el) => {
          // Update frame index
          el.frameIndex = frameId;

          // Adjust coordinates to be relative to main viewport
          el.viewportX += offset.x;
          el.viewportY += offset.y;

          // Re-index globally
          el.index = globalIndex++;
          finalElements.push(el);
        });
      }

      // Construct final tree based on main frame metadata
      this.session.domTree = {
        url: mainFrameResult?.result.url || '',
        title: mainFrameResult?.result.title || '',
        elements: finalElements,
        timestamp: Date.now(),
      };

      return this.session.domTree;
    } catch (error: any) {
      console.error('Failed to build DOM tree:', error);
      throw new Error(`DOM Build failed: ${error.message}`);
    }
  }

  /**
   * Execute an action on an element
   * Phase 1: XPath + coordinate fallback
   */
  async executeAction(action: Action): Promise<ActionResult> {
    try {
      // 1. Validate action
      if (!action.actionType) {
        return { success: false, message: 'Missing actionType' };
      }

      // 2. Map high-level action to driver call
      switch (action.actionType) {
        case ActionType.Navigate:
            if (action.params?.url && typeof action.params.url === 'string') {
                await this.navigate(action.params.url);
                return { success: true, message: `Navigated to ${action.params.url}` };
            }
            return { success: false, message: 'URL required for navigation' };

        case ActionType.Click:
             return await new ClickAction().execute(this.driver, action, this.session);

        case ActionType.Type:
             return await new TypeAction().execute(this.driver, action, this.session);

        case ActionType.Select:
             return await new SelectAction().execute(this.driver, action, this.session);
      }

      // 3. Update session history
      this.session.history.push({
        action: action.actionType,
        timestamp: Date.now(),
      });

      return {
        success: false,
        message: `Action ${action.actionType} not fully implemented yet`,
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Execution failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string): Promise<void> {
    await this.driver.navigate(url);
    // Update session URL immediately
    this.session.domTree.url = url;
  }

  /**
   * Get current session state
   */
  getSession(): SessionState | undefined {
    return this.session;
  }

  /**
   * Close the browser and cleanup resources
   */
  async close(): Promise<void> {
    await this.driver.close();
  }
}
