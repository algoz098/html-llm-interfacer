import { Action, ActionResult, SessionState } from '../types';
import { BrowserDriver } from '../interfaces/browser-driver';

export class WaitAction {
  async execute(driver: BrowserDriver, action: Action, _session: SessionState): Promise<ActionResult> {
    const params = action.params || {};
    const duration = params.duration as number | undefined;
    const xpath = action.xpath || (params.xpath as string | undefined);
    const selector = params.selector as string | undefined;

    // Strategy 1: Explicit Duration
    if (duration && typeof duration === 'number') {
      await new Promise(resolve => setTimeout(resolve, duration));
      return {
        success: true,
        message: `Waited for ${duration}ms`,
      };
    }

    // Strategy 2: Wait for Element (XPath)
    // We use waitForStability which waits for element presence AND stability.
    // If only presence is needed, this might be overkill but safe.
    if (xpath) {
      try {
        // Use a reasonable timeout if not provided
        const timeout = (params.timeout as number) || 5000;
        await driver.waitForStability(xpath, timeout);
        return {
          success: true,
          message: `Waited for element ${xpath} to be stable`,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Timeout waiting for element ${xpath}: ${error.message}`,
        };
      }
    }

    // Strategy 3: Wait for Selector (Not fully supported by driver yet, fallback to duration if provided, else fail)
    if (selector) {
        return {
            success: false,
            message: "Waiting for selector is not yet supported. Please use XPath or duration."
        };
    }

    return {
      success: false,
      message: 'No valid wait parameters provided (duration or xpath)',
    };
  }
}
