import { z } from 'zod';

/**
 * Zod schema for the expected LLM action format.
 *
 * Expected JSON:
 * {
 *   "action": "click" | "type" | "navigate" | ...,
 *   "elementId": number,
 *   "params": { ... },
 *   "text": "..."
 * }
 */
export const LLMActionSchema = z.object({
  // Accept string and validate enum membership in logic to provide better error messages
  action: z.string(),
  elementId: z.number().int().nonnegative().optional(),
  params: z.record(z.unknown()).optional(),
  text: z.string().optional(),
  xpath: z.string().optional(),
});

export type LLMAction = z.infer<typeof LLMActionSchema>;
