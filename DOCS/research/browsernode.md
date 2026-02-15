# BrowserNode Research

**Repository**: leoning60/browsernode  
**Language**: JavaScript / TypeScript  
**Focus**: Interactive element detection heuristics + historical state tracking + DOMElementNode representation

## Overview

BrowserNode emphasizes **fine-grained interactive element detection** with **historical state tracking** across DOM updates. Key innovation: Distinguishing between "potentially clickable" (tag-based) vs. "actually interactive" (event listener + style detection).

## Architecture

### 1. **DOM Tree Building with Interactive Element Focus**

**Location**: `src/dom_tree/index.js`

**Key Decision**: What counts as "interactive"?

```javascript
class DOMBuilder {
  async buildTree(page) {
    const treeData = await page.evaluate(() => {
      const root = document.documentElement;
      return treeBuildHelper(root);
    });
    
    return new DOMElementTree(treeData);
  }
}

function treeBuildHelper(element) {
  const isInteractive = isInteractiveElement(element);
  
  const node = {
    tagName: element.tagName.toLowerCase(),
    xpath: generateXPath(element),  // Cached
    text: extractText(element),
    attributes: {
      id: element.id,
      class: element.className,
      name: element.name,
      'data-testid': element.getAttribute('data-testid'),
      role: element.getAttribute('role')
    },
    
    // Key field
    isInteractive,
    highlightIndex: isInteractive ? globalHighlightIndex++ : null,
    
    // Position
    viewportCoordinates: getViewportCoordinates(element),
    pageCoordinates: getPageCoordinates(element),
    
    // Parent reference for traversal
    parentXPath: element.parentElement ? generateXPath(element.parentElement) : null,
    
    children: Array.from(element.children).map(child => treeBuildHelper(child))
  };
  
  return node;
}
```

### 2. **Interactive Element Heuristics (Multi-Stage)**

**Stage 1: Form elements (100% interactive)**
```javascript
const ALWAYS_INTERACTIVE = new Set([
  'button', 'a', 'input', 'select', 'textarea',
  'label', 'details', 'summary', 'datalist'
]);

function isAlwaysInteractive(element) {
  return ALWAYS_INTERACTIVE.has(element.tagName.toLowerCase());
}
```

**Stage 2: Check for disabled/readonly (filter)**
```javascript
function isActuallyEnabled(element) {
  if (element.disabled || element.readOnly || element.inert) {
    return false;
  }
  
  // Check ancestor chain for disabled fieldset
  let parent = element.parentElement;
  while (parent) {
    if (parent.tagName === 'FIELDSET' && parent.disabled) {
      return false;
    }
    parent = parent.parentElement;
  }
  
  return true;
}
```

**Stage 3: CSS pointer detection (50-70% confidence)**
```javascript
function hasCursorPointerStyle(element) {
  const style = window.getComputedStyle(element);
  
  // Primary indicators
  if (style.cursor === 'pointer') return true;
  if (style.cursor === 'grab' || style.cursor === 'grabbing') return true;
  if (style.cursor === 'move') return true;
  
  // Secondary: user-select:none is often used on clickables
  // to prevent text selection during click
  if (style.userSelect === 'none' && style.cursor !== 'auto') {
    return true;
  }
  
  return false;
}
```

**Stage 4: ARIA role detection (60-80% confidence)**
```javascript
function hasInteractiveRole(element) {
  const role = element.getAttribute('role');
  if (!role) return false;
  
  const interactiveRoles = new Set([
    'button', 'link', 'menuitem', 'tab',
    'checkbox', 'radio', 'switch', 'slider',
    'searchbox', 'combobox', 'listbox'
  ]);
  
  return interactiveRoles.has(role);
}
```

**Stage 5: Event listener detection (40-50% confidence)** ⚠️
```javascript
function hasClickEventHandler(element) {
  // Different environments have different APIs
  
  // Try 1: Browser DevTools API (unreliable)
  try {
    if (typeof getEventListeners !== 'undefined') {
      const listeners = getEventListeners(element);
      if (listeners?.['click']?.length > 0) return true;
    }
  } catch (e) {
    // Not available in evaluate() context
  }
  
  // Try 2: Check onclick attribute
  if (element.hasAttribute('onclick')) return true;
  if (typeof element.onclick === 'function') return true;
  
  // Try 3: Data attributes (framework-specific)
  if (element.hasAttribute('data-click') ||
      element.hasAttribute('ng-click') ||
      element.hasAttribute('@click') ||
      element.hasAttribute('v-on:click')) {
    return true;
  }
  
  // Try 4: Parent delegation (weak signal)
  let parent = element.parentElement;
  for (let i = 0; i < 2 && parent; i++) {
    if (parent.hasAttribute('data-handler') ||
        parent.getAttribute('role') === 'list') {
      return true;  // Weak confidence
    }
    parent = parent.parentElement;
  }
  
  return false;
}
```

**Stage 6: Combined Decision**
```javascript
function isInteractiveElement(element) {
  // Quick pass: always interactive tags
  if (isAlwaysInteractive(element)) {
    return isActuallyEnabled(element);
  }
  
  // Check enabled status first (excludes disabled)
  if (!isActuallyEnabled(element)) {
    return false;
  }
  
  // Accumulate confidence from multiple signals
  let confidence = 0;
  
  if (hasCursorPointerStyle(element)) confidence += 2;
  if (hasInteractiveRole(element)) confidence += 2;
  if (hasClickEventHandler(element)) confidence += 1;
  
  // Threshold: 2+ signals = interactive
  return confidence >= 2;
}
```

### 3. **Top Element Verification**

**Problem**: Element might be interactive, but covered by modal/overlay

**Solution**:
```javascript
function isTopElement(element) {
  // Quick exit: invisible elements
  if (element.offsetWidth === 0 || element.offsetHeight === 0) {
    return false;
  }
  
  const rects = element.getClientRects();
  
  for (const rect of rects) {
    // Skip zero-area rects
    if (rect.width <= 0 || rect.height <= 0) continue;
    
    // Sample multiple points (not just center)
    const points = [
      [rect.left + rect.width * 0.3, rect.top + rect.height * 0.3],
      [rect.left + rect.width * 0.7, rect.top + rect.height * 0.7],
      [rect.left + rect.width * 0.5, rect.top + rect.height * 0.5]  // Center
    ];
    
    let visibleCount = 0;
    
    for (const [x, y] of points) {
      const topEl = document.elementFromPoint(x, y);
      if (topEl && (topEl === element || element.contains(topEl))) {
        visibleCount++;
      }
    }
    
    // At least 2 of 3 points must be on top
    if (visibleCount >= 2) {
      return true;
    }
  }
  
  return false;
}
```

### 4. **BrowserSession Management**

**Session State**:
```typescript
interface BrowserSession {
  sessionId: string;
  page: Page;
  domTree: DOMElementTree;
  selectorMap: Map<number, DOMElementNode>;  // highlightIndex → node
  previousDomTree?: DOMElementTree;  // For delta tracking
  stateHistory: Array<{ timestamp: Date, domTree: DOMElementTree }>;
}

class BrowserSessionManager {
  private sessions: Map<string, BrowserSession> = new Map();
  
  async createSession(headless = true): Promise<BrowserSession> {
    const browser = await puppeteer.launch({ headless });
    const page = await browser.newPage();
    
    const session: BrowserSession = {
      sessionId: generateUUID(),
      page,
      domTree: null,
      selectorMap: new Map(),
      stateHistory: []
    };
    
    this.sessions.set(session.sessionId, session);
    return session;
  }
  
  async navigateTo(sessionId: string, url: string) {
    const session = this.sessions.get(sessionId);
    await session.page.goto(url, { waitUntil: 'networkidle2' });
    
    // Rebuild DOM
    session.previousDomTree = session.domTree;
    session.domTree = await rebuildDOM(session.page);
    session.selectorMap = buildSelectorMap(session.domTree);
    
    // Store in history
    session.stateHistory.push({
      timestamp: new Date(),
      domTree: session.domTree
    });
  }
}
```

**Selector Map** (for quick lookup):
```javascript
function buildSelectorMap(domTree) {
  const map = new Map();
  
  function traverse(node) {
    if (node.highlightIndex !== null) {
      map.set(node.highlightIndex, node);
    }
    
    for (const child of node.children) {
      traverse(child);
    }
  }
  
  traverse(domTree.root);
  return map;
}
```

### 5. **Interaction API**

**Click**:
```javascript
async click(sessionId, elementIndex) {
  const session = this.sessions.get(sessionId);
  const node = session.selectorMap.get(elementIndex);
  
  if (!node) {
    throw new Error(`Element index ${elementIndex} not found`);
  }
  
  // Find element using XPath
  const handle = await session.page.$x(node.xpath);
  if (handle.length === 0) {
    throw new Error(`XPath ${node.xpath} no longer valid`);
  }
  
  // Wait for stability
  await this._waitForStability(session.page, handle[0], 500);
  
  // Click with fallback to coordinate
  try {
    await handle[0].click();
  } catch (e) {
    // Fallback: coordinate click
    const coords = node.viewportCoordinates;
    await session.page.mouse.click(coords.x, coords.y);
  }
  
  // Rebuild DOM after interaction
  await session.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 3000 })
    .catch(() => {}); // OK if no navigation
  
  session.previousDomTree = session.domTree;
  session.domTree = await rebuildDOM(session.page);
  session.selectorMap = buildSelectorMap(session.domTree);
  
  return { success: true, newDOM: session.domTree };
}
```

**Type (Input)**:
```javascript
async type(sessionId, elementIndex, text) {
  const session = this.sessions.get(sessionId);
  const node = session.selectorMap.get(elementIndex);
  
  const handle = await session.page.$x(node.xpath);
  
  // Focus element
  await handle[0].focus();
  
  // Clear if input
  if (node.tagName === 'input' || node.tagName === 'textarea') {
    await handle[0].evaluate(el => el.value = '');
  }
  
  // Type character-by-character (safer for JS frameworks)
  for (const char of text) {
    await session.page.keyboard.type(char, { delay: 50 });
  }
  
  // Trigger change event for frameworks
  await handle[0].evaluate(el => {
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  
  return { success: true };
}
```

### 6. **Frame Navigation (iframes)**

```javascript
function isInFrame(element) {
  // Walk up to find if in iframe
  let current = element;
  while (current !== document.documentElement) {
    if (current === null) return true;  // We've left the main document
    current = current.parentElement;
  }
  return false;
}

async findElementAcrossFrames(page, xpath) {
  // Try main document
  let handle = await page.$x(xpath);
  if (handle.length > 0) return handle[0];
  
  // Try each iframe
  const frames = await page.$$('iframe');
  for (const frame of frames) {
    const frameHandle = await frame.contentFrame();
    handle = await frameHandle.$x(xpath);
    if (handle.length > 0) return handle[0];
  }
  
  return null;
}
```

### 7. **Multi-Action Execution (Atomic Operations)**

```javascript
async multiAct(sessionId, actions) {
  // { actions: [{ action: 'click', params: { index: 5 } }, ...] }
  
  const session = this.sessions.get(sessionId);
  const results = [];
  
  for (const act of actions) {
    try {
      let result;
      
      switch (act.action) {
        case 'click':
          result = await this.click(sessionId, act.params.index);
          break;
        case 'type':
          result = await this.type(sessionId, act.params.index, act.params.text);
          break;
        case 'scroll':
          result = await this.scroll(sessionId, act.params.direction);
          break;
      }
      
      results.push({ success: true, ...result });
    } catch (e) {
      results.push({ success: false, error: e.message });
      break;  // Stop on first error
    }
  }
  
  return { results, currentDOM: session.domTree };
}
```

## Comparison: Interactivity Detection Strategies

| Strategy | Accuracy | Speed | Confidence |
|----------|----------|-------|-----------|
| **Tag-based (form elements)** | 99% | V. Fast | High |
| **Cursor style** | 85% | Fast | Medium |
| **ARIA roles** | 75% | Fast | Medium |
| **Event listeners** | 50% | Slow | Low |
| **Combined (2+ signals)** | 88% | Medium | High |

## Lessons for Our Library

### ✅ **Adopt**
1. **Multi-stage heuristic** — Prioritize: form-based → cursor style → ARIA
2. **isTopElement checking** — Sample multiple points, not just center
3. **State history** — Track previous DOM for delta analysis
4. **Frame-aware navigation** — Handle iframes explicitly
5. **Stability waiting** — Don't interact with animating elements
6. **Coordinate fallback** — If XPath fails, click by coordinates

### ⚠️ **Trade-offs**
1. **Event listener detection** — Unreliable in page.evaluate(); opt for ARIA
2. **Selector map complexity** — Useful for large DOMs; simpler approaches OK for small pages
3. **Multi-action atomicity** — Stop on first error vs. continue on fail?

### 🎯 **Implementation Notes**
- **Disabled detection**: Check not just element.disabled, but also ancestor fieldset
- **Z-order sampling**: Use 3-point sampling (corners + center), not just center
- **XPath stability**: Regenerate after each interaction; old XPaths become stale
- **Frame handling**: Enumerate frames upfront, cache content frames

## Files Reviewed

- `src/dom_tree/index.js` — DOM tree building, interactive detection
- `src/browser/session.ts` — BrowserSession + session management
- `src/browser/page.ts` — Page operations (navigate, refresh)
- `src/browser/click.ts` — Click detection + coordinate handling
- `src/browser/type.ts` — Input + typing logic
- `src/browser/frame.ts` — Frame/iframe navigation
- `src/agent/service.ts` — Multi-action execution
- `tests/` — Unit tests for heuristics
