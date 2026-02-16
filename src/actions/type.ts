/**
 * TypeAction - Execute type actions on elements
 * Implements strategy:
 * 1. XPath selector
 * 2. CSS Selector
 */

import { Action, ActionResult, SessionState } from '../types';
import { BrowserDriver } from '../interfaces/browser-driver';

export class TypeAction {
  /**
   * Execute type action
   */
  async execute(driver: BrowserDriver, action: Action, session: SessionState): Promise<ActionResult> {
    const text = action.text || (action.params?.text as string);
    if (!text) {
        return { success: false, message: 'Missing text to type' };
    }

    const errors: string[] = [];

    // Strategy 1: XPath
    let xpath = action.xpath;
    let frameIndex: number | undefined;

    if (action.elementIndex !== undefined) {
      const element = session.domTree.elements[action.elementIndex];
      if (element) {
        if (!xpath) xpath = element.xpath;
        frameIndex = element.frameIndex;
      }
    }

    if (xpath) {
      try {
        await driver.waitForStability(xpath, undefined, frameIndex);
        await driver.typeXPath(xpath, text, frameIndex);
        return {
          success: true,
          message: `Typed "${text}" into element via XPath`,
          confidence: 1.0,
        };
      } catch (error: any) {
        errors.push(`XPath failed: ${error.message}`);
      }
    }

    // Strategy 2: CSS Selector (if provided)
    if (action.params?.selector && typeof action.params.selector === 'string') {
        try {
            await driver.type(action.params.selector, text);
            return {
                success: true,
                message: `Typed "${text}" via CSS Selector`,
                confidence: 0.9
            };
        } catch (error: any) {
            errors.push(`Selector failed: ${error.message}`);
        }
    }

    return {
      success: false,
      message: 'All type strategies failed',
      error: errors.join('; '),
      confidence: 0,
    };
  }
}
