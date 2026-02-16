import { DOMElement } from '../types';

export interface DOMSerializerOptions {
  includeNonInteractive?: boolean;
  maxTextLength?: number;
}

/**
 * Serializes DOM elements into a Markdown-like format for LLM consumption.
 */
export class DOMSerializer {
  private options: Required<DOMSerializerOptions>;

  constructor(options: DOMSerializerOptions = {}) {
    this.options = {
      includeNonInteractive: options.includeNonInteractive ?? false,
      maxTextLength: options.maxTextLength ?? 200,
    };
  }

  /**
   * Serialize a list of DOM elements into a string.
   */
  serialize(elements: DOMElement[]): string {
    const lines: string[] = [];

    for (const element of elements) {
      if (element.isVisible === false) continue; // Skip invisible elements explicitly

      if (element.isInteractive) {
        lines.push(this.formatInteractiveElement(element));
      } else if (this.options.includeNonInteractive) {
        const textLine = this.formatTextElement(element);
        if (textLine) lines.push(textLine);
      } else {
        // If not interactive and we are filtering, we might still want
        // significant text context if it's not empty.
        if (element.text && element.text.trim().length > 3) {
           const textLine = this.formatTextElement(element);
           if (textLine) lines.push(textLine);
        }
      }
    }

    return lines.join('\n');
  }

  private formatInteractiveElement(element: DOMElement): string {
    const tagName = element.tagName.toLowerCase();
    const attributes = this.formatAttributes(element.attributes);
    const text = this.formatText(element.text);

    // Format: [index] <tag type="submit"> "Text"
    // We use the global index which is unique across frames
    const id = `[${element.index}]`;

    return `${id} <${tagName}${attributes}> ${text}`;
  }

  private formatTextElement(element: DOMElement): string | null {
    const text = this.formatText(element.text);
    if (!text || text === '""') return null;
    return text; // Just return the quoted text for context
  }

  private formatAttributes(attributes: Record<string, string> | undefined): string {
    if (!attributes) return '';

    const importantAttributes = [
      'type', 'placeholder', 'name', 'value',
      'aria-label', 'role', 'title', 'alt', 'href',
      'checked', 'selected', 'disabled'
    ];

    const parts: string[] = [];

    for (const key of importantAttributes) {
      if (attributes[key]) {
        let value = attributes[key];
        // Truncate long attribute values
        if (value.length > 50) value = value.substring(0, 47) + '...';
        parts.push(`${key}="${value}"`);
      }
    }

    return parts.length > 0 ? ' ' + parts.join(' ') : '';
  }

  private formatText(text: string | undefined): string {
    if (!text) return '';
    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (cleanText.length === 0) return '';

    if (cleanText.length > this.options.maxTextLength) {
      return `"${cleanText.substring(0, this.options.maxTextLength)}..."`;
    }
    return `"${cleanText}"`;
  }
}
