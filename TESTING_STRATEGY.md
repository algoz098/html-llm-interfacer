# 🧪 Phase 1 - Test Strategy & Coverage

## Status
**Test Suite Created:** ✅  
**Implementation Status:** ⏳ Ready for TDD implementation  
**Total Test Files:** 3  
**Total Test Cases:** 100+  
**Lines of Test Code:** 1000+

---

## 📋 Test Structure

### 1. Unit Tests: DOM Builder (`tests/unit/dom-builder.test.ts`)

**Purpose:** Validate element detection heuristics  
**Lines:** 350+  
**Test Cases:** 35+

#### Coverage Areas:

1. **Form Tag Detection (Stage 1)**
   - ✅ `<button>`, `<a>`, `<input>`, `<select>`, `<textarea>`
   - ✅ Disabled state handling
   - ✅ Multi-signal detection

2. **CSS Cursor Detection (Stage 2)**
   - ✅ `cursor: pointer`
   - ✅ Hand cursor variants
   - ✅ Default cursor (negative test)

3. **ARIA Role Detection (Stage 3)**
   - ✅ `role="button"`, `role="link"`, `role="tab"`, `role="menuitem"`
   - ✅ Non-interactive roles (negative test)

4. **Multi-Stage Combination**
   - ✅ Combining multiple positive signals
   - ✅ Edge cases (span with role=button)

5. **Visibility Detection (3-Point Sampling)**
   - ✅ Visible elements
   - ✅ `display: none`
   - ✅ `opacity: 0`
   - ✅ Off-screen elements
   - ✅ Hidden behind overlays

6. **XPath Generation**
   - ✅ XPath with ID attributes
   - ✅ XPath fallback without ID
   - ✅ XPath with text content
   - ✅ Class selector XPath

7. **Coordinate Calculation**
   - ✅ Center coordinate calculation
   - ✅ Viewport vs page coordinates
   - ✅ Bounding rect handling

8. **DOM Tree Building**
   - ✅ Tree from document
   - ✅ Unique element indices
   - ✅ Interactive element marking
   - ✅ Complete XPath assignment
   - ✅ Viewport coordinate calculation
   - ✅ Element limit option
   - ✅ Selector filtering

9. **Performance**
   - ✅ `< 300ms` for `< 5000` elements
   - ✅ No memory leaks with large DOMs

10. **Edge Cases**
    - ✅ Null elements
    - ✅ Elements with no bounding rect
    - ✅ Shadow DOM elements (TBD)
    - ✅ iframes (TBD)

**Target Accuracy:** 88%+ on element detection

---

### 2. Unit Tests: Action Executors (`tests/unit/action-executors.test.ts`)

**Purpose:** Validate action execution with fallback chain  
**Lines:** 400+  
**Test Cases:** 50+

#### Coverage Areas:

1. **ClickAction - Selector Fallback (Level 1)**
   - ✅ Click by CSS selector
   - ✅ Selector not found handling
   - ✅ Compound selectors
   - ✅ Disabled button handling

2. **ClickAction - XPath Fallback (Level 2)**
   - ✅ Click by XPath
   - ✅ XPath with text content
   - ✅ Position predicates (e.g., `[2]`)
   - ✅ XPath syntax validation

3. **ClickAction - Coordinate Fallback (Level 3)**
   - ✅ Click by coordinates
   - ✅ Off-screen coordinate handling
   - ✅ Viewport boundary respect

4. **ClickAction - Fallback Chain**
   - ✅ Try XPath if selector fails
   - ✅ Try coordinates if both fail
   - ✅ Report when all fallbacks exhausted
   - ✅ Track which fallback succeeded

5. **ClickAction - Event Handling**
   - ✅ Trigger mousedown event
   - ✅ Trigger mouseup event
   - ✅ Trigger click event

6. **ClickAction - Edge Cases**
   - ✅ Rapid consecutive clicks
   - ✅ Element removed during click
   - ✅ Opacity: 0 elements

7. **ClickAction - ActionResult**
   - ✅ Success with message
   - ✅ Confidence score (0-1)
   - ✅ Error details on failure

8. **TypeAction**
   - ✅ Type text into input field
   - ✅ Support fallback chain
   - ✅ Clear field before typing
   - ✅ Handle textarea
   - ✅ Trigger input and change events

9. **SelectAction**
   - ✅ Select by value
   - ✅ Select by text content
   - ✅ Support fallback selection
   - ✅ Trigger change event

**Target Success Rate:** 95%+ on action execution

---

### 3. Integration Tests: SmartBrowser (`tests/integration/smart-browser.test.ts`)

**Purpose:** Validate end-to-end workflow  
**Lines:** 400+  
**Test Cases:** 50+

#### Coverage Areas:

1. **Initialization**
   - ✅ Initialize with config
   - ✅ Create browser session
   - ✅ Default config values

2. **Navigation**
   - ✅ Navigate to URL
   - ✅ Update URL in session
   - ✅ Error handling for invalid URLs
   - ✅ Wait for page load

3. **DOM Building (Integration)**
   - ✅ Build DOM tree after navigation
   - ✅ Detect interactive elements
   - ✅ Assign unique indices
   - ✅ Generate XPath for all elements
   - ✅ Include coordinates for all elements
   - ✅ Respect element limits
   - ✅ Rebuild with page changes

4. **Action Execution (Integration)**
   - ✅ Execute click action
   - ✅ Execute type action
   - ✅ Execute select action
   - ✅ Return ActionResult with metadata
   - ✅ Handle non-existent element errors

5. **Session Management**
   - ✅ Track session state
   - ✅ Maintain action history
   - ✅ Track DOM tree progression
   - ✅ Provide previous DOM state
   - ✅ Handle sequential interactions

6. **Performance (Integration)**
   - ✅ Build DOM tree in reasonable time
   - ✅ Execute action quickly with XPath

7. **Error Handling**
   - ✅ Navigation timeout handling
   - ✅ Recovery from action failures
   - ✅ Meaningful error messages

8. **Cleanup**
   - ✅ Close browser properly
   - ✅ Handle multiple close calls
   - ✅ Clear session on close

9. **Real-World Scenarios**
   - ✅ Simple form submission
   - ✅ Navigation flows

---

## 🎯 Test Implementation Strategy (TDD)

### Phase 1 Implementation Order:

```
Step 1: Create DOMBuilder stub
        └─ Implement methods one by one
           └─ Test each heuristic signal
              └─ Fine-tune accuracy to 88%+

Step 2: Create Action Executors
        └─ Implement each action class
           └─ Test fallback chain
              └─ Achieve 95%+ success rate

Step 3: Integrate SmartBrowser
        └─ Wire up DOMBuilder + Actions
           └─ Test end-to-end flows
              └─ Validate session management

Step 4: Optimize Performance
        └─ Benchmark DOM build time
           └─ Profile memory usage
              └─ Optimize hot paths
```

### Running Tests During Development:

```bash
# Watch mode (rerun on file changes)
npm run test:watch

# Specific test file
npm run test -- dom-builder.test.ts

# With coverage report
npm run test -- --coverage

# Run integration tests only
npm run test -- --testPathPattern=integration

# Run unit tests only
npm run test -- --testPathPattern=unit
```

---

## 📊 Coverage Goals

| Category | Current | Target | Notes |
|----------|---------|--------|-------|
| **Unit Tests** | 35+ | 40+ | DOMBuilder heuristics |
| **Action Tests** | 50+ | 55+ | All fallback paths |
| **Integration Tests** | 50+ | 60+ | End-to-end flows |
| **Line Coverage** | TBD | 80%+ | After implementation |
| **Branch Coverage** | TBD | 75%+ | Fallback chains |
| **Function Coverage** | TBD | 90%+ | All public methods |
| **Statement Coverage** | TBD | 80%+ | Core logic only |

---

## 🏆 Quality Metrics (Phase 1)

### Accuracy Targets:

| Metric | Target | Current | Reference |
|--------|--------|---------|-----------|
| **Element Detection** | 88%+ | TBD | nanobrowser: 88% |
| **Action Success (Selector)** | 85%+ | TBD | browserable: 85% |
| **Action Success (XPath)** | 92%+ | TBD | browserable: 92% |
| **Action Success (Vision)** | 96%+ | TBD | browserable: 96% |
| **Fallback Recovery** | 95%+ | TBD | Combined chain |

### Performance Targets:

| Metric | Target | Reference |
|--------|--------|-----------|
| **DOM Build Time (<5k els)** | <300ms | nanobrowser: 100-200ms |
| **Action Execution** | <200ms | browserable: 50-200ms |
| **Selector Success Rate** | 85%+ | Real-world data |
| **Memory Usage** | <100MB overhead| nanobrowser pattern |

---

## 🚀 Test Execution Checklist

Before moving to Phase 2, verify:

- [ ] All 35+ DOMBuilder tests passing
- [ ] All 50+ Action tests passing  
- [ ] All 50+ Integration tests passing
- [ ] No memory leaks detected
- [ ] Performance benchmarks met
- [ ] Error handling coverage complete
- [ ] Real-world scenarios tested
- [ ] Code coverage > 80%
- [ ] All edge cases handled
- [ ] Documentation updated

---

## 📝 Test File Map

```
tests/
├── unit/
│   ├── dom-builder.test.ts          [350+ lines, 35+ cases]
│   └── action-executors.test.ts     [400+ lines, 50+ cases]
└── integration/
    └── smart-browser.test.ts        [400+ lines, 50+ cases]
```

**Total:** 1150+ lines of test code covering 135+ scenarios

---

## 🔍 Next Steps

1. **Implement DOMBuilder** (`src/core/dom-builder.ts`)
   - Start with `isInteractive()` method
   - Work through unit tests one by one
   - Achieve 88%+ accuracy

2. **Implement ActionExecutors** (`src/actions/`)
   - `ClickAction` with fallback chain
   - `TypeAction` with event triggers
   - `SelectAction` for form controls

3. **Integrate SmartBrowser** (`src/adapters/smart-browser.ts`)
   - Wire up `buildDOMTree()`
   - Wire up `executeAction()`
   - Implement session management

4. **Run Full Test Suite**
   - `npm run test`
   - Verify all tests passing
   - Generate coverage report

5. **Benchmark Real Pages**
   - Test on Wikipedia (small)
   - Test on Amazon (medium)
   - Test on GitHub (large)

---

## 📞 Reference

- **Test philosophy:** Test-Driven Development (TDD)
- **Framework:** Jest with ts-jest
- **Strategy:** Bottom-up (unit → integration)
- **Coverage:** Comprehensive with edge cases
- **Performance:** Benchmarked against research data

---

**Status:** ✅ Test suite ready for implementation  
**Next:** Implement src/core/dom-builder.ts to pass unit tests  
**Estimated Time:** 5-10 hours to pass all tests

