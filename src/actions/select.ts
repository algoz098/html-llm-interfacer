/**
 * SelectAction - Execute dropdown selection actions
 * Implements strategy:
 * 1. XPath selector
 * 2. CSS Selector
 */

import { Action, ActionResult, SessionState } from '../types';
import { BrowserDriver } from '../interfaces/browser-driver';

export class SelectAction {
  /**
   * Execute select action
   */
  async execute(driver: BrowserDriver, action: Action, session: SessionState): Promise<ActionResult> {
    const value = (action.params?.value as string);
    if (!value) {
        return { success: false, message: 'Missing value to select' };
    }

    const errors: string[] = [];

    // Strategy 1: XPath
    let xpath = action.xpath;

    if (!xpath && action.elementIndex !== undefined) {
      const element = session.domTree.elements[action.elementIndex];
      if (element) {
        xpath = element.xpath;
      }
    }

    if (xpath) {
      try {
        await driver.selectXPath(xpath, value);
        return {
          success: true,
          message: `Selected "${value}" via XPath`,
          confidence: 1.0,
        };
      } catch (error: any) {
        errors.push(`XPath failed: ${error.message}`);
      }
    }

    // Strategy 2: CSS Selector (if provided)
    if (action.params?.selector && typeof action.params.selector === 'string') {
        try {
            await driver.select(action.params.selector, value);
            return {
                success: true,
                message: `Selected "${value}" via CSS Selector`,
                confidence: 0.9
            };
        } catch (error: any) {
            errors.push(`Selector failed: ${error.message}`);
        }
    }

    return {
      success: false,
      message: 'All select strategies failed',
      error: errors.join('; '),
      confidence: 0,
    };
  }
}
