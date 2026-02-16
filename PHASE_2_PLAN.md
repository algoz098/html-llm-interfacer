# 🏗️ PHASE 2: ROBUSTNESS - IMPLEMENTATION PLAN

## 🎯 Goal
Make the automation engine resilient to dynamic content changes (animations, layout shifts) and support complex page structures (iframes).

---

## 📋 Tasks

### 1. Stability Waiting
**Problem:** Interactions fail when elements are moving or animating.
**Solution:** Wait for element bounding box to stabilize before interacting.

**Implementation:**
- [x] Add `waitForStability(xpath: string, timeout?: number): Promise<void>` to `BrowserDriver` interface.
- [x] Implement `waitForStability` in `PuppeteerDriver`:
  - Loop with short delay (e.g., 50ms).
  - Compare `getBoundingClientRect` positions.
  - Return when delta < threshold (e.g., 2px) for N consecutive checks.
- [x] Update `ClickAction`, `TypeAction`, `SelectAction` to call `waitForStability` before action.
- [x] Create `tests/integration/stability.test.ts` to simulate moving element.

### 2. Frame Support
**Problem:** Elements inside `<iframe>` are invisible to `DOMBuilder` running in the main context.
**Solution:** Iterate over all frames and build a composite DOM tree.

**Implementation:**
- [x] Update `DOMElement` interface in `src/types/index.ts` to include `frameId` (string or number).
- [x] Update `SmartBrowser.buildDOMTree` in `src/adapters/smart-browser.ts`:
  - Get all frames via `driver.getFrames()` (need to add this).
  - Iterate frames and inject `DOMBuilder` into each.
  - Collect elements and tag them with `frameId`.
  - Handle cross-origin frames by using `frame.evaluate()`.
- [x] Update `BrowserDriver` methods (`clickXPath`, `typeXPath`, etc.) to accept `frameId` or context.
- [x] Update `ActionExecutors` to pass `frameId` from `DOMElement` to driver.
- [x] Create `tests/integration/frames.test.ts` with an iframe fixture.

---

## 🧪 Testing Strategy

### Stability Test
1. Create a page with a button that moves every 100ms.
2. Attempt to click it without stability check (should fail or be flaky).
3. Attempt to click it with stability check (should succeed).

### Frame Test
1. Create a page with an iframe containing a button.
2. `DOMBuilder` should find the button inside the iframe.
3. `ClickAction` should click the button inside the iframe.

---

## 📚 References
- [browsernode.md](./DOCS/research/browsernode.md) - Frame navigation patterns.
- [agents.md](./agents.md) - Phase 2 requirements.
