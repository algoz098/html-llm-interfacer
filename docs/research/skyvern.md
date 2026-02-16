# Skyvern Research

**Repository**: skyvern-ai/skyvern  
**Language**: Python  
**Focus**: AI-powered action taxonomy + element locator abstraction + LLM-driven action execution

## Overview

Skyvern is a **Python-based AI automation framework** emphasizing **structured action types** and **LLM-driven decision-making**. Key innovation: Comprehensive action taxonomy (`ActionType` enum) with semantic understanding of form inputs and select elements.

## Architecture

### 1. **Action Type Taxonomy**

**Location**: `src/action/actions.py`

```python
from enum import Enum

class ActionType(Enum):
    """Complete taxonomy of web automation actions"""
    
    # Navigation
    NAVIGATE = "navigate"          # Navigate to URL
    GO_BACK = "go_back"
    GO_FORWARD = "go_forward"
    REFRESH = "refresh"
    
    # Interaction
    CLICK = "click"                # Click element
    INPUT_TEXT = "input_text"      # Type in input field
    SELECT = "select"              # Select dropdown option
    UPLOAD_FILE = "upload_file"    # Upload file
    
    # Advanced Interaction
    HOVER = "hover"                # Mouse over element
    SCROLL = "scroll"              # Scroll page
    DRAG_AND_DROP = "drag_and_drop"  # Drag element
    
    # Form/Checkbox
    CHECK = "check"                # Check checkbox
    UNCHECK = "uncheck"            # Uncheck checkbox
    
    # Wait/Observe
    WAIT = "wait"                  # Wait for condition
    EXTRACT = "extract"            # Extract data from page
    
    # Special
    HOVER_OVER_ELEMENT = "hover_over_element"
    SCROLL_TO = "scroll_to"
    KEYPRESS = "keypress"          # Press keyboard key
```

**Per-Action Context**:
```python
@dataclass
class ActionInput:
    """Structured input for each action type"""
    action_type: ActionType
    locator: Optional[Locator]      # Element to interact with
    text: Optional[str]             # For INPUT_TEXT
    value: Optional[str]            # For SELECT
    file_path: Optional[str]        # For UPLOAD_FILE
    key: Optional[str]              # For KEYPRESS
    coordinate: Optional[Tuple[int, int]] = None  # Fallback for CLICK
    wait_time: Optional[int] = None # For WAIT

@dataclass
class ActionResult:
    action_type: ActionType
    success: bool
    message: str
    new_state: Optional[PageState] = None
    error: Optional[str] = None
    confidence: float = 1.0
```

### 2. **Element Locator Abstraction**

**SkyvernElement Wrapper**:
```python
class SkyvernElement:
    """Wrapper around Locator providing unified interaction API"""
    
    def __init__(self, locator: Locator, context: ElementContext):
        self.locator = locator
        self.context = context  # Semantic context
    
    async def click(self):
        """Click element (with automatic retries)"""
        try:
            await self.locator.click(timeout=5000)
            return True
        except Exception:
            # Fallback: coordinate click
            box = await self.locator.bounding_box()
            if box:
                await self.page.mouse.click(box['x'] + box['width']/2,
                                            box['y'] + box['height']/2)
                return True
            return False
    
    async def fill(self, text: str):
        """Type text into input"""
        # Clear first
        await self.locator.fill('')
        # Type with delay for frameworks
        await self.locator.type(text, delay=50)
        # Trigger change event
        await self.locator.evaluate('el => el.dispatchEvent(new Event("change", {bubbles: true}))')
    
    async def select_option(self, value: str):
        """Select dropdown option"""
        await self.locator.select_option(value)
    
    async def upload_file(self, file_path: str):
        """Upload file via input[type=file]"""
        await self.locator.set_input_files(file_path)
    
    async def extract_text(self) -> str:
        """Get element text content"""
        return await self.locator.text_content()
    
    @property
    def xpath(self) -> str:
        """Get XPath for fallback reference"""
        return self.context.xpath
    
    @property
    def semantic_role(self) -> str:
        """Get semantic role (e.g., 'submit button', 'email input')"""
        return self.context.semantic_role
```

**ElementContext (Semantic Information)**:
```python
@dataclass
class ElementContext:
    """Semantic information about an element"""
    xpath: str
    tag_name: str
    text: str
    attributes: Dict[str, str]
    
    # Semantic fields
    semantic_role: str  # 'button', 'input', 'checkbox', etc.
    semantic_label: str # Associated label if any
    placeholder: Optional[str]
    aria_label: Optional[str]
    
    # Input-specific
    input_type: Optional[str]       # 'email', 'password', 'text'
    input_name: Optional[str]
    
    # Select-specific
    select_options: Optional[List[str]]  # Available options
    
    # Interactivity
    is_visible: bool
    is_enabled: bool

class InputOrSelectContext:
    """Special context for input/select elements"""
    
    def analyze_input(element: SkyvernElement) -> InputOrSelectContext:
        """Determine semantic purpose of input field"""
        
        label = extract_associated_label(element)
        
        # Heuristics for semantic understanding
        if 'email' in label.lower() or element.input_type == 'email':
            return InputOrSelectContext(type='email', hint='expects email format')
        
        if 'password' in label.lower():
            return InputOrSelectContext(type='password', hint='security field')
        
        if 'search' in label.lower() or element.placeholder == 'Search...':
            return InputOrSelectContext(type='search', hint='search input')
        
        if 'phone' in label.lower():
            return InputOrSelectContext(type='phone', hint='expects phone number')
        
        return InputOrSelectContext(type='text', hint=f'input field: {label}')
```

### 3. **Action Execution Handler**

**Location**: `src/handler.py`

```python
class ActionHandler:
    
    async def handle_action(self, action: ActionInput) -> ActionResult:
        """Execute action with type-specific logic"""
        
        try:
            if action.action_type == ActionType.CLICK:
                return await self._handle_click(action)
            
            elif action.action_type == ActionType.INPUT_TEXT:
                return await self._handle_input_text(action)
            
            elif action.action_type == ActionType.SELECT:
                return await self._handle_select(action)
            
            elif action.action_type == ActionType.EXTRACT:
                return await self._handle_extract(action)
            
            # ... other action types
            
            else:
                return ActionResult(
                    action_type=action.action_type,
                    success=False,
                    error=f'Unknown action type: {action.action_type}'
                )
        
        except Exception as e:
            return ActionResult(
                action_type=action.action_type,
                success=False,
                error=str(e)
            )
    
    async def _handle_click(self, action: ActionInput) -> ActionResult:
        """Click action with auto-scroll + retry"""
        
        element = action.locator
        
        # Auto-scroll to element
        box = await element.bounding_box()
        if box and (box['y'] < 0 or box['y'] > 720):
            await element.scroll_into_view()
            await asyncio.sleep(0.5)  # Wait for scroll animation
        
        # Click with retry
        for attempt in range(3):
            try:
                await element.click(timeout=5000)
                return ActionResult(
                    action_type=ActionType.CLICK,
                    success=True,
                    message=f'Clicked element: {action.locator.xpath}'
                )
            except Exception as e:
                if attempt < 2:
                    await asyncio.sleep(0.5)
                    continue
                
                # Final fallback: coordinate click
                box = await element.bounding_box()
                if box:
                    await self.page.mouse.click(
                        box['x'] + box['width'] / 2,
                        box['y'] + box['height'] / 2
                    )
                    return ActionResult(
                        action_type=ActionType.CLICK,
                        success=True,
                        message=f'Clicked via coordinates at ({box["x"]}, {box["y"]})'
                    )
        
        return ActionResult(
            action_type=ActionType.CLICK,
            success=False,
            error='Failed to click element'
        )
    
    async def _handle_input_text(self, action: ActionInput) -> ActionResult:
        """Type into input field with context awareness"""
        
        element = action.locator
        
        # Analyze input context
        context = InputOrSelectContext.analyze_input(element)
        
        # Clear field
        await element.fill('')
        
        # Type with framework-aware delays
        if context.type == 'password':
            delay = 100  # Slower for password fields
        else:
            delay = 20
        
        await element.type(action.text, delay=delay)
        
        # Special handling: email input
        if context.type == 'email' and not '@' in action.text:
            return ActionResult(
                action_type=ActionType.INPUT_TEXT,
                success=False,
                error='Invalid email format',
                confidence=0.5
            )
        
        return ActionResult(
            action_type=ActionType.INPUT_TEXT,
            success=True,
            message=f'Typed into {context.type} field'
        )
    
    async def _handle_select(self, action: ActionInput) -> ActionResult:
        """Select from dropdown"""
        
        element = action.locator
        
        # Get available options
        options = await element.evaluate('el => Array.from(el.options || []).map(o => o.value)')
        
        if action.value not in options:
            return ActionResult(
                action_type=ActionType.SELECT,
                success=False,
                error=f'Option "{action.value}" not available',
                message=f'Available options: {options}'
            )
        
        await element.select_option(action.value)
        
        return ActionResult(
            action_type=ActionType.SELECT,
            success=True,
            message=f'Selected "{action.value}"'
        )
    
    async def _handle_extract(self, action: ActionInput) -> ActionResult:
        """Extract structured data"""
        
        # Use XPath to extract
        xpath = action.locator.xpath if action.locator else action.coordinate
        
        extracted = await self.page.evaluate(f"""
            () => {{
                const elements = document.evaluate(
                    '{xpath}',
                    document,
                    null,
                    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                    null
                );
                
                const results = [];
                for (let i = 0; i < elements.snapshotLength; i++) {{
                    const el = elements.snapshotItem(i);
                    results.push({{
                        text: el.innerText,
                        html: el.innerHTML,
                        attributes: Object.fromEntries(
                            Array.from(el.attributes).map(a => [a.name, a.value])
                        )
                    }});
                }}
                return results;
            }}
        """)
        
        return ActionResult(
            action_type=ActionType.EXTRACT,
            success=True,
            message=f'Extracted {len(extracted)} elements',
            data=extracted
        )
```

### 4. **LLM Prompts for Action Decision**

**Location**: `src/prompts/`

**Extract Action Prompt** (`extract-action-full.j2`):
```jinja
You are an AI web automation assistant. Given a task and the current page state, decide the next action to take.

OBJECTIVE: {{ objective }}

CURRENT PAGE:
- URL: {{ url }}
- Title: {{ title }}

AVAILABLE ELEMENTS:
{{ elements_json }}

RECENT ACTIONS:
{% for action in action_history[-5:] %}
- {{ action.action_type }}: {{ action.message }}
{% endfor %}

ACTION TYPES:
1. click — Click on element
2. input_text — Type into input field
3. select — Choose dropdown option
4. navigate — Go to URL
5. extract — Extract data using XPath
6. wait — Wait for condition
7. scroll — Scroll page

RESPOND WITH JSON:
{
  "action_type": "click|input_text|select|navigate|extract|wait|scroll",
  "xpath": "/path/to/element",  (or null if not needed)
  "text": "...",                  (for input_text)
  "value": "...",                (for select)
  "reasoning": "..."
}
```

**Single Action Prompt** (`single-action.j2`):
```jinja
The user wants you to {{ action_description }}.

Current page state:
{{ page_state }}

Which element should you interact with? Response format:
{
  "element_xpath": "//*[@id='submit-btn']",
  "confidence": 0.95,
  "alternatives": ["//*[contains(text(), 'Submit')]"]
}
```

### 5. **DOM Extraction & Element Finding**

**Location**: `src/dom.py`

```python
class DOMExtractor:
    """Extract DOM tree with element indices"""
    
    async def extract_dom(self, page: Page) -> List[SkyvernElement]:
        """Extract all interactive elements"""
        
        dom_json = await page.evaluate("""
            () => {
                const elements = [];
                
                function traverse(node, depth = 0, parentXPath = '') {
                    if (node.nodeType !== 1) return;  // Skip non-elements
                    
                    const tag = node.tagName.toLowerCase();
                    const xpath = describeXPath(node, parentXPath);
                    
                    // Determine if interactive
                    const isInteractive = isInteractiveElement(node);
                    
                    if (isInteractive) {
                        elements.push({
                            index: elements.length,
                            tagName: tag,
                            xpath: xpath,
                            text: node.innerText?.substring(0, 100),
                            attributes: {
                                id: node.id,
                                class: node.className,
                                name: node.name,
                                'data-testid': node.getAttribute('data-testid'),
                                role: node.getAttribute('role'),
                                'aria-label': node.getAttribute('aria-label')
                            },
                            isVisible: isElementVisible(node),
                            box: node.getBoundingClientRect()
                        });
                    }
                    
                    // Traverse children
                    for (const child of node.children) {
                        traverse(child, depth + 1, xpath);
                    }
                }
                
                traverse(document.documentElement);
                return elements;
            }
        """)
        
        return [SkyvernElement(d['xpath'], ElementContext.from_dict(d)) 
                for d in dom_json]
```

### 6. **Multi-Step Action Parsing**

```python
class ActionSequencer:
    """Parse complex objectives into action sequences"""
    
    async def sequence_actions(
        self,
        objective: str,
        current_state: PageState,
        llm_client  # Claude or GPT-4
    ) -> List[ActionInput]:
        """Break objective into steps"""
        
        prompt = f"""
        Objective: {objective}
        Current URL: {current_state.url}
        Current page elements: {current_state.elements_summary}
        
        Break this objective into a sequence of actions.
        
        Response format:
        [
            {{"step": 1, "action": "navigate", "params": {{"url": "..."}}}},
            {{"step": 2, "action": "input_text", "params": {{"xpath": "...", "text": "..."}}}}
        ]
        """
        
        response = await llm_client.completion(prompt)
        actions_json = json.loads(response)
        
        return [ActionInput.from_dict(a) for a in actions_json]
```

## Action Coordination Example

```python
async def orchestrate_form_submission(browser, form_objective):
    """Example: Fill and submit a form with multi-action coordination"""
    
    page = browser.page
    handler = ActionHandler(page)
    
    # Step 1: Extract form fields
    extract_action = ActionInput(
        action_type=ActionType.EXTRACT,
        locator=None,
        coordinate="//form"
    )
    extract_result = await handler.handle_action(extract_action)
    form_fields = extract_result.data
    
    # Step 2: Fill each field (requires DOM navigation)
    for field in form_fields:
        if field['type'] == 'email':
            action = ActionInput(
                action_type=ActionType.INPUT_TEXT,
                locator=SkyvernElement(field['xpath'], ...),
                text='user@example.com'
            )
            await handler.handle_action(action)
        
        elif field['type'] == 'select':
            action = ActionInput(
                action_type=ActionType.SELECT,
                locator=SkyvernElement(field['xpath'], ...),
                value='option-1'
            )
            await handler.handle_action(action)
    
    # Step 3: Submit form
    submit_button = locate_element(page, "//button[@type='submit']")
    submit_action = ActionInput(
        action_type=ActionType.CLICK,
        locator=submit_button
    )
    
    result = await handler.handle_action(submit_action)
    return result.success
```

## Comparison: Action Abstraction Approaches

| Aspect | Skyvern | BrowserNode | Browserable |
|--------|---------|------------|-------------|
| **Action taxonomy** | Comprehensive enum | Method-based (click, type, scroll) | Helper functions (actHelper, etc.) |
| **Semantic context** | InputOrSelectContext | None | Prompts encode intent |
| **Error handling** | Per-action with fallback | Try/catch + coordinate fallback | Multi-strategy retry |
| **Element abstraction** | SkyvernElement wrapper | Direct session methods | DOM tree nodes |
| **LLM integration** | Tight (prompt templates) | Minimal | Tight (prompts) |

## Lessons for Our Library

### ✅ **Adopt**
1. **ActionType enum** — Comprehensive taxonomy of interaction types
2. **SkyvernElement wrapper** — Unified API over Locator with fallback strategies
3. **InputOrSelectContext** — Semantic analysis of form fields (email, password, etc.)
4. **Per-action error handling** — Try/catch + fallback + retry logic
5. **Action result structure** — Confidence, message, error tracking
6. **XPath fallback** — When selector fails, use coordinates

### ⚠️ **Trade-offs**
1. **Python-specific** — Analysis patterns don't directly translate to JS/TS
2. **Tight LLM coupling** — Lots of prompt templates; requires maintenance
3. **Input context analysis** — Heuristics-based; may miss edge cases

### 🎯 **Implementation Notes**
- **Auto-scroll**: Always scroll element into view before interaction
- **Clear before type**: For inputs, clear field before typing (some frameworks need it)
- **Option validation**: Before selecting, verify option exists
- **Semantic labels**: Extract associated `<label>` elements for field understanding
- **Confidence scores**: Return confidence to let higher-level agents decide confidence thresholds

## Files Reviewed

- `src/action/actions.py` — ActionType enum and action definitions
- `src/handler.py` — ActionHandler with per-action logic
- `src/dom.py` — DOM extraction and element finding
- `src/locator.py` — SkyvernElement wrapper
- `src/context.py` — ElementContext and InputOrSelectContext
- `src/prompts/` — Jinja2 templates for LLM prompts
- `src/agent/` — Multi-step agent orchestration
