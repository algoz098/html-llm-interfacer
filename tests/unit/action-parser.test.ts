import { ActionParser } from '../../src/translation/action-parser';
import { ActionType } from '../../src/types';

describe('ActionParser', () => {
  let parser: ActionParser;

  beforeEach(() => {
    parser = new ActionParser();
  });

  it('should parse valid JSON string', () => {
    const json = '{"action": "click", "elementId": 1}';
    const action = parser.parse(json);

    expect(action.actionType).toBe(ActionType.Click);
    expect(action.elementIndex).toBe(1);
  });

  it('should parse JSON from markdown block', () => {
    const markdown = 'Here is the action:\n```json\n{"action": "type", "elementId": 2, "text": "hello"}\n```';
    const action = parser.parse(markdown);

    expect(action.actionType).toBe(ActionType.Type);
    expect(action.elementIndex).toBe(2);
    expect(action.params?.text).toBe('hello');
  });

  it('should handle uppercase action type', () => {
    const json = '{"action": "CLICK", "elementId": 1}';
    const action = parser.parse(json);

    expect(action.actionType).toBe(ActionType.Click);
  });

  it('should handle invalid JSON gracefully', () => {
    expect(() => parser.parse('invalid json')).toThrow(/Failed to parse JSON/);
  });

  it('should throw error for unknown action type', () => {
    const invalidAction = '{"action": "dance", "elementId": 1}';
    expect(() => parser.parse(invalidAction)).toThrow(/Unknown action type/);
  });

  it('should infer params for navigate action', () => {
    const json = '{"action": "navigate", "text": "http://example.com"}';
    const action = parser.parse(json);

    expect(action.actionType).toBe(ActionType.Navigate);
    expect(action.params?.url).toBe("http://example.com");
  });
});
