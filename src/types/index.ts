/**
 * Core types and interfaces for html-llm-interfacer
 */

/**
 * Represents a DOM element with metadata
 */
export interface DOMElement {
  index: number;
  tagName: string;
  text: string;
  xpath: string;
  attributes: Record<string, string>;
  isInteractive: boolean;
  isVisible: boolean;
  viewportX: number;
  viewportY: number;
  pageX: number;
  pageY: number;
  frameId?: string; // ID of the frame this element belongs to
}

/**
 * Represents the state of a DOM tree
 */
export interface DOMTreeState {
  url: string;
  title: string;
  elements: DOMElement[];
  timestamp: number;
}

/**
 * Session state for multi-turn interactions
 */
export interface SessionState {
  sessionId: string;
  domTree: DOMTreeState;
  previousDomTree?: DOMTreeState;
  history: Array<{
    action: string;
    timestamp: number;
  }>;
}

/**
 * Action types supported by the automation system
 */
export enum ActionType {
  Click = 'click',
  Type = 'type',
  Select = 'select',
  Hover = 'hover',
  Scroll = 'scroll',
  Wait = 'wait',
  Navigate = 'navigate',
  Extract = 'extract',
}

/**
 * Represents an action to be executed
 */
export interface Action {
  actionType: ActionType;
  elementIndex?: number;
  params?: Record<string, unknown>;
  xpath?: string;
  text?: string;
  frameId?: string; // Target frame for the action
}

/**
 * Result of executing an action
 */
export interface ActionResult {
  success: boolean;
  message: string;
  error?: string;
  newDomTree?: DOMTreeState;
  confidence?: number;
}

/**
 * Configuration for SmartBrowser
 */
export interface SmartBrowserConfig {
  headless?: boolean;
  timeout?: number;
  viewportWidth?: number;
  viewportHeight?: number;
}
