# axe-core Research

**Repository**: dequelabs/axe-core  
**Stars**: ~3,000  
**Language**: JavaScript  
**Focus**: Accessibility testing engine; ARIA role/attribute validation and rules

## Overview

While axe-core is **not a browser automation tool**, it provides the most **comprehensive ARIA role taxonomy** and **accessibility rules** of any open-source project. This research focuses on extracting lessons for our **element taxonomy** and **accessibility-aware filtering**.

Key Value: axe-core's role definitions, implicit role mappings, and accessibility tree construction are directly applicable to defining which elements are "interactive" and how to categorize them semantically.

## Key Architecture Insights

### 1. **Comprehensive ARIA Role Taxonomy**

**Location**: `lib/standards/aria-roles.js`

**Role Categories**:
```typescript
type AriaRoleType = 
  | "abstract"          // command, widget, window, structure
  | "landmark"          // banner, main, navigation, region
  | "widget"            // button, link, textbox, checkbox, dialog
  | "composite"         // menu, menubar, tablist, combobox
  | "structure"         // article, document, note, presentation;

interface AriaRole {
  type: AriaRoleType;
  allowedAttrs?: string[];      // aria-* allowed on this role
  requiredAttrs?: string[];     // Must have these
  requiredContext?: string[];   // Parent roles required (e.g., menuitem → menu)
  requiredOwned?: string[];     // Child roles required
  nameFromContent?: boolean;    // Can get name from element text?
  unsupported?: boolean;        // Known browser bugs?
  superclassRole?: string[];    // Role hierarchy
}
```

**Example: Button**
```javascript
{
  type: 'widget',
  allowedAttrs: [
    'aria-expanded',
    'aria-pressed',
    'aria-disabled'
  ],
  requiredAttrs: [],
  nameFromContent: true,
  superclassRole: ['command'],
  unsupported: false
}
```

**All Roles**: 50+ standardized roles (alert, banner, button, checkbox, combobox, dialog, etc.)

### 2. **Implicit Role Mapping (HTML → ARIA)**

**Location**: `lib/commons/standards/implicit-html-roles.js`

**Purpose**: Determine what ARIA role an HTML element has by default (without `role=` attribute)

**Examples**:
```typescript
// From implicit-html-roles.ts
const implicitRoles = {
  a: 'link',                    // if href exists
  button: 'button',
  input: {
    default: 'textbox',
    type: {
      'checkbox': 'checkbox',
      'radio': 'radio',
      'range': 'slider',
      'number': 'spinbutton',
      'button': 'button',
      'image': 'button',
      'submit': 'button',
      'reset': 'button'
    }
  },
  select: 'listbox',
  textarea: 'textbox',
  h1…h6: 'heading',
  nav: 'navigation',
  article: 'article',
  main: 'main',
  aside: 'complementary'
};
```

**Usage** (in axe-core):
```typescript
function getImplicitRole(element) {
  const roles = implicitRoles[element.tagName.toLowerCase()];
  
  // Handle type-based (input)
  if (typeof roles === 'object' && roles.type) {
    return roles.type[element.type] || roles.default;
  }
  
  // Handle conditional (a requires href)
  if (element.tagName === 'A' && !element.href) {
    return null; // Not a link unless href exists
  }
  
  return roles;
}
```

### 3. **Accessibility Tree Building**

**Entry Point**: `lib/commons/aria/get-role.ts`

**Role Resolution Priority**:
```
1. Explicit role (role="..." attribute)
   ↓ [if invalid, skip]
2. Implicit role (HTML tag mapping)
3. Presentational inheritance (parent role=presentation)
4. null (no semantic role)
```

**Code**:
```typescript
export function getRole(node, { dpub, fallback } = {}) {
  let role = getExplicitRole(node);
  
  if (!role) {
    role = getImplicitRole(node);
  }
  
  if (!role && fallback) {
    return 'generic'; // Fallback for untyped elements
  }
  
  return role;
}
```

### 4. **Interactive Element Detection**

**Location**: Multiple files; consolidated in `lib/commons/forms/`

**Concepts**:
- `isAriaTextbox(node)` — Check if node is textbox role
- `isAriaListbox(node)` — Check if node is listbox role
- `isAriaButton(node)` — Check if node is button-like

**Example Implementation**:
```typescript
function isAriaTextbox(node) {
  const role = getExplicitRole(node);
  return role === 'textbox';
}
```

**Actionable Roles** (for our library):
From axe's rules, these roles enable interaction:
- **Click/Activate**: button, link, checkbox, radio, tab, menuitem, option
- **Type**: textbox, searchbox, combobox (with input), contenteditable
- **Select**: listbox, combobox, select (native)
- **Check**: checkbox, switch
- **Press**: button (via Enter), link (via Enter), radio, menuitem

### 5. **Required Context & Hierarchy**

**Purpose**: Validate that roles are used in valid parent-child relationships

**Example**:
```typescript
const roleHierarchy = {
  menuitem: {
    requiredContext: ['menu', 'menubar'],  // Parent must be menu or menubar
  },
  tab: {
    requiredContext: ['tablist'],          // Parent must be tablist
  },
  option: {
    requiredContext: ['listbox', 'tree'],  // Parent must be listbox or tree
  }
};
```

**Validation**:
```typescript
function validateRoleContext(element, role) {
  const required = roleHierarchy[role]?.requiredContext;
  if (!required) return true; // No requirement
  
  let parent = element.parentElement;
  while (parent) {
    const parentRole = getRole(parent);
    if (required.includes(parentRole)) {
      return true; // Valid
    }
    parent = parent.parentElement;
  }
  
  return false; // Invalid context
}
```

### 6. **Virtual Node & Shadow DOM Support**

**Virtual Node** (`lib/core/base/virtual-node/`):
```typescript
interface VirtualNode {
  actualNode: HTMLElement;
  parent?: VirtualNode;
  children: VirtualNode[];
  shadowRoot?: ShadowRoot;
  iframeWindow?: Window;
  props: {
    nodeType: 1 | 3; // Element or Text
    nodeName: string;
    attributes: Record<string, string>;
    id?: string;
    className?: string;
  };
}
```

**Purpose**: Unified tree representation across:
- Regular DOM
- Shadow DOM (custom elements)
- iframes (via window.parent)

### 7. **Standards Object for Configuration**

**Design Pattern**: Globally configurable ruleset

**Usage**:
```typescript
axe.configure({
  standards: {
    ariaRoles: {
      myCustomRole: {
        type: 'widget',
        allowedAttrs: ['aria-selected']
      }
    },
    htmlElms: {
      myCustomElement: {
        allowedRoles: ['link', 'button'],
        contentTypes: ['interactive']
      }
    }
  }
});
```

**Benefit**: No hardcoded assumptions; can be extended for custom patterns

## Comparison to Other Tools

| Tool | ARIA Expertise | Role Taxonomy | Validation |
|------|----------------|---------------|-----------|
| axe-core | ⭐⭐⭐⭐⭐ Deep | 50+ roles, full hierarchy | 50+ rules |
| browser-use | ⭐⭐ Basic | Clickable, inputs, forms | None (heuristic) |
| HyperAgent | ⭐⭐ Basic | Interactive roles list | Via LLM |
| LaVague | ⭐ None | None (XPath only) | None |

## Lessons for Our Library

### ✅ **Adopt**
1. **Role-based taxonomy**: Categorize elements by ARIA role (button, link, textbox, etc.) not just HTML tags
2. **Implicit role detection**: Map HTML → ARIA role to catch semantic elements without explicit `role=`
3. **Hierarchy validation**: Check parent-child relationships (e.g., menuitem → menu)
4. **Accessible name extraction**: Use axe's name calculation (content, attr, labeling)
5. **Shadow DOM support**: Build virtual trees that span shadow boundaries + iframes
6. **Configurable standards**: Allow custom role definitions for extended patterns

### ⚠️ **Reconsider**
1. **Full rule suite**: axe-core offers 50+ accessibility rules; we need interaction only (20-30% of that)
2. **Strict validation**: Some elements are useful even if not strictly ARIA-valid; allow lenient mode

### 🎯 **Decision Point**
- **How strict should our element taxonomy be?**
  - Strict: Only ARIA-valid roles/states (→ accessibility compliance guaranteed)
  - Lenient: Allow common patterns even if not spec-compliant (→ broader compatibility)

## Recommended Patterns (TypeScript)

```typescript
// ARIA Role Definition
interface AriaRole {
  type: 'widget' | 'landmark' | 'structure' | 'abstract' | 'composite';
  allowedAttrs?: string[];
  requiredAttrs?: string[];
  requiredContext?: string[];  // Parent roles
  requiredOwned?: string[];    // Child roles
  nameFromContent?: boolean;
  unsupported?: boolean;
  superclassRole?: string[];
}

// Implicit Role Mapping
const IMPLICIT_ROLES: Record<string, string | Record<string, string>> = {
  a: 'link',
  button: 'button',
  input: {
    default: 'textbox',
    checkbox: 'checkbox',
    radio: 'radio',
    range: 'slider'
  },
  select: 'listbox',
  textarea: 'textbox'
};

// Role Resolution
function getRole(element: HTMLElement): string | null {
  // 1. Try explicit role
  const explicit = element.getAttribute('role');
  if (explicit) return explicit; // [validation would go here]
  
  // 2. Try implicit role
  const tag = element.tagName.toLowerCase();
  const implicit = IMPLICIT_ROLES[tag];
  
  if (typeof implicit === 'string') {
    return implicit;
  } else if (typeof implicit === 'object') {
    const attr = element.getAttribute(implicit.keyAttr || 'type');
    return implicit[attr] || implicit.default || null;
  }
  
  return null;
}

// Interactive Element Classification
type InteractiveRole = 
  | 'button' | 'link' | 'checkbox' | 'radio' | 'tab' | 'menuitem'
  | 'textbox' | 'searchbox' | 'combobox'
  | 'listbox' | 'option' | 'switch';

const INTERACTIVE_ROLES = new Set<InteractiveRole>([
  'button', 'link', 'checkbox', 'radio', 'tab', 'menuitem',
  'textbox', 'searchbox', 'combobox',
  'listbox', 'option', 'switch'
]);

function isInteractive(element: HTMLElement): boolean {
  const role = getRole(element);
  return role ? INTERACTIVE_ROLES.has(role as InteractiveRole) : false;
}

// Accessible Name Calculation (simplified from axe-core)
function getAccessibleName(element: HTMLElement): string {
  // 1. aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const ids = labelledBy.split(' ');
    return ids
      .map(id => document.getElementById(id)?.textContent)
      .join(' ');
  }
  
  // 2. aria-label
  const label = element.getAttribute('aria-label');
  if (label) return label;
  
  // 3. Text content (if role allows)
  const role = getRole(element);
  if (role && isNameFromContent(role)) {
    return element.textContent?.trim() || '';
  }
  
  // 4. placeholder (for inputs)
  if (element instanceof HTMLInputElement) {
    return element.placeholder;
  }
  
  return '';
}

function isNameFromContent(role: string): boolean {
  return ['button', 'link', 'tab'].includes(role);
}

// Virtual Node for cross-boundary traversal
interface VirtualNode {
  element: HTMLElement;
  parent?: VirtualNode;
  children: VirtualNode[];
  shadowRoot?: VirtualNode[]; // Shadow DOM children
  iframeWindow?: Window;
}

function buildVirtualTree(root: HTMLElement): VirtualNode {
  const node: VirtualNode = { element: root, children: [] };
  
  // Regular children
  for (const child of root.children) {
    const vChild = buildVirtualTree(child as HTMLElement);
    vChild.parent = node;
    node.children.push(vChild);
  }
  
  // Shadow DOM children
  if (root.shadowRoot) {
    for (const child of root.shadowRoot.children) {
      const vChild = buildVirtualTree(child as HTMLElement);
      vChild.parent = node;
      (node.shadowRoot ??= []).push(vChild);
    }
  }
  
  return node;
}

// Standards Configuration
interface ElementStandard {
  role?: string;               // Default implicit role
  allowedRoles?: string[];     // Non-default allowed roles
  interactive: boolean;        // Can user interact?
  clickable?: boolean;
  typeable?: boolean;
  selectable?: boolean;
}

class StandardRules {
  private rules: Record<string, ElementStandard> = {
    a: { role: 'link', allowedRoles: ['button'], interactive: true, clickable: true },
    button: { role: 'button', interactive: true, clickable: true },
    input: { interactive: true, typeable: true, selectable: true },
    textarea: { role: 'textbox', interactive: true, typeable: true }
  };
  
  get(element: HTMLElement): ElementStandard | null {
    return this.rules[element.tagName.toLowerCase()] || null;
  }
  
  configure(tagName: string, standard: ElementStandard): void {
    this.rules[tagName] = standard;
  }
}

// Usage
const element = document.querySelector('button');
const role = getRole(element);
const isClick = isInteractive(element);
const name = getAccessibleName(element);
console.log({ role, isClick, name });
```

## Open Questions

1. **ARIA strictness**: Should we enforce required parents/children (→ accessibility) or allow flexible patterns (→ compatibility)?
2. **Custom elements**: How to map Web Components to ARIA roles? axe-core has limited support.
3. **Accessibility tree vs. interaction tree**: Are all accessible elements interaction-worthy, or should we filter further?

## Files Reviewed

- `lib/standards/aria-roles.js` — Role definitions
- `lib/commons/standards/implicit-html-roles.js` — Implicit role mapping
- `lib/commons/aria/get-role.js` — Role resolution
- `lib/commons/aria/get-element-unallowed-roles.js` — Validation
- `lib/commons/forms/` — Interactive element checks
- `axe.d.ts` — TypeScript definitions
- `doc/standards-object.md` — Configuration schema
