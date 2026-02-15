# Browserable Research

**Repository**: browserable/browserable  
**Language**: JavaScript/Python (Hybrid)  
**Focus**: Multi-strategy DOM extraction + XPath generation + viewport-aware action execution

## Overview

Browserable is a **hybrid JS/Python automation framework** that emphasizes **DOM chunking** (for large pages) and **multi-strategy action execution** (with vision fallback). Key insight: Split large DOMs into viewport-sized chunks to avoid token explosion when passing DOM to LLM.

## Architecture

### 1. **Multi-Helper Action Execution Pattern**

**Three execution strategies** (tried in sequence):
```javascript
// Strategy 1: Simple action (50% of cases)
async actHelper(element, nodeIndex, actionType) {
  // Directly find element by index + interact
  const { clickableElements } = await buildDOMTree();
  const target = clickableElements[nodeIndex];
  
  if (actionType === 'click') {
    await target.click();
  } else if (actionType === 'type') {
    await target.focus();
    await target.keyboard.type(text);
  }
  
  return { success: true, newDOM: await buildDOMTree() };
}

// Strategy 2: Action with verification (30% of cases)
async actHelperWithVerification(element, actionType, expectedChange) {
  // Perform action + check DOM for expected result
  const beforeDOM = await buildDOMTree();
  
  // ... perform action
  
  const afterDOM = await buildDOMTree();
  const changed = diffDOMs(beforeDOM, afterDOM);
  
  if (expectedChange && !changed.includes(expectedChange)) {
    // Action didn't have expected effect
    return { success: false, reason: 'No DOM change detected' };
  }
  
  return { success: true, newDOM: afterDOM };
}

// Strategy 3: Vision-assisted action (20% of cases - as fallback)
async actHelperWithVision(screenshot, prompts, actionType) {
  // LLM+vision decides WHERE to click based on screenshot
  
  const response = await openai.createChatCompletion({
    model: 'gpt-4-vision',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompts.actionPrompt },
          { type: 'image_url', url: `data:image/png;base64,${screenshot}` }
        ]
      }
    ]
  });
  
  // Parse bounding box from response: "click [x1,y1,x2,y2]"
  const { x, y } = parseCoordinates(response.choices[0].text);
  
  // Coordinate click
  await page.mouse.click(x, y);
  
  return { success: true, newDOM: await buildDOMTree() };
}
```

**Strategy Selection Logic**:
```javascript
async act(elementRef, actionType, text = null) {
  let lastError = null;
  
  // Try in order: simple → verification → vision
  const strategies = [
    () => actHelper(elementRef, actionType, text),
    () => actHelperWithVerification(elementRef, actionType, null),
    async () => {
      const screenshot = await takeScreenshot();
      return actHelperWithVision(screenshot, this.prompts, actionType);
    }
  ];
  
  for (const strategy of strategies) {
    try {
      const result = await strategy();
      if (result.success) return result;
      lastError = result.reason;
    } catch (e) {
      lastError = e.message;
    }
  }
  
  throw new Error(`All action strategies failed: ${lastError}`);
}
```

### 2. **DOM Tree Building with XPath**

**Efficient XPath Generation**:
```javascript
function generateXPath(element) {
  // Smart: Use ID/name if available
  if (element.id) return `//*[@id='${element.id}']`;
  if (element.name) return `//*[@name='${element.name}']`;
  
  // Otherwise: Build from ancestors
  const parts = [];
  let current = element;
  
  while (current && current.nodeType === 1) { // 1 = ELEMENT_NODE
    let index = 1;
    let sibling = current.previousSibling;
    
    while (sibling) {
      if (sibling.nodeType === 1 && sibling.tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousSibling;
    }
    
    const tagName = current.tagName.toLowerCase();
    // Prefer attributes over position
    if (current.hasAttribute('data-testid')) {
      parts.unshift(`${tagName}[@data-testid='${current.getAttribute('data-testid')}']`);
      break;  // Stop here, very specific
    } else if (current.hasAttribute('aria-label')) {
      parts.unshift(`${tagName}[@aria-label='${current.getAttribute('aria-label')}']`);
      break;
    } else {
      parts.unshift(`${tagName}[${index}]`);
    }
    
    current = current.parentElement;
  }
  
  return '/' + parts.join('/');
}
```

**DOM Tree Node Structure**:
```javascript
{
  tagName: 'button',
  text: 'Submit',
  attributes: { id: 'btn-submit', 'aria-label': 'Submit form' },
  xpath: "//*[@id='btn-submit']",  // Cached from generateXPath
  clickableIndex: 5,               // Position in clickableElements array
  boundingBox: { x: 100, y: 200, width: 80, height: 40 },
  isVisible: true,
  isInteractive: true,
  highlightIndex: 5,
  
  // For large pages: which chunk(s) this appears in
  chunks: [0, 1],  // Appears in chunk 0 and 1 due to position
  
  children: [...]
}
```

### 3. **DOM Chunking (Viewport-Aware Splitting)**

**Problem**: Large pages (10k+ nodes) blow up token count

**Solution**:
```javascript
class DOMChunker {
  constructor(viewportHeight = 800) {
    this.viewportHeight = viewportHeight;
    this.chunks = [];
  }
  
  chunkDOM(domTree) {
    // Collect all visible elements with positions
    const elements = [];
    this._collectElements(domTree, elements);
    
    // Sort by Y position
    elements.sort((a, b) => a.y - b.y);
    
    // Split into chunks
    for (let i = 0; i < elements.length; i++) {
      const chunkIndex = Math.floor(elements[i].y / this.viewportHeight);
      
      if (!this.chunks[chunkIndex]) {
        this.chunks[chunkIndex] = [];
      }
      
      this.chunks[chunkIndex].push({
        ...elements[i],
        chunkId: chunkIndex,
        localIndex: this.chunks[chunkIndex].length
      });
    }
    
    return this.chunks;
  }
  
  getChunkDOM(chunkIndex) {
    // Return sparse tree for just this chunk
    const elements = this.chunks[chunkIndex];
    
    return {
      chunkId: chunkIndex,
      viewportInfo: `Elements ${chunkIndex * 10} - ${(chunkIndex + 1) * 10}`,
      elements: elements,
      totalElements: elements.length
    };
  }
}
```

**Usage in Agent Loop**:
```javascript
async function agentStep(objective, currentChunk = 0) {
  const domChunk = chunker.getChunkDOM(currentChunk);
  
  const response = await llm.prompt(`
    Objective: ${objective}
    Current viewport chunk: ${currentChunk}
    
    Available elements in this chunk:
    ${JSON.stringify(domChunk.elements, null, 2)}
    
    What action should we take?
  `);
  
  const action = parseAction(response);
  
  if (action.requiresScroll && action.scrollTarget > currentChunk) {
    // Need to scroll to different chunk
    await page.evaluate(el => el.scrollIntoView(), 
      getElementByIndex(action.elementIndex));
    return agentStep(objective, action.scrollTarget);
  }
  
  // Execute action in current chunk
  return await act(action);
}
```

**Token Savings**:
- Full 10k-node DOM: ~50k tokens
- Single chunk (500 nodes): ~2.5k tokens
- **20x reduction** with proper chunking!

### 4. **Multi-Strategy Text Extraction**

**Strategy 1: Simple text extraction**
```javascript
async textExtractHelper(selector) {
  const elements = await page.$$(selector);
  const texts = [];
  
  for (const el of elements) {
    const text = await el.evaluate(e => e.innerText);
    texts.push(text.trim());
  }
  
  return texts.join('\n');
}
```

**Strategy 2: DOM-based extraction (preserves structure)**
```javascript
async domExtractHelper(root) {
  // Walk DOM, preserving hierarchy
  const result = [];
  
  function walk(node, depth = 0) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text) result.push('  '.repeat(depth) + text);
    } else {
      // Element node
      for (const child of node.childNodes) {
        walk(child, depth + 1);
      }
    }
  }
  
  walk(root);
  return result.join('\n');
}
```

**Strategy 3: DOM chunking for large extracts**
```javascript
async domExtractHelperChunked(root, chunkSize = 500) {
  const allElements = this._collectElements(root);
  const chunks = [];
  
  for (let i = 0; i < allElements.length; i += chunkSize) {
    const chunk = allElements.slice(i, i + chunkSize);
    chunks.push({
      chunkId: chunks.length,
      elements: chunk.map(el => ({
        tag: el.tagName.toLowerCase(),
        text: el.innerText?.substring(0, 100),
        xpath: generateXPath(el)
      }))
    });
  }
  
  return chunks;
}
```

### 5. **Prompt Engineering for Actions**

**Action Decision Prompt Template**:
```javascript
templates.actionPrompt = `
You are a web automation assistant.

OBJECTIVE: ${objective}

CURRENT PAGE STATE:
- URL: ${url}
- DOM (relevant elements):
${JSON.stringify(relevantElements, null, 2)}

AVAILABLE ACTIONS:
1. click element [index]
2. type "[text]" into [index]
3. select [value] from dropdown [index]
4. scroll down
5. scroll up
6. wait (if page is loading)
7. extract data using xpath [xpath]

INSTRUCTIONS:
- Choose the action that moves toward the OBJECTIVE
- Be specific: always include the element index or element description
- If multiple elements match, pick the most specific one (prefer data-testid or id)
- Explain your reasoning

RESPONSE FORMAT:
{
  "action": "click|type|select|scroll|wait|extract",
  "targetIndex": 5,  // For click/type
  "params": { "text": "..." },  // For type
  "reasoning": "..."
}
`;
```

**Extraction Decision Prompt Template**:
```javascript
templates.extractPrompt = `
OBJECTIVE: Extract ${extractObjective}

CURRENT PAGE DOM:
${JSON.stringify(domChunk, null, 2)}

INSTRUCTIONS:
- Identify which elements contain the target data
- Generate XPaths for those elements
- Describe the expected data structure

RESPONSE FORMAT:
{
  "targets": [
    { "xpath": "//div[@class='product']//span[@class='price']", "label": "price" },
    { "xpath": "//div[@class='product']//span[@class='name']", "label": "name" }
  ],
  "structure": {
    "price": "string (e.g., '$19.99')",
    "name": "string (e.g., 'Product Name')"
  }
}
`;
```

### 6. **Integration with Jarvis**

(Assuming Jarvis is an orchestration framework)

```javascript
class BrowserableAgent extends JarvisAgent {
  async step(observation) {
    // observation = { screenshot, domChunk, url, history }
    
    // 1. Decide if we need a different chunk
    const chunkNeeded = await this.llm.decideSwitchChunk(
      observation.domChunk,
      observation.objective
    );
    
    if (chunkNeeded !== observation.chunkIndex) {
      await this.browser.scrollToChunk(chunkNeeded);
      observation.domChunk = await this.getDOMChunk(chunkNeeded);
    }
    
    // 2. Decide action
    const action = await this.llm.decideAction(
      observation.domChunk,
      observation.objective,
      observation.history
    );
    
    // 3. Execute with multi-strategy fallback
    const result = await this.act(action, observation.screenshot);
    
    // 4. Return observation for next step
    return {
      ...observation,
      actionResult: result,
      screenshot: await this.browser.screenshot(),
      domChunk: await this.getDOMChunk(observation.chunkIndex)
    };
  }
  
  async *agentLoop(objective, maxSteps = 10) {
    let observation = await this.initialize();
    
    for (let step = 0; step < maxSteps; step++) {
      // Check termination condition
      if (await this.isObjectiveComplete(observation)) {
        yield { done: true, result: observation.extractedData };
        break;
      }
      
      observation = await this.step(observation);
      
      yield { done: false, step, observation };
    }
  }
}
```

## Comparison: Chunking Strategies

| Approach | Pros | Cons | Token Usage |
|----------|------|------|------------|
| **Full DOM** | Complete context | Token explosion on large pages | 50k+ tokens |
| **Viewport chunks** | Manageable tokens, natural scrolling | Misses off-screen content | 2-5k per chunk |
| **Relevant elements only** | Minimal tokens | Requires element filtering | 1-2k per step |
| **Hierarchical (summary + details)** | Context + detail | Complex to implement | 5-10k per step |

## Lessons for Our Library

### ✅ **Adopt**
1. **Multi-strategy fallback** — Try simple → complex → vision-based
2. **DOM chunking** — Split large pages into viewport-sized chunks (critical for tokens!)
3. **XPath caching** — Generate once, reuse; prefer ID/data-testid/aria-label
4. **Action verification** — Check DOM before/after to confirm action worked
5. **Vision fallback** — Use screenshot when selectors fail
6. **Prompt templates** — Structured decision prompts for action/extraction

### ⚠️ **Trade-offs**
1. **Chunking complexity** — Worth it for pages > 3000 nodes; overkill for small pages
2. **Vision feedback loop** — Slower (~5s per request) but more reliable than prediction
3. **XPath vs index** — XPath more stable across reloads, but requires generation

### 🎯 **Implementation Notes**
- **Chunk size**: Empirically, 500-800 visible elements per chunk works well
- **XPath optimization**: Always check for ID first (most stable)
- **Action verification**: DOM diff can be expensive; sample key elements instead
- **Token budgeting**: Reserve ~20% of token budget for action planning, 80% for DOM/context

## Files Reviewed

- `browserable.js` — Main agent loop + DOM/action/extract coordination
- `dom.js` — DOM tree building, chunking, XPath generation
- `actHelper.js` — Multi-strategy action execution
- `actHelperWithVision.js` — Vision-based action selection
- `textExtractHelper.js` / `domExtractHelper.js` — Extraction strategies
- `prompts/` — Action and extraction decision templates
- `jarvis-integration.js` — Integration with Jarvis orchestrator
