/**
 * ClickAction - Execute click actions on elements
 * Implements multi-fallback strategy:
 * 1. XPath selector (most reliable if tree is fresh)
 * 2. Coordinates (fast, good fallback if element moved slightly or ID changed, but requires element visibility)
 * 3. Selector (if available in params)
 */

import { Action, ActionResult, SessionState } from '../types';
import { BrowserDriver } from '../interfaces/browser-driver';

export class ClickAction {
  /**
   * Execute click action with fallback strategy
   */
  async execute(driver: BrowserDriver, action: Action, session: SessionState): Promise<ActionResult> {
    const errors: string[] = [];

    // Strategy 1: XPath
    // Priority: Explicit XPath in action > Element's XPath from session
    let xpath = action.xpath;
    let elementCoords: { x: number, y: number } | undefined;
    let frameIndex: number | undefined;

    // Retrieve element info if index is present, regardless of xpath presence
    // This allows fallback to coordinates even if xpath was provided but failed
    if (action.elementIndex !== undefined && session.domTree.elements[action.elementIndex]) {
      const element = session.domTree.elements[action.elementIndex];
      if (!xpath) {
        xpath = element.xpath;
      }
      elementCoords = { x: element.viewportX, y: element.viewportY };
      frameIndex = element.frameIndex;
    }

    if (xpath) {
      try {
        await driver.waitForStability(xpath, undefined, frameIndex);
        await driver.clickXPath(xpath, frameIndex);
        return {
          success: true,
          message: 'Clicked element via XPath',
          confidence: 1.0,
        };
      } catch (error: any) {
        errors.push(`XPath failed: ${error.message}`);
      }
    }

    // Strategy 2: Coordinates (if available)
    if (elementCoords) {
      try {
        await driver.clickCoordinates(elementCoords.x, elementCoords.y);
        return {
          success: true,
          message: 'Clicked element via Coordinates (Fallback)',
          confidence: 0.8, // Lower confidence
        };
      } catch (error: any) {
        errors.push(`Coordinates failed: ${error.message}`);
      }
    }

    // Strategy 3: CSS Selector (if provided in params)
    if (action.params?.selector && typeof action.params.selector === 'string') {
        try {
            await driver.click(action.params.selector);
            return {
                success: true,
                message: 'Clicked element via CSS Selector (Fallback)',
                confidence: 0.9
            };
        } catch (error: any) {
            errors.push(`Selector failed: ${error.message}`);
        }
    }

    return {
      success: false,
      message: 'All click strategies failed',
      error: errors.join('; '),
      confidence: 0,
    };
  }
}
