# Browserbase MCP Server Research

**Repository**: browserbase/mcp-server-browserbase  
**Language**: TypeScript  
**Focus**: Model Context Protocol (MCP) server for cloud-based browser automation + Stagehand v3 integration

## Overview

Browserbase provides an **MCP server wrapper** around Browserbase's cloud browser infrastructure and the Stagehand automation library. Key innovation: **serverless session management** with resource-aware screenshot handling optimized for vision APIs.

## Architecture

### 1. **MCP Tool System**

**Available Tools** (via MCP interface):
- `navigate` — Load URL / forward / backward
- `act` — Execute action on element (via Stagehand)
- `extract` — Extract structured data from page
- `screenshot` — Capture current viewport (with scaling)
- `observe` — Get current page state
- `get_url` — Return current URL
- `agent` — Multi-turn agent loop

**Tool Registration Pattern**:
```typescript
interface ToolSchema {
  name: string;
  description: string;
  inputSchema: object;  // JSON Schema
}

interface Tool {
  schema: ToolSchema;
  execute: (input: object) => Promise<ToolResult>;
}

class BrowserbaseServer {
  private tools: Map<string, Tool> = new Map();
  
  registerTool(tool: Tool) {
    this.tools.set(tool.schema.name, tool);
  }
  
  async executeTool(name: string, input: object): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    return tool.execute(input);
  }
}
```

### 2. **Session Management**

**Multi-session Architecture**:
```typescript
interface Session {
  sessionId: string;
  stagehand: Stagehand;  // v3
  createdAt: Date;
  lastActivity: Date;
  resources: {
    screenshotsCount: number;
    screenshotIds: string[];  // For cleanup
  };
}

class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private maxSessions = 10;
  private idleTimeout = 15 * 60 * 1000;  // 15 min
  
  async createSession(browserId?: string): Promise<Session> {
    if (this.sessions.size >= this.maxSessions) {
      await this._evictLruSession();
    }
    
    const stagehand = new Stagehand({ browserId });
    const session: Session = {
      sessionId: generateUUID(),
      stagehand,
      createdAt: new Date(),
      lastActivity: new Date(),
      resources: { screenshotsCount: 0, screenshotIds: [] }
    };
    
    this.sessions.set(session.sessionId, session);
    return session;
  }
  
  async closeSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    await this._cleanupResources(session);
    await session.stagehand.close();
    this.sessions.delete(sessionId);
  }
  
  private async _cleanupResources(session: Session) {
    // Delete screenshot resources from Browserbase
    for (const screenshotId of session.resources.screenshotIds) {
      await this.browserbaseClient.deleteResource(screenshotId);
    }
    session.resources.screenshotIds = [];
  }
}
```

**Idle Timeout Loop**:
```typescript
async startIdleMonitor() {
  setInterval(() => {
    for (const [sessionId, session] of this.sessions) {
      const idleTime = Date.now() - session.lastActivity.getTime();
      
      if (idleTime > this.idleTimeout) {
        this.closeSession(sessionId);
      }
    }
  }, 60 * 1000);  // Check every minute
}
```

### 3. **Screenshot Handling (CDP Integration)**

**Problem**: Vision models (Claude, GPT-4V) have token limits. Raw screenshots waste tokens.

**Solution**:
```typescript
interface ScreenshotOptions {
  type: 'png' | 'jpeg';
  quality?: number;        // 0-100 (JPEG)
  scale?: number;          // 0.5 = 50% size (4x compression)
  width?: number;
  height?: number;
}

async function takeScreenshot(
  stagehand: Stagehand,
  options: ScreenshotOptions = {}
): Promise<{ 
  base64: string;
  mimeType: string;
  width: number;
  height: number;
}> {
  const screenshotBuffer = await stagehand.page.screenshot({
    type: options.type || 'png',
    quality: options.quality || 80,
    fullPage: false  // Only viewport
  });
  
  // Optional: Scale using Sharp
  if (options.scale && options.scale < 1) {
    const sharp = require('sharp');
    const scaledBuffer = await sharp(screenshotBuffer)
      .resize(
        Math.round(1280 * options.scale),  // Assume 1280px default width
        Math.round(720 * options.scale)
      )
      .toBuffer();
    
    return {
      base64: scaledBuffer.toString('base64'),
      mimeType: `image/${options.type || 'png'}`,
      width: Math.round(1280 * options.scale),
      height: Math.round(720 * options.scale)
    };
  }
  
  return {
    base64: screenshotBuffer.toString('base64'),
    mimeType: `image/${options.type || 'png'}`,
    width: 1280,
    height: 720
  };
}
```

**Resource Tracking**:
```typescript
// After taking screenshot, register it
const screenshot = await takeScreenshot(stagehand);
const resourceId = await browserbaseClient.createResource({
  type: 'screenshot',
  data: screenshot.base64,
  metadata: {
    url: stagehand.page.url(),
    timestamp: Date.now(),
    sessionId: session.sessionId
  }
});

session.resources.screenshotIds.push(resourceId);

// Return to client
return {
  data: screenshot.base64,
  metadata: { resourceId, timestamp: Date.now() }
};
```

### 4. **Stagehand v3 Integration**

**Stagehand as Abstraction**:
```typescript
// Before: Raw Playwright
const handle = await page.$('button[aria-label="Submit"]');
await handle?.click();

// With Stagehand v3: Natural intent
const result = await stagehand.act({
  action: 'click',
  description: 'Click the Submit button'
});
```

**Performance Boost**:
- **20-40% faster actions** due to improved selector generation
- **Better element stability** before interaction
- **Built-in retry logic** for flaky selections
- **Coordinate fallback** if selector fails

**Stagehand Usage in MCP**:
```typescript
async function executeActTool(
  session: Session,
  action: {
    action: 'click' | 'type' | 'hover' | 'scroll';
    description?: string;
    text?: string;  // For 'type' action
  }
) {
  try {
    const result = await session.stagehand.act({
      action: action.action,
      description: action.description || 'Perform action',
      text: action.text
    });
    
    return { 
      success: true,
      message: result.message || 'Action completed'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
```

### 5. **Multi-turn Agent Loop**

**Agent Tool** (orchestrates the above):
```typescript
async function agentTool(
  session: Session,
  options: {
    objective: string;
    maxSteps?: number;
    model?: 'claude-3-5-sonnet' | 'gpt-4';
  }
): Promise<{ 
  result: any;
  steps: AgentStep[];
  message: string;
}> {
  const messages = [];
  const steps = [];
  let step = 0;
  
  while (step < (options.maxSteps || 10)) {
    // 1. Get current state
    const screenshot = await takeScreenshot(session.stagehand);
    const url = session.stagehand.page.url();
    
    // 2. Send to LLM with tool definitions
    const response = await client.messages.create({
      model: options.model || 'claude-3-5-sonnet',
      max_tokens: 4096,
      tools: [
        { name: 'navigate', description: '...', input_schema: {...} },
        { name: 'act', description: '...', input_schema: {...} },
        { name: 'extract', description: '...', input_schema: {...} },
        { name: 'screenshot', description: '...', input_schema: {...} }
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Objective: ${options.objective}\nCurrent URL: ${url}\nStep ${step + 1}`
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshot.base64
              }
            }
          ]
        }
      ]
    });
    
    // 3. Parse tool calls
    const toolUses = response.content.filter(c => c.type === 'tool_use');
    
    if (toolUses.length === 0 && response.stop_reason === 'end_turn') {
      // Agent finished
      const finalText = response.content.find(c => c.type === 'text')?.text;
      return {
        result: { success: true, message: finalText },
        steps,
        message: 'Task completed'
      };
    }
    
    // 4. Execute tool calls
    for (const toolUse of toolUses) {
      const toolResult = await this.executeTool(toolUse.name, toolUse.input);
      
      steps.push({
        step: step + 1,
        tool: toolUse.name,
        input: toolUse.input,
        result: toolResult
      });
    }
    
    step++;
  }
  
  return {
    result: { success: false, message: 'Max steps exceeded' },
    steps,
    message: 'Agent loop timeout'
  };
}
```

### 6. **Transport Modes**

**HTTP Transport**:
```typescript
const transport = new HTTPServerTransport({
  host: '0.0.0.0',
  port: 3000
});

server.connect(transport);

// Client calls via HTTP JSON-RPC:
POST /rpc HTTP/1.1
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "screenshot"
  }
}
```

**Stdio Transport** (for Claude):
```typescript
const transport = new StdioServerTransport();
server.connect(transport);

// Claude Desktop app communicates via stdin/stdout
```

### 7. **Configuration & Auth**

**Environment Variables**:
```bash
# .env
BROWSERBASE_API_KEY=your-api-key
BROWSERBASE_PROJECT_ID=project-id
MCP_SERVER_PORT=3000
MCP_LOG_LEVEL=debug
SESSION_TIMEOUT=900000  # 15 minutes
MAX_SESSIONS=10
```

**Initialization**:
```typescript
const server = new BrowserbaseServer({
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
  maxSessions: parseInt(process.env.MAX_SESSIONS || '10'),
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '900000'),
  transport: process.env.TRANSPORT || 'stdio'
});

await server.start();
```

## Comparison to Standard Stagehand

| Feature | Browserbase MCP | Plain Stagehand |
|---------|-----------------|-----------------|
| **Session mgmt** | Built-in (cleanup, idle timeout) | Manual |
| **Resource tracking** | Automatic screenshot cleanup | Manual cleanup |
| **MCP interface** | ✓ Tools exposed via protocol | ✗ Must code integration |
| **Multi-turn agent** | Built-in `agent` tool | Manual loop |
| **Auth** | Browserbase API key | Local browser instance |
| **Scaling** | Serverless (cloud browsers) | Single machine |
| **Screenshot optimization** | Scaling + quality control | Full size only |

## Lessons for Our Library

### ✅ **Adopt**
1. **Session-based context** — Stagehand instance per session, not global
2. **Idle cleanup** — Monitor and terminate unused sessions
3. **Resource tracking** — Screenshot IDs for eventual cleanup
4. **Screenshot scaling** — Reduce tokens for vision models (0.5x = 4x compression)
5. **MCP tool schema** — Clear input_schema + error handling
6. **Multi-turn agent pattern** — LLM loop with tool calls + side effects

### ⚠️ **Consider Trade-offs**
1. **Cloud vs. local** — Browserbase adds cost; local better for high-volume
2. **Session pooling** — Useful for shared server; overkill for single-agent
3. **Stagehand abstraction** — 20-40% perf gain not justified if we need low-level control

### 🎯 **Implementation Notes**
- **Screenshot decisions**: PNG for fidelity, JPEG for speed; scale 0.5-0.75x standard
- **Session timeouts**: 15 min reasonable for interactive; adjust for long-running tasks
- **Tool definitions**: Provide clear input_schema schema for LLM to generate valid calls
- **Error propagation**: Wrap tool errors with context (step #, current URL, last action)

## Files Reviewed

- `src/server.ts` — Main MCP server setup
- `src/session.ts` — SessionManager + session lifecycle
- `src/tools/navigate.ts` — URL navigation
- `src/tools/act.ts` — Stagehand action execution
- `src/tools/extract.ts` — Data extraction
- `src/tools/screenshot.ts` — Screenshot capture + scaling
- `src/tools/agent.ts` — Multi-turn agent loop
- `src/types.ts` — TypeScript interfaces
- `.env.example` — Configuration template
