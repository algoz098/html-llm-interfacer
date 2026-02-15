/**
 * TypeAction - Execute text input actions on elements
 * Supports input, textarea, and contenteditable elements
 */

import { Action, ActionResult } from '../types';

export class TypeAction {
  /**
   * Execute type action (TBD - implementation)
   */
  async execute(_action: Action): Promise<ActionResult> {
    return {
      success: false,
      message: 'TypeAction.execute() - TBD',
      error: 'Not implemented yet',
      confidence: 0,
    };
  }

  /**
   * Execute with fallback chain (TBD - implementation)
   */
  async executeWithFallback(_action: Action): Promise<ActionResult> {
    return {
      success: false,
      message: 'TypeAction.executeWithFallback() - TBD',
      error: 'Not implemented yet',
      confidence: 0,
    };
  }
}
