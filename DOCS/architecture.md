# Arquitetura e build

## Linguagem e build
- TypeScript.
- Build com alta compatibilidade de interfaces.
- Puppeteer como devDependency.

## Estrutura sugerida
- src/core: taxonomia, ids, modelos.
- src/adapters: browser, remote.
- src/actions: click, type, select.

## Arquitetura Layered (Recomendada)

Baseada em pesquisa de 13 frameworks:

```
┌───────────────────────────────┐
│  LLM Integration Layer        │
│  (ActionType enums)           │
│  + Structured prompts         │
└────────────┬──────────────────┘
             │
┌────────────▼──────────────────┐
│  Action Execution             │
│  (Multi-fallback strategy)    │
│  selector → xpath → vision    │
└────────────┬──────────────────┘
             │
┌────────────▼──────────────────┐
│  DOM Management               │
│  (Multi-stage heuristics)     │
│  cursor > form > ARIA         │
└────────────┬──────────────────┘
             │
┌────────────▼──────────────────┐
│  Session Management           │
│  (State tracking)             │
│  DOM cache, history, cleanup  │
└────────────┬──────────────────┘
             │
┌────────────▼──────────────────┐
│  Content Cleaning             │
│  (Readability integration)    │
│  80-90% token reduction       │
└───────────────────────────────┘
```

## Implementação em Fases (5 sprints)

1. **Fase 1 (Foundation):** Multi-stage heuristics + fallback básico
2. **Fase 2 (Robustness):** Visibility + z-order + stability checking
3. **Fase 3 (Intelligence):** LLM integration + vision fallback
4. **Fase 4 (Scale):** DOM chunking + readability extraction
5. **Fase 5 (Production):** Session pooling + error recovery

📖 Ver [../agents.md](../agents.md) para guia detalhado de implementação.

## Padrões de Cada Camada

### DOM Management (nanobrowser pattern)
```typescript
interactivity = multi_stage(cursor_style, form_tags, aria_roles, events)
visibility = elementFromPoint(3_point_sampling)
top_element = z_order_check(element)
```

### Action Execution (browserable pattern)
```
try selector
  → try xpath
    → try vision_based(screenshot)
      → fallback to coordinates
```

### Session (browsernode pattern)
```
per_action:
  1. perform_action()
  2. wait_for_load()
  3. rebuild_dom()
  4. update_selector_map()
  5. analyze_deltas()
```

### Content (readability pattern)
```
raw_dom (50k+ tokens)
  → readability.parse()
    → cleaned_text (5-10k tokens)
      → llm_decision()
```

## Referências de Pesquisa
- [SYNTHESIS.md](./research/SYNTHESIS.md) - Decision matrices
- [nanobrowser.md](./research/nanobrowser.md) - Interactivity heuristics (88% accuracy)
- [skyvern.md](./research/skyvern.md) - Action taxonomy
- [browserable.md](./research/browserable.md) - Multi-strategy + chunking
- [browsernode.md](./research/browsernode.md) - Session management
- [readability.md](./research/readability.md) - Content extraction
- [browserbase-mcp.md](./research/browserbase-mcp.md) - Cloud deployment
