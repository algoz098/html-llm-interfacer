import { Action, ActionType } from '../types';
import { LLMActionSchema } from './action-schema';

export class ActionParser {
  /**
   * Parse an LLM response (string or object) into an executable Action.
   */
  parse(llmResponse: string | object): Action {
    // 1. Convert to object if string
    let parsed: unknown;

    if (typeof llmResponse === 'string') {
      try {
        const cleanJson = this.cleanJson(llmResponse);
        parsed = JSON.parse(cleanJson);
      } catch (e: any) {
        throw new Error(`Failed to parse JSON from LLM response: ${e.message}`);
      }
    } else {
      parsed = llmResponse;
    }

    // 2. Validate against schema
    const validation = LLMActionSchema.safeParse(parsed);
    if (!validation.success) {
      // Create a readable error message from Zod errors
      // Use 'issues' property which is standard in Zod v3
      const errorMsg = validation.error.issues
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw new Error(`Invalid action schema: ${errorMsg}`);
    }

    const data = validation.data;

    // Normalize action type (lowercase)
    const rawAction = typeof data.action === 'string' ? data.action.toLowerCase() : data.action;

    // Check if valid action type
    const validTypes = Object.values(ActionType) as string[];
    if (!validTypes.includes(rawAction)) {
      throw new Error(`Unknown action type: "${data.action}". Valid types: ${validTypes.join(', ')}`);
    }

    const actionType = rawAction as ActionType;

    // Create params object ensuring it exists
    const params: Record<string, unknown> = (data.params as Record<string, unknown>) || {};

    // Helper: Normalize specific action requirements before creating Action object

    // For 'type' action, ensure 'text' is in params if provided at root level
    if (actionType === ActionType.Type) {
      if (data.text && !params.text) {
        params.text = data.text;
      }
    }

    // For 'navigate', ensure URL is handled if passed as 'text' or implicit param
    if (actionType === ActionType.Navigate) {
       // Sometimes LLMs put URL in 'text' field or 'url' param
       if (data.text && !params.url) {
         params.url = data.text;
       }
    }

    // 3. Construct internal Action object
    const action: Action = {
      actionType,
      elementIndex: data.elementId,
      xpath: data.xpath,
      text: data.text,
      params,
    };

    return action;
  }

  /**
   * Extract JSON from potential Markdown code blocks.
   */
  private cleanJson(text: string): string {
    // Remove markdown code blocks (```json ... ``` or just ``` ... ```)
    const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
    const match = text.match(jsonBlockRegex);

    if (match && match[1]) {
      return match[1].trim();
    }

    return text.trim();
  }
}
