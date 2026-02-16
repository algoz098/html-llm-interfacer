import { JSDOM } from 'jsdom';
import { DOMBuilder } from './dom-builder';
import { MarkdownGenerator } from './markdown-generator';
import { DOMElement } from '../types';

export interface ProcessorOptions {
  /** Base URL for resolving relative links */
  baseUrl?: string;
  /** Max elements to process */
  maxElements?: number;
  /** Only include elements matching selector */
  selector?: string;
}

export interface ProcessorResult {
  /** Markdown representation of the page for LLM */
  markdown: string;
  /** Map of ID to element details for action execution */
  elementMap: Map<number, DOMElement>;
  /** Title of the page */
  title: string;
}

export class HTMLProcessor {
  private builder: DOMBuilder;
  private generator: MarkdownGenerator;

  constructor() {
    this.builder = new DOMBuilder();
    this.generator = new MarkdownGenerator();
  }

  /**
   * Process raw HTML string into LLM-ready format
   */
  async process(html: string, options: ProcessorOptions = {}): Promise<ProcessorResult> {
    const dom = new JSDOM(html, {
      url: options.baseUrl || 'http://localhost',
      contentType: 'text/html',
    });

    const doc = dom.window.document;

    // 1. Build DOM Tree with interactivity detection
    // Note: DOMBuilder logic needs to work in Node/JSDOM context
    const treeState = await this.builder.buildDOMTree(doc, {
      url: options.baseUrl,
      maxElements: options.maxElements,
      selector: options.selector
    });

    // 2. Generate Markdown
    const markdown = this.generator.generate(treeState.elements);

    // 3. Create Element Map
    const elementMap = new Map<number, DOMElement>();
    treeState.elements.forEach(el => {
      elementMap.set(el.index, el);
    });

    return {
      markdown,
      elementMap,
      title: treeState.title
    };
  }
}
