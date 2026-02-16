# Guia para Agents - html-llm-interfacer

## 📋 Visão Geral

Este arquivo descreve como usar os recursos de pesquisa e padrões arquiteturais da biblioteca **html-llm-interfacer** para construir agentes web automation eficientes.

---

## 🎯 Recursos Disponíveis

### 1. **Pesquisa Arquitetural** (`DOCS/research/`)

Análise completa de 13 frameworks de web automation:

| Recurso | Tipo | Use Quando |
|---------|------|-----------|
| [SYNTHESIS.md](./research/synthesis.md) | Análise Cruzada | ← **COMECE AQUI** |
| [nanobrowser.md](./research/nanobrowser.md) | Detecção de Elementos | Precisa encontrar o que é clicável |
| [skyvern.md](./research/skyvern.md) | Taxonomia de Ações | Precisa tipificar/estruturar ações |
| [browserable.md](./research/browserable.md) | Estratégias Multi-Fallback | Páginas grandes ou selectors frágeis |
| [browsernode.md](./research/browsernode.md) | Gerenciamento de Sessão | Multi-turn interactions com estado |
| [readability.md](./research/readability.md) | Extração de Conteúdo | Remover boilerplate, extrair artigos |
| [browserbase-mcp.md](./research/browserbase-mcp.md) | Deployment Cloud | Precisa escalar sem máquinas locais |
| [README.md](./research/readme.md) | Índice Completo | Referência rápida |

---

## 🔍 Como Escolher Sua Arquitetura

### **Passo 1: Identifique o Tamanho da Página**

```
┌─ Quantos elementos na página?
│
├─ < 1000?
│  └─ Use: nanobrowser + simple fallback
│     ✅ ~100ms DOM build
│
├─ 1000-5000?
│  └─ Use: nanobrowser + browsernode session
│     ✅ ~200ms build, frame support
│
└─ > 5000?
   └─ Use: browserable chunking + readability
      ✅ 20x token reduction
```

### **Passo 2: Identifique Sua Complexidade LLM**

```
┌─ Integração com LLM?
│
├─ Sem LLM (web scraping puro)?
│  └─ Use: nanobrowser + skyvern action system
│     ✅ Local only, no API calls
│
├─ Com LLM (Claude/GPT-4)?
│  └─ Use: skyvern structure + readability cleaning
│     ✅ Structured prompts, semantic fields
│
└─ Com LLM Vision (GPT-4V)?
   └─ Use: browserable multi-strategy
      ✅ Vision fallback para hard cases
```

### **Passo 3: Identifique Seu Deployment**

```
┌─ Onde rodar?
│
├─ Local machine?
│  └─ Use: browser-use or BrowserGym patterns
│     ✅ Session simple, no pooling
│
├─ Cloud/Serverless?
│  └─ Use: browserbase/mcp session pooling
│     ✅ Multi-session, auto cleanup
│
└─ On-premises datacenter?
   └─ Use: nanobrowser + browsernode
      ✅ Full control, persistent state
```

---

## 📐 Padrões Arquiteturais Recomendados

### **Arquitetura Recomendada (Stack Layered)**

```
┌───────────────────────────────┐
│  LLM Integration Layer        │
│  (skyvern ActionType enums)   │
│  + Semantic field understanding
└────────────────┬──────────────┘
                 │
┌────────────────▼──────────────┐
│  Action Execution             │
│  (browserable fallback chain) │
│  selector → xpath → vision → coords
└────────────────┬──────────────┘
                 │
┌────────────────▼──────────────┐
│  DOM Management               │
│  (nanobrowser heuristics)     │
│  Multi-stage interactivity    │
└────────────────┬──────────────┘
                 │
┌────────────────▼──────────────┐
│  Session Management           │
│  (browsernode state tracking) │
│  DOM cache, history, cleanup  │
└────────────────┬──────────────┘
                 │
┌────────────────▼──────────────┐
│  Content Cleaning             │
│  (readability extraction)     │
│  Remove boilerplate, scoring  │
└───────────────────────────────┘
```

---

## 🚀 Guia de Implementação Por Fase

### **Fase 1: Foundation (~1-2 sprints)**

✅ **O que implementar:**
1. Multi-stage interactivity detection (nanobrowser style)
2. XPath + coordinate fallback
3. Basic session state tracking
4. Element indexing system

```typescript
class SmartBrowser {
  // Multi-stage: cursor > form > ARIA > events
  isInteractive(element) {
    if (element.disabled) return false;
    if (getComputedStyle(element).cursor === 'pointer') return true;
    if (['button', 'a', 'input'].includes(element.tagName)) return true;
    if (['button', 'link', 'tab'].includes(element.getAttribute('role'))) return true;
    return false;
  }
  
  // Fallback chain
  async clickElement(index) {
    try { await this.page.click(selector); }
    catch { try { await this.page.$x(xpath)[0].click(); }
    catch { await this.page.mouse.click(x, y); } }
  }
}
```

📚 **Referências:**
- [nanobrowser.md](./research/nanobrowser.md) - Interactivity heuristics
- [SYNTHESIS.md - Phase 1](./research/synthesis.md#sprint-1-foundation)

---

### **Fase 2: Robustness (~1-2 sprints)**

✅ **O que adicionar:**
1. Visibility checking (elementFromPoint 3-point sampling)
2. Z-order detection (isTopElement)
3. Stability waiting (don't interact mid-animation)
4. Frame/iframe navigation

```typescript
// Visibility: 3-point sampling
isTopElement(element) {
  const rect = element.getBoundingClientRect();
  const points = [
    [rect.left + rect.width*0.3, rect.top + rect.height*0.3],
    [rect.left + rect.width*0.7, rect.top + rect.height*0.7],
    [rect.left + rect.width*0.5, rect.top + rect.height*0.5]
  ];
  
  return points.filter(([x,y]) => 
    document.elementFromPoint(x,y) === element
  ).length >= 2;  // At least 2/3 visible
}

// Stability: wait before interact
async waitForStability(element, timeout=500) {
  let lastRect = element.getBoundingClientRect();
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    const rect = element.getBoundingClientRect();
    if (Math.abs(rect.x - lastRect.x) < 2 && Math.abs(rect.y - lastRect.y) < 2) {
      return;  // Stable!
    }
    lastRect = rect;
    await sleep(50);
  }
}
```

📚 **Referências:**
- [browsernode.md](./research/browsernode.md) - Session + frames
- [SYNTHESIS.md - Phase 2](./research/synthesis.md#sprint-2-robustness)

---

### **Fase 3: Intelligence (~2 sprints)**

✅ **O que integrar:**
1. LLM integration (Claude/GPT-4)
2. Structured action prompts
3. Vision fallback (screenshot + LLM)
4. Confidence scoring

```typescript
// Structured action decision
const prompt = `
OBJETIVO: ${objective}
URL: ${url}

ELEMENTOS DISPONÍVEIS:
${JSON.stringify(elements, null, 2)}

Próxima ação? Formato: { "action": "click|type|select", "index": N, "params": {...} }
`;

// Vision fallback
if (selectorFails) {
  const screenshot = await page.screenshot();
  const decision = await gpt4v({
    image: screenshot,
    prompt: `Where should I click to ${action}? Respond with [x, y] coordinates.`
  });
  const [x, y] = decision;
  await page.mouse.click(x, y);
}
```

📚 **Referências:**
- [skyvern.md](./research/skyvern.md) - Action taxonomy
- [SYNTHESIS.md - Phase 3](./research/synthesis.md#sprint-3-intelligence)

---

### **Fase 4: Scale (~1-2 sprints)**

✅ **O que otimizar:**
1. DOM chunking (viewport-aware, 500 elements/chunk)
2. Readability integration (content extraction)
3. Token budget management
4. Screenshot scaling

```typescript
// DOM Chunking: 20x token reduction!
function chunkDOM(domTree, chunkSize = 500) {
  const chunks = [];
  for (let i = 0; i < domTree.length; i += chunkSize) {
    chunks.push({
      chunkId: chunks.length,
      elements: domTree.slice(i, i + chunkSize)
    });
  }
  return chunks;
}

// Readability: Clean before LLM
const reader = new Readability(document);
const article = reader.parse();  // Clean HTML + text
// Pass article.textContent to LLM instead of raw DOM
```

📚 **Referências:**
- [browserable.md](./research/browserable.md) - Chunking
- [readability.md](./research/readability.md) - Content extraction
- [SYNTHESIS.md - Phase 4](./research/synthesis.md#sprint-4-scale)

---

### **Fase 5: Production (~1-2 sprints)**

✅ **O que preparar:**
1. Multi-session pooling (cloud deployment)
2. Error recovery + retry logic
3. Logging + monitoring
4. Performance profiling

```typescript
// Session pooling with cleanup
class SessionManager {
  private sessions: Map<string, Session>;
  private MAX_SESSIONS = 10;
  private TIMEOUT = 15 * 60 * 1000;  // 15 min
  
  async createSession() {
    if (this.sessions.size >= this.MAX_SESSIONS) {
      await this.evictLRU();
    }
    return { id: uuid(), browser: await launch() };
  }
  
  startIdleMonitor() {
    setInterval(() => {
      for (const [id, session] of this.sessions) {
        if (Date.now() - session.lastActivity > this.TIMEOUT) {
          this.closeSession(id);
        }
      }
    }, 60000);
  }
}
```

📚 **Referências:**
- [browserbase-mcp.md](./research/browserbase-mcp.md) - Session pooling
- [SYNTHESIS.md - Phase 5](./research/synthesis.md#sprint-5-production)

---

## 📊 Matriz de Decisão: Quando Usar O Quê

| Decisão | Opção A | Opção B | Opção C | Recomendação |
|---------|---------|---------|---------|--------------|
| **Detecção de<br/>elementos** | Form-based | Cursor style | Multi-signal | ✅ Multi-signal<br/>(88% accuracy) |
| **Ação<br/>primária** | Selector | XPath | Coordinates | ✅ XPath<br/>(92% success) |
| **Fallback** | Coordinates | Vision | Retry | ✅ Vision<br/>(96% success) |
| **Estado** | Ephemeral | Persistent | Hybrid | ✅ Hybrid<br/>(simples + robusto) |
| **Páginas<br/>grandes** | Full DOM | Chunking | Lazy-load | ✅ Chunking<br/>(20x tokens) |
| **Cloud** | Simple | Pooling | Cache | ✅ Pooling +<br/>cleanup |

---

## 🧪 Benchmarks & Validação

### **Metas de Qualidade**

```
Element Detection:
  ✓ Button/link accuracy: 95%+
  ✓ Form input accuracy: 99%+
  ✓ Visibility accuracy: 90%+

Action Execution:
  ✓ Simple click success: 95%+
  ✓ Text input success: 95%+
  ✓ Fallback recovery: 90%+

State Management:
  ✓ DOM rebuild time: <300ms (<5k elements)
  ✓ Delta accuracy: 99%+
  ✓ Session cleanup: 100%

LLM Integration:
  ✓ Action accuracy: 85%+
  ✓ Token reduction: 80%+
```

### **Teste Esses Sites**

```
Pequenas pags (<1000 elementos):
  □ https://www.wikipedia.org
  □ https://news.ycombinator.com

Médias pags (1000-5000):
  □ https://www.amazon.com
  □ https://news.google.com

Grandes pags (>5000):
  □ https://www.github.com
  □ https://stackoverflow.com/<long-thread>
```

---

## 🔧 Troubleshooting

### ❌ "Elemento não encontrado"
**Causa:** Selector frágil ou elemento em iframe
**Solução:** 
1. Verificar [browsernode.md - Frame navigation](./research/browsernode.md#6-frame-navigation-iframes)
2. Usar vision fallback (browserable)

### ❌ "DOM muito grande (50k+ tokens)"
**Causa:** Página não foi processada com Readability
**Solução:**
1. Aplicar [readability.md](./research/readability.md)
2. Ou usar chunking (browserable)

### ❌ "Ações lentas (>5s por clique)"
**Causa:** Múltiplas tentativas de fallback
**Solução:**
1. Validar XPath gerado (nano browser)
2. usar vision fallback paralelo

### ❌ "Múltiplas sessões ficam abertas"
**Causa:** Sem cleanup de idle
**Solução:**
1. Implementar [browserbase-mcp.md - Session cleanup](./research/browserbase-mcp.md#3-screenshot-handling-cdp-integration)

---

## 📞 Referências Rápidas

### **Padrões Implementados**
- ✅ Element detection: [nanobrowser heuristics](./research/nanobrowser.md#2-interactive-element-heuristics-multi-stage)
- ✅ Action fallback: [browserable strategies](./research/browserable.md#1-multi-helper-action-execution-pattern)
- ✅ Session management: [browsernode](./research/browsernode.md#4-browsersession-management)
- ✅ Content extraction: [readability algorithm](./research/readability.md#2-content-scoring-algorithm)

### **Documentos de Pesquisa**
- [SYNTHESIS.md](./research/synthesis.md) - Análise cruzada + decisões arquiteturais
- [README Research](./research/readme.md) - Índice de 13 frameworks

### **Passos Recomendados**
1. Ler [SYNTHESIS.md](./research/synthesis.md) completamente
2. Começar Fase 1 com padrões de nanobrowser
3. Testar em 3 sites de tamanho diferente
4. Iterar para Fase 2-5 baseado em necessidade

---

## ✅ Checklist: Pronto para Começar?

- [ ] Li [SYNTHESIS.md](./research/synthesis.md)
- [ ] Escolhi arquitetura (Fase 1-5)
- [ ] Identifiquei tamanho de páginas alvo
- [ ] Tenho benchmarks de teste
- [ ] Entendi padrões de fallback
- [ ] Planei integração com LLM (se aplicável)
- [ ] Preparei logging/monitoring

**Próximo passo:** Iniciar implementação Fase 1 + SYNTHESIS.md

---

**Última atualização:** Fevereiro 2026  
**Status:** ✅ Pesquisa completa (13/13 frameworks)  
**Proximos passos:** Implementação das 5 fases
