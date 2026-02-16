/**
 * SmartBrowser - Main automation interface
 * Coordina detecção de elementos, execução de ações e gerenciamento de sessão
 */

import { SmartBrowserConfig, SessionState, Action, ActionResult, DOMTreeState, ActionType } from '../types';
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
      // Evaluate the script in the browser context
      const result = await this.driver.evaluate<DOMTreeState>(domBuilderScript);

      // Update session state
      this.session.domTree = result;
      this.session.domTree.timestamp = Date.now(); // Ensure local timestamp

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
