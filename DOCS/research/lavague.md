# LaVague Research

**Repository**: lavague-ai/LaVague  
**Stars**: ~6,200  
**Language**: Python (core), TypeScript (Chrome extension)  
**Focus**: Large Action Model (LAM) architecture with multi-engine orchestration

## Overview

LaVague takes a **high-level agentic approach** distinct from browser-use and HyperAgent. Rather than exposing raw element interactions, LaVague decompose the problem into two LLMs:
1. **World Model**: Understands current page state, decides *which engine* to use next
2. **Action Engine**: Generates specific actions (click, type, scroll) with XPath targets

This modular design allows swapping LLM backends and adding domain-specific engines (Navigation, Python, etc.).

## Key Architecture Decisions

### 1. **Two-LLM Orchestration**

**Flow**:
```
User objective
     ↓
World Model LLM
  → Analyzes screenshot + page state
  → Decides next engine (Navigation, Python, etc.)
  → Generates intermediate instruction
     ↓
Action Engine LLM (if Navigation chosen)
  → Receives HTML + XPath list
  → Generates click/setValue/etc. with specific XPath
  → Returns YAML action
     ↓
Driver executes action
     ↓
Repeat until objective complete
```

**Key Classes**:
- `WorldModel` (`world_model.py`) — High-level planning
- `ActionEngine` (`action_engine.py`) — Low-level action generation
- `WebAgent` (`agents.py`) — Orchestrates both

### 2. **XPath-Based Element Targeting**

**Strategy**: All elements identified by XPath string (not numeric indices)

**Example**:
```xml
/html/body/button[@id='login']
/html/body/div[5]/div/div/div/div/div[3]/div/main/div[2]/div/div[2]/div/div/div/div/div/div/div/div[2]/div/div/div/div/a
```

**Generation** (`retrievers.py`):
```typescript
function _generate_xpath(element, path="") {
  if (element.parent === null) return path;
  else {
    siblings = [sib for sib in element.parent.children if sib.name === element.name];
    if (len(siblings) > 1) {
      count = siblings.index(element) + 1;
      path = `/$(element.name)[$count]$path`;
    } else {
      path = `/$element.name$path`;
    }
    return _generate_xpath(element.parent, path);
  }
}
```

**Advantages**:
- Human-readable in logs
- Works cross-frame (XPath scoped by document)
- No mapping/resolution needed

**Drawbacks**:
- Brittle on DOM changes
- Long strings in prompt context
- Requires valid XPath syntax from LLM

### 3. **Retriever Pipeline System**

**Concept**: Extract actionable HTML snippets from page via composable retrievers

**Types**:
- `InteractiveXPathRetriever` — Find clickable/typeable elements
- `SyntaxicRetriever` — Split HTML by syntax (sections, lists)
- `XPathedChunkRetriever` — Add XPath attributes to chunks

**Execution** (`retrievers.py`):
```python
class RetrieversPipeline:
    def __init__(self, *retrievers):
        self.retrievers = retrievers
    
    def retrieve(self, html):
        result = html
        for retriever in self.retrievers:
            result = retriever.retrieve(result)
        return result
```

**Example Output** (marked HTML):
```html
<button xpath="/html/body/button[1]">Login</button>
<input xpath="/html/body/input[1]" placeholder="Email"/>
```

**Key Retriever: InteractiveXPathRetriever**
```python
def get_possible_interactions(self, in_viewport=True, foreground_only=True):
    # Returns { xpath: set(['CLICK', 'TYPE', 'SCROLL']) } for each element
    # Filters by visibility, foreground check
```

### 4. **Action Engine LLM Prompt Design**

**Prompt Template** (`base.py`):
```python
REMOTE_PROMPT_TEMPLATE = """
You are a chrome extension and your goal is to interact with web pages.
You have been given a series of HTML snippets and queries.
Your goal is to return a list of actions that should be done in order to execute the actions.
Always target elements by XPATH. You can only use one of the Xpaths included in the HTML.
Do not derive new Xpaths.
"""
```

**Constraints**:
- Only use provided XPaths (prevent hallucination)
- Return YAML structure with action name + xpath + optional value

**Supported Actions** (`actionSchemas.ts`):
- `click` → `{ name: "click", args: { xpath } }`
- `setValue` → `{ name: "setValue", args: { xpath, value } }`
- `setValueAndEnter` → `{ name: "setValueAndEnter", args: { xpath, value } }`
- `dropdownSelect` → `{ name: "dropdownSelect", args: { xpath, value } }`
- `scroll` → `{ name: "scroll", args: { value: "up"|"down"|"top"|"bottom" } }`
- `wait` → `{ name: "wait", args: { value: seconds } }`
- `fail` → Indicate task cannot complete

### 5. **Chrome Extension Driver**

**Architecture**: Remote browser control via Chrome extension

**Location**: `extension_chrome/src/`

**Communication**:
- Backend (Python) sends commands to extension
- Extension executes in browser, returns screenshots + results
- Backend processes, makes LLM decisions

**DomActions** (`domactions.ts`):
```typescript
export class DomActions {
  async clickwithXPath(xpath: string): Promise<boolean>;
  async setValueWithXPATH(xpath: string, value: string): Promise<boolean>;
  async pressEnter(xpath: string): Promise<boolean>;
  async highlight_elem(xpath: string): Promise<boundingBox>;
  async get_possible_interactions(args: string): Promise<xpathMap>;
}
```

**Example Execution**:
```typescript
export async function clickWithXPath(domActions: DomActions, xpath: string) {
  const element = document.evaluate(xpath, document, null, 
    XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  if (element instanceof HTMLElement) {
    element.click();
    return true;
  }
  return false;
}
```

### 6. **Multi-Modal World Model**

**Input**: 
- Screenshot (visual state)
- Vision LLM (multi-modal like GPT-4V or Idefics)
- Structured instructions from previous step

**Output**:
```
Current state: [SCREENSHOT]
Previous instructions: [list of actions taken]

Analysis:
- I am on the Hugging Face website
- The search bar is visible in the top right
- Next step: use search to find the desired model

Next engine: Navigation Engine
Instruction: Type 'Meta-Llama-3-8B' on the search bar with placeholder "Search ..."
```

**Design**: Vision + text reasoning → More robust than text-only LLM

### 7. **Token Counting & Cost Tracking**

**Metrics Tracked** (`token_counter.py`):
- `world_model_input_tokens`, `world_model_output_tokens`
- `action_engine_input_tokens`, `action_engine_output_tokens`
- `total_embedding_tokens` (if semantic retriever used)
- `total_step_tokens` (one complete step of agent)

**Example Cost**:
- World Model: 3,145 input + 79 output = $0.02
- Action Engine: 6,279 input + 88 output = $0.03
- Total: $0.05 per step

## Comparison to browser-use

| Aspect | browser-use | LaVague |
|--------|-------------|---------|
| **Architecture** | Single agent + DOM tree | World Model + Action Engine |
| **Element ID** | Numeric index (0, 1, 2...) | XPath string |
| **LLM Calls** | 1 per action | 2 per step (World + Action) |
| **Retriever** | None (full HTML optional) | Customizable pipeline |
| **Extension** | None | Full Chrome extension |
| **Observability** | Logs | Multi-modal (screenshot + parsed) |

## Comparison to HyperAgent

| Aspect | HyperAgent | LaVague |
|--------|-----------|---------|
| **Architecture** | Examine-Dom + Execute | World Model + Action Engine |
| **ID Type** | frameIndex-backendNodeId | XPath |
| **Frame Support** | Native (A11y tree) | XPath scoped (implicit) |
| **Visual Grounding** | No (text-only) | Yes (multi-modal LLM) |
| **Extensibility** | Hard-coded actions | Pluggable engines |

## Lessons for Our Library

### ✅ **Adopt**
1. **XPath targets**: Simple, human-readable, no mapping needed
2. **Isolated element extraction**: Separate retriever concern from interaction
3. **Constraint-based prompting**: "Only use provided XPaths" prevents hallucination
4. **Multi-modal grounding**: Vision + text = stronger state understanding
5. **Modular engines**: Action Engine pattern is reusable for other actions

### ⚠️ **Reconsider**
1. **XPath brittleness**: DOM changes break all XPaths; consider hybrid ID (XPath + fallback hash)
2. **Two-LLM cost**: World Model + Action Engine doubles token usage; may be expensive at scale
3. **Extension dependency**: Chrome extension adds deployment complexity; browser API may be simpler
4. **No frame indexing**: XPath scoping works but is implicit; explicit frame tracking (like HyperAgent) clearer

### 🎯 **Decision Point**
- **Should we support XPath-only IDs, or hybrid (XPath + index + hash)?**
  - XPath-only: Simple, Web Standard, LLM-friendly
  - Hybrid: Resilient to DOM changes, enables fallback resolution

## Recommended Patterns (Python-like TypeScript)

```typescript
// XPath-based Element ID
type ElementXPath = string; // "/html/body/button[1]"

// Retriever abstraction
interface HTMLRetriever {
  retrieve(html: string): string;
}

class InteractiveXPathRetriever implements HTMLRetriever {
  retrieve(html: string): string {
    // Find interactive elements, annotate with xpath
    return htmlWithXPathAnnotations;
  }
}

class RetrieverPipeline {
  constructor(private retrievers: HTMLRetriever[]) {}
  
  retrieve(html: string): string {
    return this.retrievers.reduce((acc, r) => r.retrieve(acc), html);
  }
}

// Action Schema (matches LaVague)
type Action = 
  | { type: 'click'; xpath: string }
  | { type: 'setValue'; xpath: string; value: string }
  | { type: 'scroll'; direction: 'up' | 'down' }
  | { type: 'fail'; reason?: string };

// World Model (high-level)
async function worldModel(
  screenshot: Buffer,
  html: string,
  objective: string,
  history: string[]
): Promise<{
  analysis: string;
  nextEngine: 'Navigation' | 'Python' | 'Wait';
  instruction: string;
}> {
  // Vision LLM analyzes page
  // Decides next step
  return { analysis, nextEngine, instruction };
}

// Action Engine (low-level)
async function actionEngine(
  html: string,
  instruction: string,
  llm: LLMClient
): Promise<Action[]> {
  // Retriever extracts interactive elements
  const annotatedHtml = retriever.retrieve(html);
  
  // LLM generates action with constraint: "Only use provided XPaths"
  const response = await llm.call(systemPrompt, userPrompt);
  
  // Parse YAML → Action[]
  return parseActions(response);
}

// Driver execution
async function executeActions(
  actions: Action[],
  driver: WebDriver
): Promise<void> {
  for (const action of actions) {
    switch (action.type) {
      case 'click':
        await driver.click(action.xpath);
        break;
      case 'setValue':
        await driver.setValue(action.xpath, action.value);
        break;
      case 'scroll':
        await driver.scroll(action.direction);
        break;
    }
  }
}
```

## Open Questions

1. **Cost vs. quality**: Is World Model necessary, or can we skip it and go Action Engine → Browser → repeat?
2. **XPath resilience**: Should we generate XPath + fallback identifiers (numeric index, CSS selector) in HTML annotation?
3. **Single vs. multiple LLMs**: Should World Model and Action Engine use same LLM (cost) or different (quality)?

## Files Reviewed

- `lavague-core/lavague/core/world_model.py` — High-level planning
- `lavague-core/lavague/core/action_engine.py` — Action generation
- `lavague-core/lavague/core/retrievers.py` — HTML annotation pipeline
- `extension_chrome/src/domactions.ts` — Browser interaction
- `docs/module-guides/action-engine.md` — Action engine guide
- `examples/` — Usage examples
