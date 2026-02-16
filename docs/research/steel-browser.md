# steel-browser Research

**Repository**: steel-dev/steel-browser  
**Stars**: ~6,400  
**Language**: TypeScript (API), Puppeteer-core (browser control)  
**Focus**: Headless browser API for AI agents with session management, scraping, PDF/screenshot support

## Overview

Steel Browser is a **production-oriented headless browser API** designed specifically for AI agents. Unlike the research-focused browser-use and LaVague, Steel emphasizes:
1. **Modular API design** (scrape, screenshot, PDF, search)
2. **Session management** (browser reuse, context isolation)
3. **Infrastructure robustness** (proxy, cookies, storage persistence)
4. **Agent-friendly formats** (structured output, cost tracking, debugging)

No built-in element interaction model; focuses on **page scraping and state extraction** for agents to decide.

## Key Architecture Decisions

### 1. **Fastify Plugin-Based API**

**Structure**:
```
API (Fastify)
  ├── Browser Instance Plugin
  ├── Session Plugin
  ├── Actions Routes (/scrape, /screenshot, /pdf, /search)
  ├── Files Routes (upload/download)
  ├── Logs Routes (browser events)
  ├── CDP Routes (direct CDP access)
  └── Selenium Routes (WebDriver compatibility)
```

**Plugin Registration** (`steel-browser-plugin.ts`):
```typescript
const steelBrowserPlugin: FastifyPluginAsync<SteelBrowserConfig> = async (fastify, opts) => {
  await fastify.register(browserInstancePlugin);
  await fastify.register(browserSessionPlugin);
  await fastify.register(actionsRoutes, { prefix: "/v1" });
  await fastify.register(sessionsRoutes, { prefix: "/v1" });
  await fastify.register(cdpRoutes, { prefix: "/v1" });
};
```

**Benefit**: Modular, extensible without modifying core API

### 2. **Session-Based Browser Management**

**Model**:
- **Primary Browser Instance** — Singleton, shared across sessions (cost optimization)
- **Browser Contexts** — Isolated sessions (cookies, storage, cache separate)
- **Pages/Tabs** — Individual tabs within context

**Lifecycle**:
```typescript
interface SessionDetails {
  id: string;
  createdAt: Date;
  status: "idle" | "live" | "released" | "failed";
  duration: number;
  eventCount: number;
  creditsUsed: number;
  websocketUrl: string;
}
```

**Creation** (`sessions.controller.ts`):
```typescript
async function launchSession(config: CreateSession) {
  const context = await browser.createBrowserContext({
    proxyServer: config.proxyUrl,
    cookies: config.cookies
  });
  
  const page = await context.newPage();
  const sessionId = uuid();
  
  // Persist session state (cookies, storage, etc.)
  return { id: sessionId, websocketUrl: ... };
}
```

**Advantage**: Session reuse reduces startup overhead; context isolation prevents cross-session pollution

### 3. **Unified Scraping API**

**Formats Supported** (`ScrapeFormat` enum):
```typescript
export enum ScrapeFormat {
  HTML = "html",
  CLEANED_HTML = "cleaned_html",
  READABILITY = "readability",
  MARKDOWN = "markdown"
}
```

**Scraping Pipeline** (`actions.controller.ts`):
```
1. Navigate to URL (or PDF via node-fetch)
2. Evaluate JavaScript to extract:
   - HTML (document.documentElement.outerHTML)
   - Links (document.links → URL + text)
   - Metadata (title, description, OG tags, JSON-LD, favicon)
   - Language, timestamp, canonical URL
3. Return in multiple formats

Formats:
  - HTML: Raw markup
  - Cleaned HTML: Remove scripts, styles, ads
  - Readability: Extract main content via Mozilla Readability
  - Markdown: HTML → Markdown conversion
```

**Example Response** (`ScrapeResponse`):
```typescript
{
  content: {
    html: "...",
    cleaned_html: "...",
    readability: "...",
    markdown: "..."
  },
  metadata: {
    title: "Page Title",
    description: "Meta description",
    language: "en",
    ogTitle: "Open Graph Title",
    jsonLd: { ... },
    statusCode: 200,
    links: [
      { url: "https://...", text: "Link text" }
    ]
  },
  screenshot?: "base64...",
  pdf?: "base64..."
}
```

**Design Benefit**: Single endpoint, multiple formats → Agent chooses relevant format

### 4. **Advanced Browser Features**

**Fingerprinting** (`cdp.service.ts`):
```typescript
import { FingerprintGenerator } from "fingerprint-generator";

const generator = new FingerprintGenerator();
const fingerprint = generator.getFingerprint();

// Apply to browser:
// - User Agent
// - Viewport
// - Screen resolution
// - Timezone
// - Language
// - WebGL data
// - Canvas fingerprinting
```

**Proxy Support**:
```typescript
const context = await browser.createBrowserContext({
  proxyServer: "http://proxy:8080"
});
```

**Storage Persistence**:
```typescript
interface SessionData {
  cookies: Cookie[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  indexedDB: Record<string, Database[]>;
}

// Load
await browser.restoreSessionData(sessionData);

// Save
const data = await browser.getSessionData();
```

**Media Blocking** (performance):
```typescript
await cdpService.launch({
  optimizeBandwidth: {
    blockImages: true,
    blockMedia: true,
    blockStylesheets: false
  }
});
```

### 5. **Event Instrumentation & Logging**

**Browser Events Captured** (`instrumentation/types.ts`):
```typescript
export enum BrowserEventType {
  Request = "Request",
  Response = "Response",
  Navigation = "Navigation",
  Console = "Console",
  PageError = "PageError",
  RequestFailed = "RequestFailed",
  CDPCommand = "CDPCommand",
  CDPEvent = "CDPEvent",
  ScreencastFrame = "ScreencastFrame",
  Recording = "Recording"
}
```

**Usage** (debugging, replaying):
```typescript
const logger = createBrowserLogger({
  stream: logFile,
  storage: databaseConnection
});

// Automatically logs all browser events
browser.on("request", (req) => logger.record(req));
browser.on("response", (res) => logger.record(res));
```

**Query Interface** (`/v1/logs`):
```typescript
const logs = await fetch("/v1/logs?pageId=page-1&startTime=...&limit=100");
// Returns paginated log entries with filtering
```

### 6. **WebSocket for Real-Time Streaming**

**Use Cases**:
- Live browser preview (streamer view)
- Interactive session debugging
- Screen casting for agents

**Handler** (`browser-socket.ts`):
```typescript
export interface WebSocketHandler {
  path: string;
  handle(socket: WebSocket, params: Record<string, string>): void;
}

export const defaultHandlers = [
  logsHandler,     // Stream logs
  castHandler,     // Screen cast
  pageIdHandler,   // Page switching
  recordingHandler // Record interactions
];
```

**Example: Screen Cast**
```typescript
socket.on("message", (msg) => {
  const data = JSON.parse(msg);
  if (data.type === "mouseMove") {
    await page.mouse.move(data.x, data.y);
  }
});

// Server → Client: Screen updates
page.on("framechanged", async () => {
  const screenshot = await page.screenshot();
  socket.send(JSON.stringify({ type: "frame", data: screenshot }));
});
```

### 7. **Structured Output & Type Safety**

**Zod Schemas** (all endpoints):
```typescript
const ScrapeRequest = z.object({
  url: z.string().url().optional(),
  format: z.array(z.nativeEnum(ScrapeFormat)).optional(),
  screenshot: z.boolean().optional(),
  pdf: z.boolean().optional(),
  proxyUrl: z.string().nullable().optional(),
  delay: z.number().optional()
});

const ScrapeResponse = z.object({
  content: z.record(z.nativeEnum(ScrapeFormat), z.any()),
  metadata: z.object({ ... }),
  screenshot: z.string().optional(),
  pdf: z.string().optional()
});
```

**Auto-Generated OpenAPI** → Client SDKs, type hints

## Comparison to browser-use

| Aspect | browser-use | steel-browser |
|--------|-------------|---------------|
| **Use Case** | Research, automation | Production, agents |
| **API Style** | Python class (BrowserDriver) | HTTP REST + WebSocket |
| **Element Selection** | DOM tree extraction | Scraping only (no interaction) |
| **Session Model** | Single instance | Context-based (shared browser) |
| **Observability** | None | Full event logging |
| **Formats** | HTML (raw) | HTML + cleaned + readability + markdown |

## Comparison to HyperAgent

| Aspect | HyperAgent | steel-browser |
|--------|-----------|---------------|
| **Scope** | Element finding + execution | Page scraping + state extraction |
| **ID Model** | frameIndex-backendNodeId | N/A (no element model) |
| **LLM Integration** | Integrated (examine-dom) | Decoupled (agent decides) |
| **Transport** | Direct Page API | HTTP REST |
| **Extensibility** | Hard-coded actions | Plugin architecture |

## Lessons for Our Library

### ✅ **Adopt**
1. **Modular API design**: Separate scrape/screenshot/pdf concerns; let agent choose
2. **Session-based architecture**: Browser instance reuse + context isolation
3. **Multiple output formats**: Return HTML + cleaned + markdown; agent picks best
4. **Type safety with Zod**: All inputs/outputs validated
5. **Event logging**: Full observability for debugging
6. **Plugin architecture**: Easy to add new actions (search, PDF, etc.)

### ⚠️ **Reconsider**
1. **No element model**: Steel delegates interaction to agent; requires separate element selection lib
2. **HTTP API overhead**: REST → Language binding needed; direct library may be simpler for browser automation
3. **Fingerprinting complexity**: Good for bot detection avoidance, but adds overhead

### 🎯 **Decision Point**
- **Should we focus on element **extraction** (like browser-use/HyperAgent) or **scraping** (like steel)?**
  - Extraction: Enables fine-grained automation (click button X, type in field Y)
  - Scraping: Higher-level (get page state); agent decides actions

## Recommended Patterns (TypeScript)

```typescript
// Separated concerns
interface BrowserAPI {
  scrape(url: string, options: ScrapeOptions): Promise<ScrapeResponse>;
  screenshot(url: string, options: ScreenshotOptions): Promise<Buffer>;
  pdf(url: string, options: PDFOptions): Promise<Buffer>;
}

interface ScrapeOptions {
  format?: ScrapeFormat[];
  screenshot?: boolean;
  pdf?: boolean;
  proxyUrl?: string;
  delay?: number;
}

interface ScrapeResponse {
  content: Record<ScrapeFormat, any>;
  metadata: PageMetadata;
  screenshot?: string; // base64
  pdf?: string; // base64
}

// Session-based browser
class BrowserSession {
  id: string;
  context: BrowserContext;
  pages: Page[];
  
  async createPage(): Promise<Page> {
    const page = await this.context.newPage();
    this.pages.push(page);
    return page;
  }
  
  async release(): Promise<SessionStats> {
    await this.context.close();
    return { duration, eventsLogged, ... };
  }
}

class BrowserManager {
  private browser: Browser;
  private sessions: Map<string, BrowserSession> = new Map();
  
  async createSession(config: SessionConfig): Promise<BrowserSession> {
    const context = await this.browser.createBrowserContext({
      proxyServer: config.proxyUrl,
      cookies: config.cookies
    });
    
    const session = new BrowserSession(context);
    this.sessions.set(session.id, session);
    return session;
  }
}

// Pluggable actions
interface Action {
  name: string;
  execute(page: Page, ...args: any[]): Promise<any>;
}

class ActionRegistry {
  private actions: Map<string, Action> = new Map();
  
  register(action: Action): void {
    this.actions.set(action.name, action);
  }
  
  async execute(name: string, page: Page, ...args: any[]): Promise<any> {
    const action = this.actions.get(name);
    if (!action) throw new Error(`Unknown action: ${name}`);
    return action.execute(page, ...args);
  }
}

// Event logging
interface BrowserLogger {
  record(event: BrowserEvent): void;
  query(filter: EventFilter): Promise<BrowserEvent[]>;
}

// Usage
const browser = new BrowserManager();
const session = await browser.createSession({ proxyUrl: "..." });
const page = await session.createPage();

const response = await browser.scrape("https://example.com", {
  format: ["html", "markdown"],
  screenshot: true
});

console.log(response.metadata.links); // For agent to decide
```

## Open Questions

1. **Element extraction**: Should steel add element extraction (like browser-use), or stay focused on scraping?
2. **Agent-specific features**: What's the minimal set for AI? (scraping, navigation, logging)
3. **Cost model**: Credits per session vs. per action? How to charge for proxy, fingerprinting?

## Files Reviewed

- `api/src/modules/actions/` — Scrape, screenshot, PDF, search
- `api/src/steel-browser-plugin.ts` — API orchestration
- `api/src/services/cdp/cdp.service.ts` — Browser lifecycle
- `api/src/plugins/browser-socket/` — WebSocket handlers
- `docs/ARCHITECTURE.md` — API design patterns
- `examples/` — Usage patterns
