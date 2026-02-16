import { DOMElement } from '../types';

export class MarkdownGenerator {
  generate(elements: DOMElement[]): string {
    const lines: string[] = [];

    // Sort elements by simple document order (index)
    // In a real browser, we might sort by visual position (y, x), but here index is DOM order.
    const sortedElements = [...elements].sort((a, b) => a.index - b.index);

    let lastTag = '';

    for (const el of sortedElements) {
      if (!el.isVisible) continue;

      const role = el.attributes['role'];
      const type = el.attributes['type'];
      const tagName = el.tagName.toLowerCase();

      let text = el.text || el.attributes['aria-label'] || el.attributes['placeholder'] || el.attributes['name'] || '';
      // Truncate long text
      if (text.length > 100) text = text.substring(0, 97) + '...';

      let markdown = '';

      // Skip non-interactive structural elements unless they have significant text
      if (!el.isInteractive && text.length === 0) continue;

      if (el.isInteractive) {
          if (tagName === 'a' || role === 'link') {
              markdown = `[${text || 'Link'}] (ID: ${el.index})`;
          } else if (tagName === 'button' || role === 'button') {
              markdown = `[Button: ${text || 'Submit'}] (ID: ${el.index})`;
          } else if (tagName === 'input') {
              if (type === 'submit' || type === 'button') {
                  markdown = `[Button: ${el.attributes['value'] || text || 'Submit'}] (ID: ${el.index})`;
              } else if (type === 'checkbox' || type === 'radio') {
                  const checked = el.attributes['checked'] !== undefined ? '[x]' : '[ ]';
                  markdown = `${checked} ${text} (ID: ${el.index})`;
              } else {
                  markdown = `[Input: ${text}] (ID: ${el.index})`;
              }
          } else if (tagName === 'select') {
              markdown = `[Select: ${text}] (ID: ${el.index})`;
          } else if (tagName === 'textarea') {
              markdown = `[Textarea: ${text}] (ID: ${el.index})`;
          } else {
              // Generic interactive
              markdown = `[${text}] (ID: ${el.index})`;
          }
      } else {
          // Static content
          // Add some formatting based on tags
          if (['h1', 'h2', 'h3'].includes(tagName)) {
              markdown = `\n### ${text}\n`;
          } else if (tagName === 'p') {
              markdown = text;
          } else if (tagName === 'li') {
              markdown = `- ${text}`;
          } else {
              markdown = text;
          }
      }

      if (markdown.trim()) {
          // Avoid duplicate text if nested (naive check)
          if (lastTag !== markdown) {
              lines.push(markdown);
              lastTag = markdown;
          }
      }
    }

    return lines.join('\n');
  }
}
