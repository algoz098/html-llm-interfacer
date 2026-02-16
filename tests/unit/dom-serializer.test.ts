import { DOMSerializer } from '../../src/translation/dom-serializer';
import { DOMElement } from '../../src/types';

describe('DOMSerializer', () => {
  let serializer: DOMSerializer;

  beforeEach(() => {
    serializer = new DOMSerializer({ includeNonInteractive: false });
  });

  it('should serialize interactive elements correctly', () => {
    const elements: DOMElement[] = [
      {
        index: 1,
        tagName: 'BUTTON',
        text: 'Submit',
        xpath: '//button',
        attributes: { type: 'submit' },
        isInteractive: true,
        isVisible: true,
        viewportX: 0,
        viewportY: 0,
        pageX: 0,
        pageY: 0,
        frameIndex: 0
      }
    ];

    const result = serializer.serialize(elements);
    expect(result).toBe('[1] <button type="submit"> "Submit"');
  });

  it('should skip invisible elements', () => {
    const elements: DOMElement[] = [
      {
        index: 1,
        tagName: 'BUTTON',
        text: 'Hidden',
        xpath: '//button',
        attributes: {},
        isInteractive: true,
        isVisible: false,
        viewportX: 0,
        viewportY: 0,
        pageX: 0,
        pageY: 0
      }
    ];

    const result = serializer.serialize(elements);
    expect(result).toBe('');
  });

  it('should truncate long text', () => {
    const longText = 'a'.repeat(300);
    const elements: DOMElement[] = [
      {
        index: 1,
        tagName: 'DIV',
        text: longText,
        xpath: '//div',
        attributes: {},
        isInteractive: true,
        isVisible: true,
        viewportX: 0,
        viewportY: 0,
        pageX: 0,
        pageY: 0
      }
    ];

    const result = serializer.serialize(elements);
    expect(result).toContain('..."');
    expect(result.length).toBeLessThan(longText.length);
  });

  it('should include non-interactive text if configured', () => {
    const serializerWithText = new DOMSerializer({ includeNonInteractive: true });
    const elements: DOMElement[] = [
        {
            index: 2,
            tagName: 'DIV',
            text: 'Just some text',
            xpath: '//div',
            attributes: {},
            isInteractive: false,
            isVisible: true,
            viewportX: 0, viewportY: 0, pageX: 0, pageY: 0
        }
    ];

    const result = serializerWithText.serialize(elements);
    expect(result).toBe('"Just some text"');
  });
});
