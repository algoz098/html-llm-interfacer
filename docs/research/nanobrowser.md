# nanobrowser Research

**Repository**: nanobrowser/nanobrowser  
**Language**: TypeScript / JavaScript  
**Focus**: DOM tree inspection + visibility/interactivity heuristics + highlight indexing

## Overview

Nanobrowser is a headless browser automation library that prioritizes **accurate element classification** through heuristic-based visibility and interactivity detection. Its key contribution is comprehensive DOM tree building with detailed element state tracking (visibility, interactivity, viewport position).

## Key Architecture Insights

### 1. **Comprehensive Element Classification**

**Elements Tracked**:
- `isVisible` — Computed style + dimensions check
- `isTopElement` — Z-order verification via `elementFromPoint()`
- `isInteractive` — Multi-criteria detection (tag, cursor, attributes, event listeners)
- `isInViewport` — Viewport bounds + viewport expansion tolerance
- `highlightIndex` — Sequential index for element targeting

**DOMElementNode** (`src/dom/views.ts`):
```typescript
interface DOMElementNode {
  tagName: string | null;
  xpath: string | null;
  attributes: Record<string, string>;
  children: DOMBaseNode[];
  isVisible: boolean;
  isTopElement: boolean;
  isInteractive: boolean;
  isInViewport: boolean;
  shadowRoot: boolean;
  highlightIndex: number | null;
  viewportCoordinates: CoordinateSet | null;
  pageCoordinates: CoordinateSet | null;
  viewportInfo: ViewportInfo | null;
  isNew?: boolean | null;  // Tracks state changes from previous page
}
```

### 2. **Interactivity Detection Algorithm**

**Location**: `chrome-extension/public/buildDomTree.js` → `isInteractiveElement()`

**Multi-stage heuristic**:

```javascript
function isInteractiveElement(element) {
  // Stage 1: Check cursor style (PRIMARY - 60% confidence)
  const computedCursor = getComputedStyle(element).cursor;
  const interactiveCursors = new Set([
    'pointer',    // Links, buttons
    'grab', 'grabbing',  // Draggable
    'move',      // Movable elements
    'text', 'cell', 'crosshair'
  ]);
  if (interactiveCursors.has(computedCursor)) {
    return true;  // Highest confidence
  }

  // Stage 2: Form elements (HIGH - 95% confidence)
  const interactiveElements = new Set([
    'a', 'button', 'input', 'select', 'textarea',
    'label', 'details', 'summary'
  ]);
  if (interactiveElements.has(tagName)) {
    // But check for disabled/readonly
    if (element.disabled || element.readOnly || element.inert) {
      return false;
    }
    return true;
  }

  // Stage 3: ARIA roles (MEDIUM - 70% confidence)
  const interactiveRoles = new Set([
    'button', 'link', 'menuitem', 'tab', 'checkbox', 
    'radio', 'switch', 'slider', 'textbox'
  ]);
  const role = element.getAttribute('role');
  if (role && interactiveRoles.has(role)) {
    return true;
  }

  // Stage 4: Event handlers (SPECULATIVE - 40% confidence)
  try {
    const listeners = getEventListeners(element);  // Not JSON.parse() safe
    if (listeners?.['click']?.length > 0) {
      return true;
    }
  } catch (e) {
    // In evaluate() context, getEventListeners unavailable
  }

  // Stage 5: Common attributes (WEAK - 50% confidence)
  if (element.hasAttribute('onclick') ||
      element.hasAttribute('data-action') ||
      element.getAttribute('aria-haspopup') === 'true') {
    return true;
  }

  return false;  // Default: not interactive
}
```

**Trade-offs**:
- ✅ **Cursor style** is most reliable (mirrors user intent)
- ✅ **Form tags** are always-correct
- ⚠️ **Event listeners** unreliable in page.evaluate() context
- ❌ **ARIA-only** too many false positives

### 3. **Visibility Detection**

**Location**: `buildDomTree.js` → `isElementVisible()`, `isTopElement()`, `isTextNodeVisible()`

**Multi-level checking**:

```javascript
function isElementVisible(element) {
  // Quick checks first (low cost)
  if (element.offsetWidth === 0 || element.offsetHeight === 0) {
    return false;  // Hidden by layout
  }
  
  const style = getComputedStyle(element);
  if (style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0') {
    return false;
  }
  
  return true;
}

function isTopElement(element) {
  // Most expensive check - only do if visible
  const rects = element.getClientRects();
  
  for (const rect of rects) {
    if (rect.width <= 0 || rect.height <= 0) continue;
    
    // Sample the center point
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const topEl = document.elementFromPoint(centerX, centerY);
    
    if (element.contains(topEl) || element === topEl) {
      return true;  // This element is visible at center
    }
  }
  
  return false;  // Covered by other elements
}
```

### 4. **Viewport Expansion Concept**

**Purpose**: Allow detection of "nearly visible" elements (useful for lazy-load scenarios)

```typescript
interface ViewportExpansion {
  viewportExpansion: number;  // pixels, e.g., 500
  // Elements within 500px below current viewport = "inViewport: true"
}

// Usage: includeHiddenElements by expanding detection zone
if (isInExpandedViewport(element, viewportExpansion)) {
  nodeData.isInViewport = true;
}
```

### 5. **Highlight Index System**

**Flow**:
1. Traverse DOM and mark interactive elements
2. Assign sequential `highlightIndex: 0, 1, 2, ...` to each
3. Use index for agent reference: "click element 5"
4. Store mapping: `selectorMap: { 0: DOMElementNode, 1: DOMElementNode, ... }`

**State Tracking**:
```typescript
isNew?: boolean | null;  // True if element didn't exist on previous page
// Useful for agents to know what changed
```

### 6. **Distinct Interaction Detection**

**Problem**: Nested interactive elements (e.g., menu item inside div inside button)
- Should both be highlighted? Or just parent?

**Solution**:
```javascript
function isElementDistinctInteraction(element) {
  // Only count if:
  
  // 1. Has direct onclick handler
  if (element.hasAttribute('onclick') ||
      typeof element.onclick === 'function') {
    return true;  // Definitely distinct
  }
  
  // 2. Has test automation attributes
  if (element.hasAttribute('data-testid') ||
      element.hasAttribute('data-cy')) {
    return true;  // Explicitly marked
  }
  
  // 3. Is standard semantic element
  if (DISTINCT_INTERACTIVE_TAGS.has(element.tagName)) {
    return true;
  }
  
  // 4. Has event listener for interaction
  const listeners = getEventListenersForNode(element);
  const interactionEvents = ['click', 'mousedown', 'change'];
  if (listeners.some(l => interactionEvents.includes(l.type))) {
    return true;
  }
  
  return false;  // Might be wrapper, skip
}
```

### 7. **Performance Optimizations**

**Caching**:
```typescript
const DOM_CACHE = {
  boundingRects: new WeakMap(),    // Cache getBoundingClientRect()
  computedStyles: new WeakMap(),   // Cache getComputedStyle()
  clear: () => { /* refresh */ }
};
```

**Iterative Traversal** (vs. recursive):
```typescript
// Avoid "Maximum call stack size exceeded" on 10k+ element DOMs
export function getClickableElements(domElement: DOMElementNode): DOMElementNode[] {
  const stack = [domElement];
  const result = [];
  
  while (stack.length > 0) {
    const node = stack.pop();
    
    if (node instanceof DOMElementNode && node.isInteractive) {
      result.push(node);
    }
    
    for (const child of node.children) {
      stack.push(child);
    }
  }
  
  return result;
}
```

### 8. **Element Location & Clicking**

**Selectors** (in order of preference):
1. Enhanced CSS selector (id, name, data-testid, etc.)
2. XPath (if CSS fails)
3. Coordinate click (last resort)

**Stability checking**:
```typescript
async _waitForElementStability(element, timeout = 1000) {
  let lastRect = await element.boundingBox();
  
  while (Date.now() - startTime < timeout) {
    const currentRect = await element.boundingBox();
    
    // If position/size changed by >2px, it's still unstable
    if (Math.abs(lastRect.x - currentRect.x) > 2 ||
        Math.abs(lastRect.y - currentRect.y) > 2) {
      lastRect = currentRect;
      await sleep(50);
      continue;
    }
    
    // Stable for 50ms = ready to click
    return;
  }
}
```

## Comparison to browser-use & HyperAgent

| Aspect | nanobrowser | browser-use | HyperAgent |
|--------|------------|-------------|-----------|
| Visibility heuristic | Detailed (3 checks) | Simple (offsetWidth > 0) | Basic (element.visible) |
| Interactivity detection | Cursor style primary | Tag-based | A11y tree role-based |
| Highlight index | Sequential per page | Hash-based | Global ID + backendNodeId |
| Element refs | Index-based | Hash-based | ID (DOM-backed) |
| State tracking (`isNew`) | ✓ Page-to-page delta | ✗ Per-page only | ✗ Per-page only |

## Lessons for Our Library

### ✅ **Adopt**
1. **Multi-stage interactivity heuristic** — Prioritize cursor style, then form tags, then roles
2. **isTopElement** detection — Critical for overlays/popups
3. **Viewport expansion** — Allow configurable lookahead for lazy-load patterns
4. **Position tracking** — Include viewport vs. page coordinates
5. **State deltas** (`isNew`) — Track element lifecycle for multi-turn agents
6. **Stability waiting** — Don't click mid-animation

### ⚠️ **Reconsider**
1. **Event listener detection** — Unreliable in evaluate() context; rely on ARIA instead
2. **Highlight index** — Per-page ephemeral IDs require constant re-indexing; consider persistent IDs + fallback

### 🎯 **Implementation Notes**
- **Visibility checks should be cheap first** (layout dimensions) before expensive (elementFromPoint)
- **Nested interactive elements** need deduplication logic
- **Scrollable containers** need special handling (overflow:auto divs with children)
- **Cookie banners & overlay dialogs** often render outside normal DOM flow; may need explicit handling

## Files Reviewed

- `src/dom/views.ts` — DOMElementNode class + coordinate tracking
- `src/dom/service.ts` — DomService + DOM tree construction
- `src/browser/session.ts` — Session management + clicking/typing logic
- `src/browser/page.ts` — Page-level operations + DOM refresh
- `chrome-extension/public/buildDomTree.js` — Core visibility + interactivity logic
- `src/dom/dom_tree/index.js` — Element classification algorithms
- `src/agent/service.ts` → `multiAct()` — Multi-action execution pattern
- `docs/customize/browser-settings.mdx` — Configuration reference
