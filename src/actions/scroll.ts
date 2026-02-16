/// <reference lib="dom" />
import { Action, ActionResult, SessionState } from '../types';
import { BrowserDriver } from '../interfaces/browser-driver';

export class ScrollAction {
  async execute(driver: BrowserDriver, action: Action, session: SessionState): Promise<ActionResult> {
    const params = action.params || {};
    const x = params.x as number | undefined;
    const y = params.y as number | undefined;

    // Strategy 1: Scroll to Element (by index or xpath)
    let xpath = action.xpath;
    // Note: Frame support for scrolling requires extending BrowserDriver or more complex logic.
    // For now, we only support scrolling in the main frame or if the element is found in the main frame context.

    if (action.elementIndex !== undefined && session.domTree.elements[action.elementIndex]) {
      const element = session.domTree.elements[action.elementIndex];
      if (!xpath) {
        xpath = element.xpath;
      }
    }

    if (xpath) {
      try {
        const result = await driver.evaluate((xpathStr) => {
             // XPathResult.FIRST_ORDERED_NODE_TYPE = 9
             const result = document.evaluate(xpathStr, document, null, 9, null);
             const element = result.singleNodeValue as HTMLElement;
             if (element) {
               element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
               return true;
             }
             return false;
        }, xpath);

        if (result) {
            return { success: true, message: `Scrolled to element ${xpath}` };
        } else {
             return { success: false, message: `Element ${xpath} not found for scrolling` };
        }

      } catch (error: any) {
        return {
          success: false,
          message: `Failed to scroll to element: ${error.message}`,
        };
      }
    }

    // Strategy 2: Scroll to Coordinates
    if (x !== undefined || y !== undefined) {
      try {
        await driver.evaluate((scrollX, scrollY) => {
          window.scrollTo({
             left: scrollX !== undefined ? scrollX : window.scrollX,
             top: scrollY !== undefined ? scrollY : window.scrollY,
             behavior: 'smooth'
          });
        }, x, y);
        return {
          success: true,
          message: `Scrolled to coordinates ${x}, ${y}`,
        };
      } catch (error: any) {
         return {
          success: false,
          message: `Failed to scroll to coordinates: ${error.message}`,
        };
      }
    }

    // Strategy 3: Scroll Direction (e.g., "down", "up") - derived from params
    const direction = params.direction as string | undefined;
    if (direction) {
        try {
            await driver.evaluate((dir) => {
                const amount = window.innerHeight * 0.8;
                if (dir === 'down') window.scrollBy({ top: amount, behavior: 'smooth' });
                else if (dir === 'up') window.scrollBy({ top: -amount, behavior: 'smooth' });
                else if (dir === 'bottom') window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                else if (dir === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
            }, direction);
            return {
                success: true,
                message: `Scrolled ${direction}`,
            };
        } catch (error: any) {
            return { success: false, message: `Failed to scroll ${direction}: ${error.message}` };
        }
    }

    return {
      success: false,
      message: 'No valid scroll parameters provided',
    };
  }
}
