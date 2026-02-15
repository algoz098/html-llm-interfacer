# HyperAgent Research

**Repository**: hyperbrowserai/HyperAgent  
**Stars**: ~1,000  
**Language**: TypeScript  
**Focus**: LLM-driven browser automation via accessibility tree + CDP

## Overview

HyperAgent is a TypeScript-based agent framework built on Playwright/Puppeteer and Chrome DevTools Protocol. Unlike browser-use (Python) and LaVague (multi-engine), HyperAgent is **fully TypeScript** and emphasizes a **hybrid approach**: combining accessibility tree extraction with direct CDP for element interaction.

## Key Architecture Decisions

### 1. **Accessibility Tree (A11y) DOM Strategy**

**Location**: `src/context-providers/a11y-dom/`

HyperAgent builds a rich accessibility tree from:
- CDP's `Accessibility.getFullAXTree` for semantic structure
- CDP's `DOM.getDocument` for raw DOM traversal
- Virtual Node model with parent/child/frame relationships

**Data Model** (`types.ts`):
```typescript
export interface AccessibilityNode {
  role: string;
  name?: string;
  description?: string;
  value?: string;
  children?: AccessibilityNode[];
  childIds?: string[];
  parentId?: string;
  nodeId?: string;
  backendDOMNodeId?: number;
  properties?: Array<{
    name: string;
    value: { type: string; value?: string };
  }>;
  boundingBox?: DOMRect;
}
```

**Output**: Text-serialized accessibility tree sent to LLM (e.g., "button: Login"+index)

### 2. **Element Identification: Encoded IDs**

**Format**: `"frameIndex-backendNodeId"` (e.g., `"0-5125"`, `"1-42"`)

**Strategy**:
- **Frame Index** (0 = main, 1+ = iframe levels)
- **Backend Node ID** (CDP-assigned numeric ID, stable within session)
- No hash fallback like browser-use; relies on CDP mapping

**Maps Built** (`build-maps.ts`):
```typescript
{
  backendNodeMap: { "0-5125": 5125 },
  xpathMap: { "0-5125": "//button[@id='login']" },
  frameMap: Map { 0 => mainFrameInfo, 1 => iframeInfo }
}
```

**Resolution** (`element-resolver.ts`):
1. Parse frameIndex from encoded ID
2. Look up frame metadata (iframeBackendNodeId, frameId)
3. Get CDP session for that frame
4. Resolve backendNodeId to element reference

### 3. **LLM-Based Element Finding**

**Flow**:
```
User instruction: "click the login button"
     ↓
Serialize accessibility tree to text
     ↓
LLM with examineDom() → find matching element + action
     ↓
Return { elementId: "0-5125", method: "click", confidence: 0.95 }
     ↓
Verify element exists in xpathMap before execution
```

**Key Files**:
- `src/agent/examine-dom/index.ts` — Element finding via LLM
- `src/agent/examine-dom/prompts.ts` — System/user prompts, action instructions
- `src/agent/shared/find-element.ts` — Retry logic, DOM settling

**Smart retry**: If element not found, refetch A11y tree and retry (up to 10 attempts)

### 4. **Interactive Element Detection**

**Taxonomy** (from `collectInteractiveElements`):
- `button`, `link`, `textbox`, `searchbox`, `combobox`, `checkbox`, `tab`, `menuitem`

**Priority**: 
- Prioritize iframe elements over main frame (non-0 frames first)
- Limit to top 20 elements to keep LLM context small

### 5. **Action Execution via CDP**

**Location**: `src/cdp/interactions.ts`

**Available Actions**:
```typescript
type CDPActionMethod = 
  | "click" | "doubleClick" | "hover" 
  | "type" | "fill" | "press"
  | "check" | "uncheck"
  | "selectOptionFromDropdown"
  | "scrollToElement" | "scrollToPercentage"
  | "nextChunk" | "prevChunk";
```

**Example: Click**
```typescript
async function clickElement(ctx: CDPActionContext) {
  // 1. Scroll into view
  await session.send("DOM.scrollIntoViewIfNeeded", { backendNodeId });
  
  // 2. Get bounding box
  const { model } = await session.send("DOM.getBoxModel", { backendNodeId });
  
  // 3. Calculate center
  const x = (x1 + x3) / 2, y = (y1 + y3) / 2;
  
  // 4. Dispatch mouse events
  await session.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await session.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left" });
  await session.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left" });
}
```

### 6. **Frame + Shadow DOM Support**

**Approach**:
- Recursively process iframes via CDP `DOM.getDocument` on contentDocument
- Support shadow roots via `DOM.getChildNodes` on shadowRoots
- Assign frameIndex to each frame level (0 = main → 1 = first iframe → 2 = nested)

**Fallback**: If AX tree missing for iframe, create DOM fallback nodes from tag names

### 7. **Multiple Extraction Modes**

**Configuration**:
```typescript
type A11yDOMConfig {
  mode?: "a11y" | "hybrid" | "visual-debug";
  injectIdentifiers?: boolean;
  drawBoundingBoxes?: boolean;
  includeIgnored?: boolean;
}
```

- **a11y**: Pure text tree (fastest, for element finding)
- **hybrid**: Text tree + screenshot
- **visual-debug**: Text tree + DOM attributes + bounding boxes (for debugging)

## Comparison to browser-use

| Aspect | browser-use | HyperAgent |
|--------|-------------|-----------|
| **Language** | Python | TypeScript |
| **ID Strategy** | Session index + CDP backendId + multiple hashes | frameIndex + backendNodeId only |
| **Visibility** | Viewport threshold + paint order | Bounding box calculation during action |
| **Element Finding** | DOM traversal + filtering | LLM-based via accessibility tree |
| **Extraction** | Direct HTML → LLM | Accessibility tree → formatted text → LLM |
| **Frame Support** | Yes, with complex hashing | Yes, frameIndex-based |
| **Fallback** | Hash-based (SHA256) | XPath + CDP resolution |

## Comparison to BrowserGym

| Aspect | BrowserGym | HyperAgent |
|--------|-----------|-----------|
| **ID Persistence** | Global BID in DOM attribute | Session-local, ephemeral |
| **Visibility Detection** | IntersectionObserver (0.0–1.0 ratio) | Bounding box + scroll-into-view |
| **Extraction Steps** | Pre (mark) → Extract (CDP) → Post (cleanup) | Single pass: getA11yDOM |
| **Priority Elements** | Set of Marks (SOM) | Top N interactive roles |

## Lessons for Our Library

### ✅ **Adopt**
1. **LLM-based element finding**: Using accessibility tree + LLM is more robust than rule-based filtering
2. **Frame indexing**: Simple numeric frame indices (0, 1, 2...) are easier to manage than global strings
3. **ExamineDom pattern**: Separate LLM prompt for finding elements + suggested action is clean separation of concerns
4. **Multi-mode extraction**: Supporting "a11y-only" mode for pure text is efficient for LLM use cases

### ⚠️ **Reconsider**
1. **Action resolution complexity**: HyperAgent's CDP session management + frame context manager is intricate—worth simplifying if possible
2. **Only CDPActionMethod**: Coupling to Playwright's action set limits portability; consider generic action protocol
3. **Retry loop**: 10 retries on DOM settlement may be excessive; consider configurable limits

### 🎯 **Decision Point**
- **Should we adopt frameIndex-based IDs (like HyperAgent) or global persistent IDs (like BrowserGym)?**
  - HyperAgent: Simpler for single-session use, lower memory; requires re-extraction per navigation
  - BrowserGym: Persists across navigation, enables session replay; higher memory overhead

## Recommended Patterns (TypeScript)

```typescript
// Element Identifier
interface HyperElementId {
  frameIndex: number;
  backendNodeId: number;
  xpath?: string;
}

// Accessibility Node (simplified)
interface A11yNode {
  id: HyperElementId;
  role: string;
  name?: string;
  value?: string;
  children: A11yNode[];
}

// Extract A11y DOM
async function extractA11yDOM(
  page: Page,
  options?: { mode: 'a11y' | 'hybrid' | 'visual-debug' }
): Promise<{
  tree: A11yNode[];
  elementMap: Map<string, A11yNode>;
  xpathMap: Map<string, string>;
}> {
  // Build maps; traverse iframes recursively
  return { tree, elementMap, xpathMap };
}

// Find Element via LLM
async function findElementByInstruction(
  instruction: string,
  a11yState: A11yDOMState,
  llm: LLMClient
): Promise<{
  elementId: HyperElementId;
  action: string;
  confidence: number;
}> {
  // Format tree to text; call LLM; parse result
  const result = await llm.call(systemPrompt, userPrompt);
  return parseExamineDomResponse(result);
}

// Execute Action
async function executeAction(
  elementId: HyperElementId,
  action: string,
  args: Record<string, any>,
  page: Page
): Promise<void> {
  // Resolve element → session + backendNodeId
  // Send CDP commands
}
```

## Open Questions

1. **How to choose frame index at start of interaction?** HyperAgent assumes main frame (0); should we prompt LLM to specify frame, or auto-detect?
2. **Is "a11y-only" mode sufficient for all LLM interactions, or do we need visual feedback for complex UIs?**
3. **Should ID format be stable across LLM calls (like BrowserGym's BID), or ephemeral-per-session (like HyperAgent)?** This affects multi-turn interactions.

## Files Reviewed

- `src/context-providers/a11y-dom/**` — A11y tree extraction
- `src/agent/examine-dom/**` — LLM-based element finding
- `src/cdp/interactions.ts` — Action dispatching
- `src/cdp/element-resolver.ts` — ID resolution
- `docs/cdp-overview.md` — Architecture deep dive
